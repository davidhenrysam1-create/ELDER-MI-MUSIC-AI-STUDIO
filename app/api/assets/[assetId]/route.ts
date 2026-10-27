import { guard } from "@/lib/server/auth";
import { deleteAsset, getProject } from "@/lib/server/repo";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ assetId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { assetId } = await params;
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return jsonError("projectId query parameter is required");
  const project = await getProject(projectId, auth.user.id);
  if (!project) return jsonError("Project not found", 404);
  const ok = await deleteAsset(projectId, assetId);
  if (!ok) return jsonError("Asset not found", 404);
  return Response.json({ ok: true });
}
