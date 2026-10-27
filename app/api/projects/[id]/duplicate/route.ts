import { guard } from "@/lib/server/auth";
import { duplicateProject } from "@/lib/server/repo";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  // Only the owner can copy a project; the copy keeps the same owner.
  const project = await duplicateProject(id, auth.user.id);
  if (!project) return jsonError("Project not found", 404);
  return Response.json({ project }, { status: 201 });
}
