/**
 * POST /api/auth/password
 *
 * Change the password of the signed-in account. Every other session is revoked
 * and this one ends too, so the browser is pushed back to the sign-in screen.
 */
import { AuthError, changePassword, guard } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  try {
    await changePassword(auth.user.id, {
      currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
      newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
    });
    return Response.json({ ok: true, signedOut: true });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, err.status);
    return jsonError("Could not change the password", 500);
  }
}
