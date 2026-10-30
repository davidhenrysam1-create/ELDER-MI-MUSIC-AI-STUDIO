import { createHash, randomUUID } from "node:crypto";
import { blobStore } from "@/lib/server/drivers";

/**
 * Private audio objects.
 *
 * Every read and write goes through the configured blob driver
 * (`lib/server/drivers`): this machine's disk by default, or a private Supabase
 * bucket once `SUPABASE_URL` and a service-role key are set. Route handlers do
 * not know or care which one is in use, and the keys are the same either way
 * (`audio/<id>.<ext>`, `exports/<name>`) so a migration is a straight copy.
 */

/** Key for one uploaded asset. */
const audioKey = (assetId: string, ext: string) => `audio/${assetId}.${ext}`;
/** Key for one rendered export. */
const exportKey = (storedName: string) => `exports/${storedName}`;

export const AUDIO_EXTENSIONS = ["wav", "mp3", "aiff", "aif", "flac", "ogg", "m4a"] as const;

export function safeId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function sanitizeFileName(name: string) {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  return base.slice(0, 120) || "audio";
}

/** Strip any directory part, so a stored name can never escape its prefix. */
export function safeName(storedName: string) {
  return storedName.replace(/\\/g, "/").split("/").pop() || "export";
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

export async function writeAudio(assetId: string, ext: string, bytes: Uint8Array) {
  const key = audioKey(assetId, ext);
  await blobStore().put(key, bytes, mimeForExtension(ext));
  return key;
}

export async function readAudio(assetId: string, ext: string) {
  const key = audioKey(assetId, ext);
  const found = await blobStore().get(key);
  if (!found) {
    // A missing object is not an empty file: say so and let the route answer 404.
    throw new Error(`Audio object ${key} is missing from ${blobStore().label}.`);
  }
  return { data: found.data, file: found.key };
}

export async function deleteAudio(assetId: string, ext: string) {
  await blobStore().remove(audioKey(assetId, ext));
}

export async function audioExists(assetId: string, ext: string) {
  return blobStore().exists(audioKey(assetId, ext));
}

export async function writeExport(storedName: string, bytes: Uint8Array) {
  const key = exportKey(safeName(storedName));
  await blobStore().put(key, bytes, mimeForExtension(extensionOf(storedName)));
  return key;
}

export async function readExport(storedName: string) {
  const key = exportKey(safeName(storedName));
  const found = await blobStore().get(key);
  if (!found) throw new Error(`Export ${key} is missing from ${blobStore().label}.`);
  return { data: found.data, file: found.key };
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
