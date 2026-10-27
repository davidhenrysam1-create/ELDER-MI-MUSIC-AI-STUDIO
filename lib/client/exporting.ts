"use client";

import { encodeChannels } from "@/lib/audio/render";
import type { Analysis, ExportRecord, Project, StudioId } from "@/lib/types";

export type ExportFormat = "wav24" | "wav16" | "wav32" | "mp3_320";

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function sanitizeForFileName(name: string) {
  return name.replace(/[^\w\- .]+/g, "").replace(/\s+/g, "_").slice(0, 70) || "ElderMi_Export";
}

/**
 * Encode PCM, store it on the server (so Export History stays downloadable) and
 * trigger the browser download. Only measured values are recorded.
 */
export async function exportChannels({
  channels,
  sampleRate,
  format,
  project,
  studio,
  assetId,
  label,
  analysis,
  saveExport,
  onProgress,
  dither = true,
}: {
  channels: Float32Array[];
  sampleRate: number;
  format: ExportFormat;
  project: Project;
  studio: StudioId;
  assetId: string | null;
  label: string;
  analysis?: Analysis | null;
  saveExport: (blob: Blob, meta: Record<string, unknown>) => Promise<ExportRecord>;
  onProgress?: (pct: number, stage: string) => void;
  dither?: boolean;
}): Promise<ExportRecord> {
  const encoded = await encodeChannels(
    channels,
    sampleRate,
    format,
    (pct) => onProgress?.(pct, "Encoding audio"),
    { dither },
  );
  const safeLabel = sanitizeForFileName(label);
  const fileName = `${safeLabel}.${encoded.extension}`;
  const blob = new Blob([new Uint8Array(encoded.bytes)], { type: encoded.mimeType });

  onProgress?.(96, "Storing export privately");
  const record = await saveExport(blob, {
    projectId: project.id,
    format: encoded.extension === "mp3" ? "MP3" : "WAV",
    bitDepth: encoded.bitDepth,
    sampleRate,
    fileName,
    studio,
    assetId,
    durationSec: channels[0].length / sampleRate,
    integratedLufs: analysis?.integratedLufs ?? null,
    truePeakDb: analysis?.truePeakDb ?? null,
  });

  downloadBlob(blob, fileName);
  onProgress?.(100, `${encoded.label} ready`);
  return record;
}
