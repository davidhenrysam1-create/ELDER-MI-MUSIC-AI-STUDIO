import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AUDIO_DIR, EXPORT_DIR, storagePaths } from "@/lib/server/db";

/** Filesystem helpers for private audio objects. */

export const AUDIO_EXTENSIONS = ["wav", "mp3", "aiff", "aif", "flac", "ogg", "m4a"] as const;

export function safeId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function sanitizeFileName(name: string) {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  return base.slice(0, 120) || "audio";
}

export function extensionOf(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function assertAllowedExtension(ext: string) {
  if (!(AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(
      `Unsupported file type ".${ext || "unknown"}". Accepted: ${AUDIO_EXTENSIONS.map((e) => `.${e}`).join(", ")}.`,
    );
  }
}

const audioPath = (id: string, ext: string) => path.join(AUDIO_DIR, `${id}.${ext}`);

export async function writeAudio(assetId: string, ext: string, bytes: Uint8Array) {
  await storagePaths();
  const file = audioPath(assetId, ext);
  await fs.writeFile(file, bytes);
  return file;
}

export async function readAudio(assetId: string, ext: string) {
  const file = audioPath(assetId, ext);
  const data = await fs.readFile(file);
  return { data, file };
}

export async function deleteAudio(assetId: string, ext: string) {
  await fs.unlink(audioPath(assetId, ext)).catch(() => {});
}

export async function audioExists(assetId: string, ext: string) {
  try {
    await fs.access(audioPath(assetId, ext));
    return true;
  } catch {
    return false;
  }
}

export async function writeExport(storedName: string, bytes: Uint8Array) {
  await storagePaths();
  const file = path.join(EXPORT_DIR, storedName);
  await fs.writeFile(file, bytes);
  return file;
}

export async function readExport(storedName: string) {
  const safe = path.basename(storedName);
  const file = path.join(EXPORT_DIR, safe);
  return { data: await fs.readFile(file), file };
}

export function sha256(buf: Uint8Array) {
  return createHash("sha256").update(buf).digest("hex");
}

export function mimeForExtension(ext: string) {
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "aiff":
    case "aif":
      return "audio/aiff";
    case "flac":
      return "audio/flac";
    case "ogg":
      return "audio/ogg";
    case "m4a":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}
