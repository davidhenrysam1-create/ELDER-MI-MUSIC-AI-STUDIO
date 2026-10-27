/**
 * POST /api/auth/onboarding
 *
 * Saves the roles chosen on `/welcome` (artist / producer / engineer / promoter,
 * one or more) plus an optional handle. This is what makes the dashboards differ.
 */
import { AuthError, guard, setRoles, updateProfile } from "@/lib/server/auth";
import { asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  const roles = Array.isArray(body.roles) ? body.roles : [];
  if (roles.length === 0) return jsonError("Choose at least one role: artist, producer, engineer or promoter.");

  try {
    await setRoles(auth.user.id, roles as never);
    const handle = asString(body.handle, "", 20);
    const user = handle
      ? await updateProfile(auth.user.id, { handle })
      : await setRoles(auth.user.id, roles as never);
    return Response.json({ user });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, err.status);
    return jsonError("Could not save your roles.", 500);
  }
}
