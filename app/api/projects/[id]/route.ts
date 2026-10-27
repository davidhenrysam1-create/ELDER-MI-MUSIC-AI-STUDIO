import { guard } from "@/lib/server/auth";
import { deleteProject, getProject, patchProject } from "@/lib/server/repo";
import { jsonError } from "@/lib/server/validation";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  const project = await getProject(id, auth.user.id);
  if (!project) return jsonError("Project not found", 404);
  return Response.json({ project });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  // Ownership is checked before writing: patchProject has no owner filter of its
  // own, so an unowned id must never reach it.
  if (!(await getProject(id, auth.user.id))) return jsonError("Project not found", 404);
  const body = (await request.json().catch(() => null)) as Partial<Project> | null;
  if (!body) return jsonError("Invalid JSON body");
  const project = await patchProject(id, body);
  if (!project) return jsonError("Project not found", 404);
  return Response.json({ project });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  const ok = await deleteProject(id, auth.user.id);
  if (!ok) return jsonError("Project not found", 404);
  return Response.json({ ok: true });
}
