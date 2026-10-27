/**
 * GET /api/auth/google/callback
 *
 * Verifies the `state` cookie, exchanges the code for a profile, then creates or
 * links the account and redirects into the studio. Every failure redirects to
 * the sign-in screen with a readable reason instead of dumping a stack trace.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthError, signInWithGoogle } from "@/lib/server/auth";
import { OAUTH_STATE_COOKIE, exchangeCodeForProfile, googleConfigured } from "@/lib/server/google";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?google=${code}`, origin));

  if (!googleConfigured()) return fail("unconfigured");
  if (url.searchParams.get("error")) return fail("cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expected = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !expected || state !== expected) return fail("state");

  try {
    const profile = await exchangeCodeForProfile(code, origin);
    if (!profile.emailVerified) return fail("unverified_email");
    const user = await signInWithGoogle(profile, request.headers.get("user-agent"));
    // New Google accounts have no roles yet: send them to the welcome screen.
    const next = (user.roles ?? []).length === 0 ? "/welcome" : "/";
    return NextResponse.redirect(new URL(next, origin));
  } catch (err) {
    if (err instanceof AuthError && err.status === 403) {
      return NextResponse.redirect(
        new URL(`/login?google=suspended&reason=${encodeURIComponent(err.message)}`, origin),
      );
    }
    console.error("[Elder Mi] Google sign-in failed:", err);
    return fail("error");
  }
}
