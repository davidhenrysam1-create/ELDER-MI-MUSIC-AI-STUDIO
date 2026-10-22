"use client";

import JSZip from "jszip";

const AUDIO_RE = /\.(wav|aiff?|flac|mp3|ogg|m4a)$/i;
const DAW_RE = /\.(flp|cpr|als|logicx|ptx|rpp|reason|dawproject)$/i;
const MAX_FILES = 32;
const MAX_TOTAL_BYTES = 320 * 1024 * 1024;

export function detectUnsupportedPackage(name: string): string | null {
  if (DAW_RE.test(name)) {
    return `${name} is a native DAW project. It cannot be reconstructed here because it depends on plugins, virtual instruments and external audio. Export consolidated stems instead — see "FL Studio & Cubase stems".`;
  }
  if (/\.(mid|midi)$/i.test(name)) {
    return `${name} is MIDI data, not audio. Render your MIDI to WAV stems in your DAW, then upload those.`;
  }
  if (/\.(rar|7z)$/i.test(name)) {
    return `${name} uses an archive format the browser cannot unpack. Re-zip as .zip or upload the stems individually.`;
  }
  return null;
}

/** Expand a ZIP of stems into individual audio files (browser-side, no server unpack). */
export async function extractZipStems(
  file: File,
): Promise<{ files: File[]; skipped: string[] }> {
  if (file.size > MAX_TOTAL_BYTES) {
    throw new Error(
      `The archive is ${(file.size / 1048576).toFixed(0)} MB; the limit is ${MAX_TOTAL_BYTES / 1048576} MB.`,
    );
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error(`${file.name} is not a readable ZIP archive.`);
  }
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  const audioEntries = entries.filter((e) => AUDIO_RE.test(e.name));
  const skipped = entries.filter((e) => !AUDIO_RE.test(e.name)).map((e) => e.name);
  if (!audioEntries.length) {
    throw new Error(
      "The ZIP contains no supported audio files. Include WAV/AIFF/FLAC/MP3 stems and try again.",
    );
  }
  if (audioEntries.length > MAX_FILES) {
    throw new Error(`The ZIP contains ${audioEntries.length} files; import at most ${MAX_FILES} at a time.`);
  }
  const files: File[] = [];
  for (const entry of audioEntries) {
    const blob = await entry.async("blob");
    const name = entry.name.split("/").pop() ?? entry.name;
    files.push(new File([blob], name, { type: blob.type || "audio/wav" }));
  }
  return { files, skipped };
}
