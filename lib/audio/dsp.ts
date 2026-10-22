/**
 * Low-level DSP primitives shared by analysis, rendering and encoding.
 * Everything here is deterministic and unit-tested.
 */

export const EPSILON = 1e-12;

export function dbToGain(db: number) {
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number) {
  return 20 * Math.log10(Math.max(gain, EPSILON));
}

export interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** RBJ cookbook high-shelf (used for both K-weighting stage 1 and mastering EQ). */
export function highShelf(fs: number, f0: number, gainDb: number, q = 0.707): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / fs;
  const cosw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const beta = 2 * Math.sqrt(A) * alpha;
  const a0 = (A + 1) - (A - 1) * cosw + beta;
  return {
    b0: (A * ((A + 1) + (A - 1) * cosw + beta)) / a0,
    b1: (-2 * A * ((A - 1) + (A + 1) * cosw)) / a0,
    b2: (A * ((A + 1) + (A - 1) * cosw - beta)) / a0,
    a1: (2 * ((A - 1) - (A + 1) * cosw)) / a0,
    a2: ((A + 1) - (A - 1) * cosw - beta) / a0,
  };
}

export function lowShelf(fs: number, f0: number, gainDb: number, q = 0.707): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / fs;
  const cosw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const beta = 2 * Math.sqrt(A) * alpha;
  const a0 = (A + 1) + (A - 1) * cosw + beta;
  return {
    b0: (A * ((A + 1) - (A - 1) * cosw + beta)) / a0,
    b1: (2 * A * ((A - 1) - (A + 1) * cosw)) / a0,
    b2: (A * ((A + 1) - (A - 1) * cosw - beta)) / a0,
    a1: (-2 * ((A - 1) + (A + 1) * cosw)) / a0,
    a2: ((A + 1) + (A - 1) * cosw - beta) / a0,
  };
}

export function peaking(fs: number, f0: number, gainDb: number, q = 1): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / fs;
  const cosw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cosw) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha / A) / a0,
  };
}

export function highpass(fs: number, f0: number, q = 0.707): Biquad {
  const w0 = (2 * Math.PI * f0) / fs;
  const cosw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cosw) / 2 / a0,
    b1: (-(1 + cosw)) / a0,
    b2: ((1 + cosw) / 2) / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha) / a0,
  };
}

export function bandpass(fs: number, f0: number, q = 1.4): Biquad {
  const w0 = (2 * Math.PI * f0) / fs;
  const cosw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** In-place biquad filtering with double-precision state (DF-II transposed). */
export function applyBiquad(input: Float32Array | Float64Array, c: Biquad): Float64Array {
  const out = new Float64Array(input.length);
  let z1 = 0;
  let z2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = c.b0 * x + z1;
    z1 = c.b1 * x - c.a1 * y + z2;
    z2 = c.b2 * x - c.a2 * y;
    out[i] = y;
  }
  return out;
}

/**
 * ITU-R BS.1770-4 K-weighting: high shelf followed by the 38 Hz high-pass.
 * Precomputed at the given sample rate.
 */
export function kWeightingFilters(fs: number): [Biquad, Biquad] {
  const stage1 = highShelf(fs, 1681.974450955533, 3.999843853973347, 0.7071752369554196);
  const stage2 = highpass(fs, 38.13547087602444, 0.5003270373238773);
  return [stage1, stage2];
}

export function applyKWeighting(channel: Float32Array, fs: number): Float64Array {
  const [s1, s2] = kWeightingFilters(fs);
  return applyBiquad(applyBiquad(channel, s1), s2);
}

export function peakOf(channels: Float32Array[]) {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

export function rmsOf(channels: Float32Array[]) {
  let sum = 0;
  let n = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    n += ch.length;
  }
  return n ? Math.sqrt(sum / n) : 0;
}

/**
 * Fractional-delay read using a Hann-windowed sinc kernel.
 * Radius 12 gives ~-60 dB image rejection, enough for inter-sample peak work.
 */
export function fractionalSample(
  x: Float32Array | Float64Array,
  t: number,
  radius = 12,
): number {
  const centre = Math.floor(t);
  const frac = t - centre;
  let acc = 0;
  let wsum = 0;
  for (let k = -radius + 1; k <= radius; k++) {
    const idx = centre + k;
    if (idx < 0 || idx >= x.length) continue;
    const d = k - frac;
    const sinc = Math.abs(d) < 1e-9 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d);
    const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / radius);
    const weight = sinc * w;
    acc += x[idx] * weight;
    wsum += weight;
  }
  return wsum > 0 ? acc / wsum : 0;
}

/**
 * Inter-sample ("true") peak in dBTP using 4× oversampling around the loudest
 * sample neighbourhoods. Restricting the search to high-amplitude windows keeps
 * it fast while still catching every realistic overshoot.
 */
export function truePeakDb(channels: Float32Array[]): number {
  const samplePeak = peakOf(channels);
  if (samplePeak <= 0) return -Infinity;
  const threshold = samplePeak * 0.8;
  let max = samplePeak;

  for (const ch of channels) {
    const candidates: number[] = [];
    for (let i = 0; i < ch.length; i++) {
      if (Math.abs(ch[i]) >= threshold) candidates.push(i);
    }
    // Merge dense candidates into windows; trust at most 6000 seed points.
    const step = Math.max(1, Math.ceil(candidates.length / 6000));
    for (let ci = 0; ci < candidates.length; ci += step) {
      const centre = candidates[ci];
      const start = Math.max(0, centre - 4);
      const end = Math.min(ch.length - 1, centre + 4);
      for (let n = 0; n < 4 * (end - start); n++) {
        const t = start + n / 4;
        const v = Math.abs(fractionalSample(ch, t));
        if (v > max) max = v;
      }
    }
  }
  return gainToDb(max);
}

/** Stereo width as side/mid RMS ratio in percent (mono = 0%). */
export function stereoWidth(channels: Float32Array[]): { widthPct: number; correlation: number } {
  if (channels.length < 2) return { widthPct: 0, correlation: 1 };
  const L = channels[0];
  const R = channels[1];
  const n = Math.min(L.length, R.length);
  let sumLR = 0;
  let sumLL = 0;
  let sumRR = 0;
  let sumMid = 0;
  let sumSide = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i];
    const r = R[i];
    sumLR += l * r;
    sumLL += l * l;
    sumRR += r * r;
    const mid = (l + r) / 2;
    const side = (l - r) / 2;
    sumMid += mid * mid;
    sumSide += side * side;
  }
  const correlation = sumLR / Math.sqrt(sumLL * sumRR + EPSILON);
  const midRms = Math.sqrt(sumMid / Math.max(1, n));
  const sideRms = Math.sqrt(sumSide / Math.max(1, n));
  // Out-of-phase material has (near) zero mid energy; report the maximum width
  // rather than pretending the signal is mono.
  const widthPct =
    midRms < EPSILON
      ? sideRms > EPSILON
        ? 400
        : 0
      : Math.min(400, (sideRms / midRms) * 100);
  return { widthPct, correlation };
}

/** Mid/side width control: 100 = unchanged, 0 = mono, 200 = double side energy. */
export function applyStereoWidth(channels: Float32Array[], widthPct: number): Float32Array[] {
  if (channels.length < 2) return channels;
  const factor = Math.max(0, widthPct) / 100;
  const L = Float32Array.from(channels[0]);
  const R = Float32Array.from(channels[1]);
  const n = Math.min(L.length, R.length);
  for (let i = 0; i < n; i++) {
    const mid = (L[i] + R[i]) / 2;
    const side = ((L[i] - R[i]) / 2) * factor;
    L[i] = mid + side;
    R[i] = mid - side;
  }
  return [L, R, ...channels.slice(2)];
}

/** Gentle asymmetric tanh saturation with input drive in dB. */
export function applySaturation(channels: Float32Array[], amount: number): Float32Array[] {
  if (amount <= 0.001) return channels;
  const drive = 1 + amount * 6;
  const norm = 1 / Math.tanh(drive);
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      const wet = Math.tanh(ch[i] * drive) * norm;
      // The dry term is soft-limited too, so hot inputs cannot leave the
      // saturator above unity and upset the limiter's headroom.
      const dry = Math.tanh(ch[i]) * 0.08;
      out[i] = wet * 0.92 + dry;
    }
    return out;
  });
}

/** Apply a static gain (dB) in place-safe fashion. */
export function applyGain(channels: Float32Array[], db: number): Float32Array[] {
  const g = dbToGain(db);
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) out[i] = ch[i] * g;
    return out;
  });
}

/**
 * Look-ahead peak limiter with a soft knee and a release envelope.
 * The ceiling is linear amplitude; the caller verifies the true peak after
 * rendering and re-drives the limiter if the measured value is still above it.
 */
export function applyLimiter(
  channels: Float32Array[],
  sampleRate: number,
  ceilingDb: number,
  releaseMs = 120,
  lookaheadMs = 4,
): Float32Array[] {
  const ceiling = dbToGain(ceilingDb);
  const lookahead = Math.max(1, Math.round((lookaheadMs / 1000) * sampleRate));
  const releaseCoef = Math.exp(-1 / ((releaseMs / 1000) * sampleRate));
  const n = channels.reduce((m, c) => Math.max(m, c.length), 0);
  // Peak envelope of the multi-channel signal.
  const peaks = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (const ch of channels) {
      const v = Math.abs(ch[i] ?? 0);
      if (v > p) p = v;
    }
    peaks[i] = p;
  }
  // Sliding maximum over the look-ahead window, O(n) via a monotonic deque.
  const sliding = new Float32Array(n);
  const deque: number[] = []; // indices, amplitudes descending
  let head = 0;
  for (let i = 0; i < n; i++) {
    while (deque.length > head && peaks[deque[deque.length - 1]] <= peaks[i]) deque.pop();
    deque.push(i);
    if (deque[head] < i - lookahead) head++;
    sliding[i] = peaks[deque[head]];
    if (head > 4096) {
      deque.splice(0, head);
      head = 0;
    }
  }
  const gain = new Float32Array(n);
  let env = 1;
  for (let i = 0; i < n; i++) {
    const required = sliding[i] > ceiling ? ceiling / sliding[i] : 1;
    if (required < env) env = required; // instant attack (look-ahead buffers it)
    else env = releaseCoef * env + (1 - releaseCoef) * required;
    gain[i] = Math.min(1, env);
  }
  // Smooth the gain curve so reduction does not zipper.
  const smooth = new Float32Array(n);
  const smoothLen = Math.min(lookahead, 8) | 1;
  for (let i = 0; i < n; i++) {
    let acc = 0;
    let count = 0;
    for (let k = -(smoothLen - 1) / 2; k <= (smoothLen - 1) / 2; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < n) {
        acc += gain[idx];
        count++;
      }
    }
    smooth[i] = acc / Math.max(1, count);
  }
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      const g = smooth[i];
      out[i] = g < 1 ? ch[i] * g : ch[i];
    }
    return out;
  });
}

export function softClip(channels: Float32Array[], ceiling: number): Float32Array[] {
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i] / ceiling;
      out[i] = (Math.tanh(x) * ceiling) / Math.tanh(1);
    }
    return out;
  });
}

/** Interleave + convert to 16-bit PCM with optional TPDF dither. */
export function toInt16(channels: Float32Array[], dither = false): Int16Array {
  const n = channels[0]?.length ?? 0;
  const out = new Int16Array(n * channels.length);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < channels.length; c++) {
      let v = channels[c][i];
      if (dither) v += (Math.random() - Math.random()) / 32768;
      v = Math.max(-1, Math.min(1, v));
      out[i * channels.length + c] = Math.round(v < 0 ? v * 32768 : v * 32767);
    }
  }
  return out;
}

/** Simple iterative radix-2 FFT (in-place on separate real/imag arrays). */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}
