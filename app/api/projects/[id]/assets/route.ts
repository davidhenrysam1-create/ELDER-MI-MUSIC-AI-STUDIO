import { guard } from "@/lib/server/auth";
import { getProject } from "@/lib/server/repo";
import { patchProject } from "@/lib/server/repo";
import {
  assertAllowedExtension,
  extensionOf,
  mimeForExtension,
  sanitizeFileName,
  sha256,
  writeAudio,
} from "@/lib/server/storage";
import { getSettings } from "@/lib/server/repo";
import {
  asKind,
  asNumber,
  asRole,
  asString,
  jsonError,
  sanitizePeaks,
} from "@/lib/server/validation";
import type { AssetMeta } from "@/lib/types";
import { guessRoleFromName, makeTrack } from "@/lib/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * Upload one audio object into a project.
 *
 * Form fields:
 *  - file: the audio blob
 *  - meta: JSON with measured metadata (duration, sample rate, channels,
 *          bit depth, waveform peaks) captured in the browser after decoding.
 *  - createTrack: "true" to also add an editable mixer channel for the asset.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  const project = await getProject(id, auth.user.id);
  if (!project) return jsonError("Project not found", 404);

  const settings = await getSettings();
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Expected multipart/form-data");
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("No audio file was included");
  if (file.size === 0) return jsonError("The uploaded file is empty");

  const maxBytes = settings.maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return jsonError(
      `File is ${(file.size / 1048576).toFixed(1)} MB. The current limit is ${settings.maxUploadMb} MB.`,
      413,
    );
  }

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(asString(form.get("meta"), "{}", 200_000));
  } catch {
    meta = {};
  }

  const originalName = sanitizeFileName(
    asString(meta.name, file.name || "audio", 120) || "audio",
  );
  const ext = extensionOf(originalName) || extensionOf(file.name) || "";
  try {
    assertAllowedExtension(ext);
  } catch (err) {
    return jsonError((err as Error).message, 415);
  }

  const durationSec = asNumber(meta.durationSec, 0, 0, settings.maxDurationSec + 1);
  if (durationSec > settings.maxDurationSec) {
    return jsonError(
      `Audio is ${Math.round(durationSec)}s. The limit is ${settings.maxDurationSec}s per file.`,
      413,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const assetId = `ast_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await writeAudio(assetId, ext, bytes);

  const asset: AssetMeta = {
    id: assetId,
    projectId: id,
    name: originalName,
    kind: asKind(meta.kind),
    mimeType: mimeForExtension(ext),
    extension: ext,
    sizeBytes: bytes.byteLength,
    durationSec,
    sampleRate: Math.round(asNumber(meta.sampleRate, 48000, 8000, 384000)),
    channels: Math.round(asNumber(meta.channels, 2, 1, 8)),
    bitDepth: meta.bitDepth == null ? null : Math.round(asNumber(meta.bitDepth, 16, 8, 64)),
    peaks: sanitizePeaks(meta.peaks),
    engine: asString(meta.engine, "Uploaded audio", 120),
    derivedFromId: meta.derivedFromId ? asString(meta.derivedFromId, "", 60) : null,
    createdAt: new Date().toISOString(),
    sha256: sha256(bytes),
  };

  const createTrack = form.get("createTrack") === "true";
  // When the client does not send a role, infer it from the file name so mixer
  // channels start with a sensible name instead of "other".
  const role = meta.role == null ? guessRoleFromName(originalName) : asRole(meta.role);
  const trackName = asString(meta.trackName, originalName.replace(/\.[^.]+$/, ""), 80);

  const updated = await patchProject(id, (p) => {
    p.assets.unshift(asset);
    if (createTrack) {
      p.tracks.push(makeTrack(asset.id, trackName, role, p.tracks.length));
    }
    if (role === "lead_vocal" && !p.vocal.sourceAssetId) p.vocal.sourceAssetId = asset.id;
  });
  if (!updated) return jsonError("Project not found", 404);

  return Response.json({ asset, project: updated }, { status: 201 });
}
