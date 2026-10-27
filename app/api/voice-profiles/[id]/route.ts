import { guard } from "@/lib/server/auth";
import { deleteVoiceProfile } from "@/lib/server/repo";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  const ok = await deleteVoiceProfile(id, auth.user.id);
  if (!ok) return jsonError("Voice profile not found", 404);
  return Response.json({ ok: true });
}
