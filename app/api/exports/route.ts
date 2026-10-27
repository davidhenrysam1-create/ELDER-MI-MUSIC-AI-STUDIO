import { addExport, getProject, listExports } from "@/lib/server/repo";
import { sanitizeFileName, writeExport } from "@/lib/server/storage";
import { asNumber, asString, jsonError } from "@/lib/server/validation";
import type { ExportRecord, StudioId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return Response.json({ exports: await listExports() });
}

/** Store a rendered export so it stays downloadable from Export History. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Expected multipart/form-data");
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("No rendered file was included");
  if (file.size === 0) return jsonError("Rendered file is empty");
  if (file.size > 300 * 1024 * 1024) return jsonError("Export exceeds the 300 MB cap", 413);

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(asString(form.get("meta"), "{}", 100_000));
  } catch {
    return jsonError("Invalid export metadata");
  }

  const projectId = asString(meta.projectId, "", 60);
  const project = await getProject(projectId);
  if (!project) return jsonError("Project not found", 404);

  const format = asString(meta.format, "WAV", 8).toUpperCase() === "MP3" ? "MP3" : "WAV";
  const studioInput = asString(meta.studio, "mastering");
  const studio: StudioId = (["vocal", "mix", "mastering"].includes(studioInput)
    ? studioInput
    : "mastering") as StudioId;

  const fileName = sanitizeFileName(
    asString(meta.fileName, `ElderMi_${project.name}.${format === "MP3" ? "mp3" : "wav"}`, 120),
  );
  const ext = format === "MP3" ? "mp3" : "wav";
  const id = `exp_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const storedName = `${id}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeExport(storedName, bytes);

  const record: ExportRecord = {
    id,
    projectId,
    projectName: project.name,
    studio,
    assetId: meta.assetId ? asString(meta.assetId, "", 60) : null,
    fileName,
    mimeType: format === "MP3" ? "audio/mpeg" : "audio/wav",
    format,
    bitDepth: meta.bitDepth == null ? null : Math.round(asNumber(meta.bitDepth, 16, 8, 32)),
    sampleRate: Math.round(asNumber(meta.sampleRate, 48000, 8000, 384000)),
    sizeBytes: bytes.byteLength,
    durationSec: asNumber(meta.durationSec, 0, 0, 60 * 60),
    integratedLufs:
      meta.integratedLufs == null || meta.integratedLufs === ""
        ? null
        : asNumber(meta.integratedLufs, 0, -70, 10),
    truePeakDb:
      meta.truePeakDb == null || meta.truePeakDb === ""
        ? null
        : asNumber(meta.truePeakDb, 0, -70, 10),
    createdAt: new Date().toISOString(),
    storedName,
  };

  await addExport(record);
  return Response.json({ export: record }, { status: 201 });
}
