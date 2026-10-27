/**
 * GET /api/auth/google/start
 *
 * Begins Google sign-in. Sets a short-lived `state` cookie (CSRF protection for
 * the callback) and redirects to Google's consent screen.
 *
 * With no Google credentials configured this redirects back to the sign-in
 * screen with an explanation — it never shows a broken Google error page.
 */
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { persistentCookieOptions } from "@/lib/server/cookies";
import {
  OAUTH_STATE_COOKIE,
  authorizationUrl,
  googleConfigured,
  requestOrigin,
} from "@/lib/server/google";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // The origin the browser really used (forwarded headers), not the internal host.
  const origin = requestOrigin(request);
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?google=unconfigured", origin));
  }
  const state = randomBytes(16).toString("base64url");
  const store = await cookies();
  // Same attributes as the session cookie: over HTTPS (and therefore inside an
  // embedded preview) this has to be SameSite=None + Partitioned, otherwise the
  // browser drops it and the callback fails with "attempt expired".
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    ...(await persistentCookieOptions()),
    maxAge: 10 * 60,
  });
  return NextResponse.redirect(authorizationUrl(origin, state));
}
