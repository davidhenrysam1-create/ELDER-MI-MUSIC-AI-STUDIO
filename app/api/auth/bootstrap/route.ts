/**
 * POST /api/auth/bootstrap
 *
 * One-time admin sign-in while Google is not configured yet. The code comes from
 * `ADMIN_BOOTSTRAP_CODE`, or is generated and printed in the server log by
 * `adminSignInState()`. It is single-use, expires after 24 hours, and the route
 * refuses entirely once Google sign-in is configured.
 */
import { AuthError, redeemBootstrapCode } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim()) return jsonError("Enter the bootstrap code from the server log.");

  try {
    const user = await redeemBootstrapCode(code, request.headers.get("user-agent"));
    return Response.json({ user });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, err.status);
    return jsonError("Could not complete the bootstrap sign-in.", 500);
  }
}
