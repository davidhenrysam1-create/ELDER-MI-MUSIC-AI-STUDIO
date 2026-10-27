/**
 * POST /api/auth/logout
 *
 * Deletes the current session record and clears the cookie. Safe to call when
 * already signed out.
 */
import { endSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
