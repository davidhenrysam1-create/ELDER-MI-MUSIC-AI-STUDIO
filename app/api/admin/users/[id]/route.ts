/**
 * PATCH /api/admin/users/[id]  — roles, verification, suspension, display name
 * DELETE /api/admin/users/[id] — remove the account and everything it owns
 *
 * Admin-only. The admin account itself cannot be suspended, and the route
 * refuses to delete it, so the studio cannot be locked out of its own console.
 */
import { adminGuard, adminUpdateUser, deleteUser, isAdminEmail } from "@/lib/server/auth";
import { deleteAccountData } from "@/lib/server/repo";
import { asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await adminGuard();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  try {
    const user = await adminUpdateUser(auth.user.id, id, {
      roles: Array.isArray(body.roles) ? (body.roles as never) : undefined,
      name: body.name === undefined ? undefined : asString(body.name, "", 60),
      emailVerified: typeof body.emailVerified === "boolean" ? body.emailVerified : undefined,
      suspended: typeof body.suspended === "boolean" ? body.suspended : undefined,
      suspendedReason: body.suspendedReason === undefined ? undefined : asString(body.suspendedReason, "", 200),
    });
    return Response.json({ user });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return jsonError((err as Error).message || "Could not update the account", status);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await adminGuard();
  if (auth.response) return auth.response;
  const { id } = await params;
  if (id === auth.user.id) return jsonError("You cannot delete your own admin account.", 400);

  const { readDb } = await import("@/lib/server/db");
  const db = await readDb();
  const target = db.users.find((user) => user.id === id);
  if (!target) return jsonError("Account not found", 404);
  if (isAdminEmail(target.email)) return jsonError("The studio admin account cannot be deleted.", 400);

  await deleteAccountData(id);
  await deleteUser(id);
  return Response.json({ ok: true });
}
