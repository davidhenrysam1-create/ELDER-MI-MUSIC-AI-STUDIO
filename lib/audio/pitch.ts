/**
 * Time-domain pitch shifting (resample + overlap-add time stretch).
 *
 * This is a deliberately transparent local DSP engine: it produces usable
 * harmonic/double/choir layers from a real recording, and it does not claim to
 * be a neural singing-synthesis model.
 */

function resampleLinear(input: Float32Array, targetLength: number): Float32Array {
  if (targetLength <= 0) return new Float32Array(0);
  const out = new Float32Array(targetLength);
  const ratio = (input.length - 1) / Math.max(1, targetLength - 1);
  for (let i = 0; i < targetLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

const FRAME = 2048;
const SYNTH_HOP = 1024;

/** Overlap-add stretch (Hann window, 50% overlap). */
export function timeStretch(input: Float32Array, targetLength: number): Float32Array {
  if (!input.length || targetLength <= 0) return new Float32Array(Math.max(0, targetLength));
  if (Math.abs(targetLength - input.length) < 2) return Float32Array.from(input);

  const out = new Float32Array(targetLength + FRAME);
  const window = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME);

  const analysisHop = (SYNTH_HOP * input.length) / targetLength;
  const frames = Math.ceil(targetLength / SYNTH_HOP) + 1;
  for (let f = 0; f < frames; f++) {
    const inPos = Math.floor(f * analysisHop);
    const outPos = f * SYNTH_HOP;
    for (let i = 0; i < FRAME; i++) {
      const src = inPos + i;
      const dst = outPos + i;
      if (src >= input.length || dst >= out.length) break;
      out[dst] += input[src] * window[i];
    }
  }
  return out.slice(0, targetLength);
}

/** Shift pitch by semitones while preserving duration. */
export function pitchShift(
  channel: Float32Array,
  semitones: number,
  cents = 0,
): Float32Array {
  const ratio = Math.pow(2, (semitones + cents / 100) / 12);
  if (Math.abs(ratio - 1) < 1e-5) return Float32Array.from(channel);
  const intermediateLength = Math.max(1, Math.round(channel.length / ratio));
  const resampled = resampleLinear(channel, intermediateLength);
  return timeStretch(resampled, channel.length);
}

/** Small Schroeder-style reverb (used to seat backing layers behind the lead). */
export function simpleReverb(
  channels: Float32Array[],
  sampleRate: number,
  wet: number,
  decay = 0.55,
): Float32Array[] {
  if (wet <= 0) return channels;
  const combDelays = [0.0297, 0.0371, 0.0411, 0.0437].map((s) =>
    Math.max(1, Math.round(s * sampleRate)),
  );
  const allpassDelay = Math.max(1, Math.round(0.005 * sampleRate));
  return channels.map((ch, chIndex) => {
    const out = new Float32Array(ch.length);
    const combBuffers = combDelays.map((d) => new Float32Array(d + chIndex * 3));
    const combPos = combDelays.map(() => 0);
    const apBuffer = new Float32Array(allpassDelay);
    let apPos = 0;

    for (let i = 0; i < ch.length; i++) {
      let wetSum = 0;
      for (let c = 0; c < combDelays.length; c++) {
        const buf = combBuffers[c];
        const pos = combPos[c];
        const delayed = buf[pos];
        buf[pos] = ch[i] + delayed * decay;
        combPos[c] = (pos + 1) % buf.length;
        wetSum += delayed;
      }
      wetSum /= combDelays.length;
      const apDelayed = apBuffer[apPos];
      const apOut = -wetSum * 0.5 + apDelayed;
      apBuffer[apPos] = wetSum + apDelayed * 0.5;
      apPos = (apPos + 1) % apBuffer.length;
      out[i] = ch[i] * (1 - wet) + apOut * wet * 2.2;
    }
    return out;
  });
}

/** One-pole low-pass to push a layer behind the lead. */
export function lowPass(channel: Float32Array, sampleRate: number, cutoffHz: number): Float32Array {
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);
  const out = new Float32Array(channel.length);
  let prev = 0;
  for (let i = 0; i < channel.length; i++) {
    prev += alpha * (channel[i] - prev);
    out[i] = prev;
  }
  return out;
}

export function delayChannel(channel: Float32Array, samples: number): Float32Array {
  const out = new Float32Array(channel.length);
  if (samples <= 0) {
    out.set(channel);
    return out;
  }
  out.set(channel.subarray(0, channel.length - samples), samples);
  return out;
}

/** Equal-power pan of a mono source into a stereo pair. */
export function panMonoToStereo(mono: Float32Array, pan: number): [Float32Array, Float32Array] {
  const clamped = Math.max(-1, Math.min(1, pan));
  const angle = ((clamped + 1) / 2) * (Math.PI / 2);
  const lg = Math.cos(angle);
  const rg = Math.sin(angle);
  const L = new Float32Array(mono.length);
  const R = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    L[i] = mono[i] * lg;
    R[i] = mono[i] * rg;
  }
  return [L, R];
}

export function mixInto(target: Float32Array[], source: Float32Array[], gain: number) {
  const targetLength = target[0].length;
  for (let c = 0; c < Math.min(target.length, source.length); c++) {
    const t = target[c];
    const s = source[c];
    const n = Math.min(t.length, s.length, targetLength);
    for (let i = 0; i < n; i++) t[i] += s[i] * gain;
  }
}
