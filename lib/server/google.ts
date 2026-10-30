/**
 * Google sign-in (OAuth 2.0 authorisation code flow).
 *
 * Nothing here runs until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set,
 * because the client is registered in your own Google Cloud project and the
 * redirect URI must be a public HTTPS address. Until then the sign-in screen
 * shows "Continue with Google — awaiting configuration" and the routes answer
 * with the real reason instead of a broken redirect.
 *
 * Flow:
 *   1. `/api/auth/google/start` → redirect to Google with a `state` nonce stored
 *      in an HttpOnly cookie.
 *   2. `/api/auth/google/callback` → verify `state`, exchange the code at
 *      Google's token endpoint, read the verified profile, create/link the
 *      account, then redirect into the studio.
 */

/** Cookie holding the OAuth `state` nonce between /start and /callback. */
export const OAUTH_STATE_COOKIE = "eldermi_oauth_state";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/** Why Google sign-in is unavailable, in one sentence. */
export function googleStatus(): { configured: boolean; reason: string } {
  if (!process.env.GOOGLE_CLIENT_ID?.trim()) {
    return {
      configured: false,
      reason: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in.",
    };
  }
  if (!process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    return { configured: false, reason: "GOOGLE_CLIENT_SECRET is missing." };
  }
  return { configured: true, reason: "Google sign-in is configured." };
}

/**
 * The address the browser actually used.
 *
 * Behind a proxy (every hosted preview, and most real deployments) `request.url`
 * can carry the *internal* host — `http://0.0.0.0:3200` — while the browser is on
 * `https://…`. Handing that to Google produces `redirect_uri_mismatch` after the
 * user has already picked an account, so build the origin from the forwarded
 * headers the proxy sets, and fall back to the request URL only when they are
 * absent (a laptop talking to itself).
 */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto =
    (request.headers.get("x-forwarded-proto") ?? "").split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  return host ? `${proto}://${host}` : url.origin;
}

/** Lowercased host of an absolute URL, or "" when it cannot be parsed. */
function hostOf(value: string): string {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Hosts that mean "this same machine", so a laptop must not be reported as a
 * mismatch just because it is reached as `127.0.0.1` instead of `localhost`.
 */
function sameMachine(a: string, b: string): boolean {
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);
  return loopback.has(a.split(":")[0]) && loopback.has(b.split(":")[0]);
}

/**
 * The callback URL Google must be told about. It has to match the Cloud console
 * **character for character**, and — this is the part that bites — it must be a
 * host the browser is actually on. Sending Google `http://localhost:3200/...`
 * from a public address makes Google refuse with a bare "403. That's an error.",
 * which looks like the app is broken.
 *
 * So the order is:
 *   1. `GOOGLE_REDIRECT_URI` when set — the operator has taken control.
 *   2. `NEXT_PUBLIC_SITE_URL` **only when it names the host we are serving**, so
 *      a public deployment keeps its canonical address.
 *   3. Otherwise the origin the browser really used.
 */
export function redirectUri(origin: string): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const originHost = hostOf(origin);
  if (configured && hostOf(configured) === originHost) {
    return `${configured}/api/auth/google/callback`;
  }
  return `${origin}/api/auth/google/callback`;
}

/**
 * Why this address cannot complete a Google sign-in, in the operator's terms —
 * or `null` when the configured address and the browser agree.
 *
 * A preview URL (`https://<port>-<id>.e2b.app`, a Codespaces port, a tunnel)
 * changes every session, so it can never be registered with Google. Rather than
 * bouncing the visitor onto Google's opaque error page, the sign-in route uses
 * this to explain the situation on our own screen and point at the address that
 * *is* registered.
 */
export function redirectHostMismatch(
  origin: string,
): { configuredHost: string; currentHost: string } | null {
  const configured =
    process.env.GOOGLE_REDIRECT_URI?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return null;
  const configuredHost = hostOf(configured);
  const currentHost = hostOf(origin);
  if (!configuredHost || !currentHost) return null;
  if (configuredHost === currentHost) return null;
  if (sameMachine(configuredHost, currentHost)) return null;
  return { configuredHost, currentHost };
}

/** Build the consent-screen URL. */
export function authorizationUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  emailVerified: boolean;
}

/** Exchange an authorisation code for tokens and read the profile. */
export async function exchangeCodeForProfile(
  code: string,
  origin: string,
): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    redirect_uri: redirectUri(origin),
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenResponse.ok) {
    const detail = (await tokenResponse.text().catch(() => "")).slice(0, 300);
    throw new Error(`Google refused the sign-in (${tokenResponse.status}): ${detail}`);
  }
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("Google returned no access token.");

  const profileResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) {
    throw new Error("Google did not return the account profile.");
  }
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };
  if (!profile.sub || !profile.email) {
    throw new Error("Google returned a profile without an email address.");
  }
  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    emailVerified: profile.email_verified === true,
  };
}
