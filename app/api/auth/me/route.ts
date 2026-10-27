/**
 * GET    /api/auth/me   → the signed-in account, its sessions and whether
 *                         sign-up is open
 * PATCH  /api/auth/me   → change the display name
 * DELETE /api/auth/me   → close the account and delete everything it owns
 */
import {
  AuthError,
  accountCount,
  currentUser,
  deleteUser,
  endSession,
  guard,
  listSessions,
  updateProfile,
  type PublicUser,
} from "@/lib/server/auth";
import { deleteAccountData } from "@/lib/server/repo";
import { asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

/** True when this studio accepts new accounts (first account can always be made). */
async function signupOpen(): Promise<boolean> {
  const open = (process.env.ALLOW_SIGNUP ?? "true").toLowerCase() !== "false";
  return open || (await accountCount()) === 0;
}

export async function GET() {
  const user = await currentUser();
  return Response.json({
    user,
    sessions: user ? await listSessions(user.id) : [],
    signupOpen: await signupOpen(),
    allowSignupEnv: (process.env.ALLOW_SIGNUP ?? "true").toLowerCase() !== "false",
  });
}

export async function PATCH(request: Request) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");
  try {
    const user: PublicUser = await updateProfile(auth.user.id, {
      name: asString(body.name, auth.user.name, 60),
    });
    return Response.json({ user });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, err.status);
    return jsonError("Could not update the account", 500);
  }
}

/**
 * Delete the account.
 *
 * The password is required again so a borrowed phone cannot wipe a studio, and
 * the studio owner is refused: deleting the owner would strand every account.
 */
export async function DELETE(request: Request) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (auth.user.role === "owner") {
    return jsonError(
      "The studio owner account cannot delete itself. Transfer or remove the other accounts first.",
      409,
    );
  }

  try {
    const { verifyPassword } = await import("@/lib/server/auth");
    const { readDb } = await import("@/lib/server/db");
    const db = await readDb();
    const record = db.users.find((entry) => entry.id === auth.user.id);
    if (!record) return jsonError("Account not found", 404);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!(await verifyPassword(password, record.passwordHash))) {
      return jsonError("Password is incorrect.", 401);
    }
    await deleteAccountData(auth.user.id);
    await deleteUser(auth.user.id);
    await endSession();
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError((err as Error).message || "Could not delete the account", 500);
  }
}
