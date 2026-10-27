/**
 * Cookie attributes, decided once for the whole app.
 *
 * Why this file exists: the studio is served in two very different contexts.
 *
 *  1. **Its own tab** (`http://localhost:3200`, or a deployment's own domain).
 *     A normal first-party cookie is right: `SameSite=Lax`, `Secure` only when
 *     the page itself is HTTPS.
 *  2. **Inside an embedded preview** — Arena, Codespaces, and most hosted
 *     preview panels show the app in an `<iframe>` on another site. To that
 *     browser the studio is *third-party*, so a `SameSite=Lax` cookie is
 *     dropped on the floor. The sign-in POST succeeds, the cookie never
 *     arrives, and the next page bounces straight back to `/login`. That is the
 *     "clicking Sign in returns me to the login screen" bug.
 *
 * For case 2 the cookie must be `SameSite=None; Secure; Partitioned` (CHIPS):
 * `None` lets it travel in a third-party frame, `Secure` is mandatory with
 * `None`, and `Partitioned` keeps it scoped to the embedding site instead of
 * opening it up as a free-floating third-party cookie.
 *
 * The decision is made from the request, not from `NODE_ENV`:
 *  - `x-forwarded-proto: https` — the proxy in front of the preview terminates
 *    TLS, which means we are being viewed over HTTPS (and plausibly embedded);
 *  - the `Origin` header on a POST/fetch — always absolute and always present
 *    on the sign-in request, so it is a reliable second signal;
 *  - otherwise we keep the strict, first-party default.
 *
 * Because `SameSite=None` cookies *are* sent on cross-site requests, the
 * companion defence lives in `middleware.ts`: mutating requests whose `Origin`
 * does not match the host being served are rejected.
 */
import { headers } from "next/headers";

/** The subset of cookie options this app sets. */
export interface CookiePolicy {
  sameSite: "lax" | "none";
  secure: boolean;
  /** CHIPS: only meaningful (and only allowed) with `sameSite: "none"` + `secure`. */
  partitioned: boolean;
}

/**
 * Pure decision function — unit tested in `tests/cookies.test.ts`.
 *
 * Kept free of Next.js imports so it can be reasoned about (and tested) without
 * a request scope.
 */
export function cookiePolicyFor(input: {
  proto?: string | null;
  origin?: string | null;
}): CookiePolicy {
  // Proxies may send a comma-separated chain; the first entry is the client hop.
  const proto = (input.proto ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  const origin = (input.origin ?? "").trim().toLowerCase();
  const https = proto === "https" || origin.startsWith("https://");

  if (https) return { sameSite: "none", secure: true, partitioned: true };
  // Plain HTTP (a laptop on `http://localhost:3000`): `SameSite=None` would be
  // rejected by the browser, so keep the strict first-party default. `Secure` is
  // deliberately *not* tied to NODE_ENV — a production build served over plain
  // HTTP (a LAN address, an old tablet) must still be able to sign in, and a
  // non-Secure cookie over HTTPS is perfectly valid.
  return { sameSite: "lax", secure: false, partitioned: false };
}

/** Read the current request's headers and decide the cookie policy. */
export async function requestCookiePolicy(): Promise<CookiePolicy> {
  try {
    const store = await headers();
    return cookiePolicyFor({
      proto: store.get("x-forwarded-proto"),
      origin: store.get("origin"),
    });
  } catch {
    // Outside a request (unit tests, scripts): behave like a local run.
    return cookiePolicyFor({});
  }
}

/**
 * Options for a cookie that should live for `expires`.
 *
 * Callers pass the ones they own (`httpOnly`, `path`, `maxAge`, …); this adds
 * the SameSite/Secure/Partitioned trio so the rule cannot drift between the
 * session cookie and the OAuth state cookie.
 */
export async function persistentCookieOptions(
  expires?: Date,
): Promise<CookiePolicy & { path: string; expires?: Date }> {
  const policy = await requestCookiePolicy();
  return { ...policy, path: "/", ...(expires ? { expires } : {}) };
}
