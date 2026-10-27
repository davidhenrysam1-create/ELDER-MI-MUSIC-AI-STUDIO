/**
 * POST /api/auth/password/reset
 *
 * Finishes a reset: the token from the email plus the new password. The token is
 * single use, expires after an hour, and every session for the account is ended
 * so an old password cannot keep a device signed in.
 */
import { AuthError, resetPasswordWithToken } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  try {
    const user = await resetPasswordWithToken(
      typeof body.token === "string" ? body.token : "",
      typeof body.password === "string" ? body.password : "",
    );
    return Response.json({ ok: true, email: user.email, signedOut: true });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, err.status);
    return jsonError("Could not reset the password", 500);
  }
}
