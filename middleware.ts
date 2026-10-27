import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional single-operator gate.
 *
 * The studio is designed to run privately on your own machine or a private
 * server, so auth is opt-in: set STUDIO_PASSWORD and the whole app (pages and
 * API) requires HTTP Basic credentials. With no password configured the studio
 * stays open, which matches the local-first default in the README.
 */

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(request: NextRequest) {
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      decoded = "";
    }
    const separator = decoded.indexOf(":");
    const supplied = separator >= 0 ? decoded.slice(separator + 1) : "";
    const user = separator >= 0 ? decoded.slice(0, separator) : "";
    const expectedUser = process.env.STUDIO_USER || "studio";
    if (safeEqual(user, expectedUser) && safeEqual(supplied, password)) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Elder Mi Music AI Studio — authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Elder Mi Music AI Studio", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
