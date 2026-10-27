import { restoreVersion, saveVersion, getProject } from "@/lib/server/repo";
import { asString, jsonError } from "@/lib/server/validation";
import type { StudioId } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return jsonError("Project not found", 404);
  return Response.json({ versions: project.versions });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const note = asString(body.note, "", 400);
  const studio = (["vocal", "mix", "mastering"].includes(asString(body.studio))
    ? asString(body.studio)
    : "vocal") as StudioId;
  const version = await saveVersion(id, note, studio, asString(body.label, "", 60));
  if (!version) return jsonError("Project not found", 404);
  return Response.json({ version }, { status: 201 });
}

/** Restore a saved version (non-destructive: the current state is snapshotted first). */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");
  const versionId = asString(body.versionId, "", 60);
  if (!versionId) return jsonError("versionId is required");

  const project = await getProject(id);
  if (!project) return jsonError("Project not found", 404);
  const target = project.versions.find((v) => v.id === versionId);
  if (!target) return jsonError("Version not found", 404);

  // Snapshot current work so restoring is itself reversible.
  await saveVersion(id, `Auto-saved before restoring ${target.label}`, target.studio, "Pre-restore checkpoint");
  const restored = await restoreVersion(id, versionId);
  if (!restored) return jsonError("Restore failed", 500);
  return Response.json({ project: restored });
}
