/**
 * DELETE /api/shares/[id]
 *
 * Revokes a link immediately: the next visit (and any in-flight download) sees
 * the "link no longer active" page. A revoked link cannot be reactivated; make a
 * new one instead.
 */
import { guard } from "@/lib/server/auth";
import { revokeShare } from "@/lib/server/shares";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  const ok = await revokeShare(auth.user.id, id);
  if (!ok) return jsonError("Share link not found", 404);
  return Response.json({ ok: true });
}
