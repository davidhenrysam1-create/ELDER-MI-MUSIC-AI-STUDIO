/** MP3 encoding via lamejs (runs in the browser, no server dependency). */

const SUPPORTED_RATES = [32000, 44100, 48000];

export function mp3SupportedRate(rate: number) {
  return SUPPORTED_RATES.includes(rate);
}

function toInt16(channel: Float32Array) {
  const out = new Int16Array(channel.length);
  for (let i = 0; i < channel.length; i++) {
    const v = Math.max(-1, Math.min(1, channel[i]));
    out[i] = Math.round(v < 0 ? v * 32768 : v * 32767);
  }
  return out;
}

export async function encodeMp3(
  channels: Float32Array[],
  sampleRate: number,
  kbps = 320,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  if (!mp3SupportedRate(sampleRate)) {
    throw new Error(
      `MP3 encoding supports 32/44.1/48 kHz. Set the export sample rate to 44.1 or 48 kHz (current: ${sampleRate} Hz).`,
    );
  }
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(Math.min(2, channels.length), sampleRate, kbps);
  const left = toInt16(channels[0]);
  const right = channels.length > 1 ? toInt16(channels[1]) : undefined;
  const blockSize = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right ? right.subarray(i, i + blockSize) : undefined;
    const buf = r ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (buf.length) chunks.push(new Uint8Array(buf));
    if (onProgress && (i / blockSize) % 120 === 0) {
      onProgress(Math.round((i / left.length) * 100));
      await new Promise((r2) => setTimeout(r2, 0));
    }
  }
  const end = encoder.flush();
  if (end.length) chunks.push(new Uint8Array(end));
  onProgress?.(100);

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
