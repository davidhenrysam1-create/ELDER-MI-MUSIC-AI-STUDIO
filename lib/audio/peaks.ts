/** Waveform envelope extraction for canvas rendering (never stores raw audio). */
export function extractPeaks(channels: Float32Array[], bins = 1200): number[] {
  if (!channels.length || !channels[0].length) return [];
  const length = channels[0].length;
  const bucket = Math.max(1, Math.ceil(length / bins));
  const peaks: number[] = [];
  for (let bin = 0; bin < bins; bin++) {
    const start = bin * bucket;
    if (start >= length) break;
    const end = Math.min(length, start + bucket);
    let peak = 0;
    for (const ch of channels) {
      for (let i = start; i < end; i++) {
        const v = Math.abs(ch[i]);
        if (v > peak) peak = v;
      }
    }
    peaks.push(Math.round(peak * 1000) / 1000);
  }
  // Normalise so quiet material still renders a visible shape.
  const max = peaks.reduce((m, p) => Math.max(m, p), 0);
  if (max > 0 && max < 0.9) return peaks.map((p) => Math.min(1, p / max));
  return peaks.map((p) => Math.min(1, p));
}

export function slicePeaks(peaks: number[], startSec: number, endSec: number, durationSec: number) {
  if (!peaks.length || durationSec <= 0) return peaks;
  const a = Math.max(0, Math.min(1, startSec / durationSec));
  const b = Math.max(0, Math.min(1, endSec / durationSec));
  return peaks.slice(Math.floor(a * peaks.length), Math.max(Math.floor(a * peaks.length) + 1, Math.floor(b * peaks.length)));
}
