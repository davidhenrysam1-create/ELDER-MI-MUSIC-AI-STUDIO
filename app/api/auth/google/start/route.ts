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
import { OAUTH_STATE_COOKIE, authorizationUrl, googleConfigured } from "@/lib/server/google";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?google=unconfigured", origin));
  }
  const state = randomBytes(16).toString("base64url");
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return NextResponse.redirect(authorizationUrl(origin, state));
}
