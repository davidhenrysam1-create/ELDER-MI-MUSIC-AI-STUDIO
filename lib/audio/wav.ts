/** Minimal, spec-correct RIFF/WAVE encoder and header reader. */

export type WavBitDepth = 16 | 24 | 32;

function writeString(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  bitDepth: WavBitDepth = 24,
  dither = false,
): Uint8Array {
  const numChannels = channels.length;
  if (!numChannels) throw new Error("Cannot encode an empty audio buffer");
  const frames = channels[0].length;
  const bytesPerSample = bitDepth / 8;
  const dataBytes = frames * numChannels * bytesPerSample;
  // 44-byte canonical header (PCM) or 56-byte for float32.
  const isFloat = bitDepth === 32;
  const headerBytes = isFloat ? 44 + 12 : 44;
  const buffer = new ArrayBuffer(headerBytes + dataBytes);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + (isFloat ? 12 : 0) + dataBytes, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, isFloat ? 18 : 16, true);
  view.setUint16(20, isFloat ? 3 : 1, true); // 1 = PCM, 3 = IEEE float
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  if (isFloat) {
    view.setUint16(36, 0, true);
  }
  let offset = 36;
  if (isFloat) {
    writeString(view, 36, "fact");
    view.setUint32(40, 4, true);
    view.setUint32(44, frames, true);
    writeString(view, 48, "data");
    view.setUint32(52, dataBytes, true);
    offset = 56;
  } else {
    writeString(view, 36, "data");
    view.setUint32(40, dataBytes, true);
    offset = 44;
  }

  if (isFloat) {
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < numChannels; c++) {
        view.setFloat32(offset, channels[c][i], true);
        offset += 4;
      }
    }
    return new Uint8Array(buffer);
  }

  const maxVal = bitDepth === 16 ? 32767 : 8388607;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let v = channels[c][i];
      if (dither && bitDepth === 16) v += (Math.random() - Math.random()) / 32768;
      v = Math.max(-1, Math.min(1, v));
      const int = Math.round(v * maxVal);
      if (bitDepth === 16) {
        view.setInt16(offset, int, true);
        offset += 2;
      } else {
        const unsigned = int < 0 ? int + 0x1000000 : int;
        view.setUint8(offset, unsigned & 0xff);
        view.setUint8(offset + 1, (unsigned >> 8) & 0xff);
        view.setUint8(offset + 2, (unsigned >> 16) & 0xff);
        offset += 3;
      }
    }
  }
  return new Uint8Array(buffer);
}

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  audioFormat: number;
  frames: number;
}

/** Read bit depth / sample rate from a WAV header (browsers hide this after decoding). */
export function readWavInfo(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (tag !== "RIFF") return null;
  const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (wave !== "WAVE") return null;

  let offset = 12;
  let audioFormat = 1;
  let channels = 0;
  let sampleRate = 0;
  let bitDepth = 0;
  let frames = 0;

  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && body + 16 <= bytes.length) {
      audioFormat = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitDepth = view.getUint16(body + 14, true);
    } else if (id === "data") {
      const bytesPerSample = Math.max(1, bitDepth / 8);
      frames = Math.floor(size / (bytesPerSample * Math.max(1, channels)));
      break;
    }
    offset = body + size + (size % 2);
  }

  if (!sampleRate || !channels) return null;
  return { sampleRate, channels, bitDepth, audioFormat, frames };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
