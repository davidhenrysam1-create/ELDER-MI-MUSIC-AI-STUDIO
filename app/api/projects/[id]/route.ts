import { deleteProject, getProject, patchProject } from "@/lib/server/repo";
import { jsonError } from "@/lib/server/validation";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return jsonError("Project not found", 404);
  return Response.json({ project });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Partial<Project> | null;
  if (!body) return jsonError("Invalid JSON body");
  const project = await patchProject(id, body);
  if (!project) return jsonError("Project not found", 404);
  return Response.json({ project });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ok = await deleteProject(id);
  if (!ok) return jsonError("Project not found", 404);
  return Response.json({ ok: true });
}
