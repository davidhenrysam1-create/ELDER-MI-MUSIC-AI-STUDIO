import { NextResponse, type NextRequest } from "next/server";

/**
 * Two doors, in this order:
 *
 * 1. **Optional studio password** (`STUDIO_PASSWORD`) — HTTP Basic auth for the
 *    whole deployment. Unchanged from earlier versions: leave it unset for a
 *    local studio.
 * 2. **Cross-site write guard** — the session cookie is `SameSite=None` when the
 *    studio is served over HTTPS (see `lib/server/cookies.ts`), which is what
 *    lets sign-in work inside an embedded preview. `None` cookies *are* sent on
 *    cross-site requests, so anything that changes state must prove it came from
 *    our own origin.
 * 3. **Account session** — off by default. This build runs in *open studio*
 *    mode: there is no sign-in screen and every page is reachable, acting as
 *    the studio owner account (`lib/server/auth.ts`). Only when
 *    `STUDIO_ACCOUNTS=on` does the studio go back to per-person accounts, and
 *    then this middleware checks that a session *cookie exists* (the edge
 *    runtime cannot read the JSON store). Real validation, expiry and ownership
 *    scoping always happen in `lib/server/auth.ts` and each route handler, so a
 *    forged cookie still gets a `401`, never access.
 *
 * When accounts are on, pages redirect to `/login?next=…` and API calls get a
 * JSON `401` so the client can react instead of parsing HTML.
 */

/**
 * Paths that must work without an account:
 *  - the way in (`/login`, `/signup`) and the one-time admin code;
 *  - a friend's shared link (`/s/`) and a creator's public page (`/u/`);
 *  - the PWA fallback.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  // Password recovery happens *before* anyone can sign in.
  "/forgot",
  "/reset",
  "/admin-bootstrap",
  "/s/",
  "/u/",
  "/offline",
];
/**
 * Screens that only exist in accounts mode. In open mode they have nothing to
 * do, so they forward to the dashboard instead of showing a login form.
 */
const SIGN_IN_PATHS = ["/login", "/signup", "/admin-bootstrap", "/welcome", "/forgot", "/reset"];
const PUBLIC_FILES = [
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
];
/**
 * APIs that work without a session.
 *
 *  - `/api/auth/`     — the sign-in routes themselves;
 *  - `/api/share/`    — a friend's private link;
 *  - `/api/profile/`  — a creator's public page;
 *  - `/api/releases`  — published songs: reading and streaming is public,
 *                       while writing, liking and downloading re-check the
 *                       session inside their own handlers (`guard()`), so
 *                       letting the request through here cannot bypass auth.
 *
 * Everything else is refused before it reaches a handler.
 */
const PUBLIC_API = ["/api/auth/", "/api/share/", "/api/profile/", "/api/releases", "/api/creators"];

/**
 * The liveness probe, reachable no matter how the deployment is locked down.
 *
 * A hosting platform's health check (Render, Docker, an uptime monitor) cannot
 * sign in and sends no cookie, so anything gated would answer `401` and the
 * platform would declare a perfectly healthy app dead — restart-looping it, or
 * refusing to send traffic. `/api/health` therefore bypasses both the optional
 * studio password and the session check. It returns only `{ok:true}`, a version
 * string and an uptime counter: nothing that helps an attacker.
 */
const HEALTH_PATH = "/api/health";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function basicAuthOk(request: NextRequest): boolean {
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return true;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  const user = decoded.slice(0, separator);
  const supplied = decoded.slice(separator + 1);
  const expectedUser = process.env.STUDIO_USER || "studio";
  return safeEqual(user, expectedUser) && safeEqual(supplied, password);
}

/** Methods that change state and therefore need an origin check. */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Reject a write that a *different site* initiated.
 *
 * The browser sets `Origin` on every fetch and form POST. A same-origin write
 * carries our own host there; a cross-site one carries the attacker's, so a
 * plain `curl` without an Origin header (or a same-origin CLI call) is still
 * allowed — nothing is gained by blocking requests that carry no cookies.
 */
export function crossSiteWrite(request: NextRequest): boolean {
  if (!MUTATING.has(request.method.toUpperCase())) return false;

  /*
   * `Sec-Fetch-Site` is the browser's own statement about who started the
   * request, and it compares the initiator with the *target as the browser sees
   * it* — so it stays correct even when a proxy rewrites `Host` (which is exactly
   * the embedded-preview case). Prefer it when present: `same-origin` and
   * `same-site` are fine, `cross-site` is not, and `none` means a direct
   * navigation (a form post from an address typed by the user).
   */
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return true;
  if (fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false; // same-origin navigations older than Origin support
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return true; // unparseable Origin: treat as hostile
  }
  const candidates = [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    request.nextUrl.host,
  ]
    .map((value) => value?.split(",")[0]?.trim().toLowerCase())
    .filter(Boolean);
  return !candidates.includes(originHost);
}

/**
 * Are per-person accounts switched on?
 *
 * Unset (the default) means open studio: the app behaves as one shared studio
 * with the owner account, and nothing asks anyone to sign in. `STUDIO_ACCOUNTS=on`
 * restores logins, sign-up and private libraries.
 */
function accountsMode(): boolean {
  return (process.env.STUDIO_ACCOUNTS ?? "").trim().toLowerCase() === "on";
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_FILES.includes(pathname)) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return true;
  }
  return PUBLIC_API.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  // Checked first: a platform's probe must succeed even when the whole site is
  // behind the optional studio password.
  if (request.nextUrl.pathname === HEALTH_PATH) return NextResponse.next();

  if (!basicAuthOk(request)) {
    return new NextResponse("Elder Mi Music AI Studio — authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Elder Mi Music AI Studio", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }

  if (crossSiteWrite(request)) {
    const message =
      "This request came from another site, so it was refused. Open the studio in its own tab and try again.";
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return new NextResponse(message, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { pathname, search } = request.nextUrl;

  // Open studio (the default): no sign-in screen anywhere. Forwarding these
  // paths home is what actually removes them from the app, rather than merely
  // hiding the links — a typed /login still lands on the dashboard.
  if (!accountsMode()) {
    if (SIGN_IN_PATHS.includes(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get("eldermi_session")?.value);
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  // Preserve where they were going so sign-in feels seamless.
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
