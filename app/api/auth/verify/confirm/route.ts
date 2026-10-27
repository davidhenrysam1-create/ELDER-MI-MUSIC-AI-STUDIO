/**
 * GET /api/auth/verify/confirm?token=…
 *
 * Confirms an address from the link in the verification email, then redirects to
 * the account page with a readable result.
 */
import { NextResponse } from "next/server";
import { AuthError, confirmEmail } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const token = url.searchParams.get("token") ?? "";
  try {
    await confirmEmail(token);
    return NextResponse.redirect(new URL("/account?verified=1", origin));
  } catch (err) {
    const reason = err instanceof AuthError ? err.message : "That verification link is not valid.";
    return NextResponse.redirect(new URL(`/account?verified=0&reason=${encodeURIComponent(reason)}`, origin));
  }
}
