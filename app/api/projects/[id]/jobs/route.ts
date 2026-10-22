import { patchProject } from "@/lib/server/repo";
import { asNumber, asString, jsonError } from "@/lib/server/validation";
import type { JobRecord, StudioId } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const STUDIOS: StudioId[] = ["vocal", "mix", "mastering"];
const STATUSES: JobRecord["status"][] = ["queued", "running", "completed", "failed"];

/** Persist the lifecycle of a real client-side render job. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  const studio = asString(body.studio, "vocal") as StudioId;
  const status = asString(body.status, "running") as JobRecord["status"];
  if (!STUDIOS.includes(studio)) return jsonError("Unknown studio");
  if (!STATUSES.includes(status)) return jsonError("Unknown job status");

  const job: JobRecord = {
    id: asString(body.id, "", 60) || `job_${Date.now().toString(36)}`,
    projectId: id,
    studio,
    kind: asString(body.kind, "render", 60),
    title: asString(body.title, "Processing", 120),
    status,
    progress: asNumber(body.progress, 0, 0, 100),
    message: asString(body.message, "", 300),
    startedAt: asString(body.startedAt, new Date().toISOString(), 40),
    finishedAt: body.finishedAt ? asString(body.finishedAt, "", 40) : undefined,
    error: body.error ? asString(body.error, "", 400) : undefined,
  };

  const project = await patchProject(id, (p) => {
    const idx = p.jobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) p.jobs[idx] = job;
    else p.jobs.unshift(job);
    p.jobs = p.jobs.slice(0, 40);
  });
  if (!project) return jsonError("Project not found", 404);
  return Response.json({ job, project });
}
