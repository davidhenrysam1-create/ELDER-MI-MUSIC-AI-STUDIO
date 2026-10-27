import { duplicateProject } from "@/lib/server/repo";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await duplicateProject(id);
  if (!project) return jsonError("Project not found", 404);
  return Response.json({ project }, { status: 201 });
}
