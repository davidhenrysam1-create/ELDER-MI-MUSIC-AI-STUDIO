import { NextResponse, type NextRequest } from "next/server";

/**
 * Two doors, in this order:
 *
 * 1. **Optional studio password** (`STUDIO_PASSWORD`) — HTTP Basic auth for the
 *    whole deployment. Unchanged from earlier versions: leave it unset for a
 *    local studio.
 * 2. **Account session** — every studio page and API route needs a signed-in
 *    account. This middleware only checks that the session *cookie exists*
 *    (edge runtime cannot read the JSON store); the real validation, expiry
 *    check and ownership scoping happen in `lib/server/auth.ts` and each route
 *    handler. A forged cookie therefore gets a `401`, not access.
 *
 * Pages redirect to `/login?next=…`; API calls get a JSON `401` so the client
 * can react instead of parsing HTML.
 */

/** Paths that must work without an account. */
const PUBLIC_PREFIXES = ["/login", "/signup", "/s/", "/offline"];
const PUBLIC_FILES = [
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
];
const PUBLIC_API = ["/api/auth/", "/api/share/"];

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

function isPublic(pathname: string): boolean {
  if (PUBLIC_FILES.includes(pathname)) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return true;
  }
  return PUBLIC_API.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  if (!basicAuthOk(request)) {
    return new NextResponse("Elder Mi Music AI Studio — authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Elder Mi Music AI Studio", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }

  const { pathname, search } = request.nextUrl;
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
