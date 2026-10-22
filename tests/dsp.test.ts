import { describe, expect, it } from "vitest";
import {
  applyBiquad,
  applyLimiter,
  applySaturation,
  applyStereoWidth,
  dbToGain,
  gainToDb,
  highShelf,
  kWeightingFilters,
  peakOf,
  stereoWidth,
  truePeakDb,
} from "@/lib/audio/dsp";
import { analyzeBuffer, integratedLoudness } from "@/lib/audio/analysis";
import { encodeWav, readWavInfo } from "@/lib/audio/wav";
import { pitchShift, timeStretch } from "@/lib/audio/pitch";

const SR = 48000;

function sine(
  durationSec: number,
  freq: number,
  amplitude: number,
  sampleRate = SR,
  startPhase = 0,
): Float32Array {
  const length = Math.round(durationSec * sampleRate);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate + startPhase);
  }
  return out;
}

function estimateFrequency(signal: Float32Array, sampleRate: number) {
  // Zero-crossing estimate over the middle 60% of the signal.
  const start = Math.floor(signal.length * 0.2);
  const end = Math.floor(signal.length * 0.8);
  let crossings = 0;
  for (let i = start + 1; i < end; i++) {
    if (signal[i - 1] <= 0 && signal[i] > 0) crossings++;
  }
  const seconds = (end - start) / sampleRate;
  return crossings / seconds;
}

describe("gain helpers", () => {
  it("converts between dB and linear gain", () => {
    expect(dbToGain(0)).toBeCloseTo(1, 8);
    expect(dbToGain(-6)).toBeCloseTo(0.5012, 3);
    expect(gainToDb(0.5)).toBeCloseTo(-6.02, 1);
    expect(gainToDb(0)).toBeLessThan(-200);
  });
});

describe("K-weighting + loudness", () => {
  it("produces EBU-style LKFS for a 1 kHz stereo reference tone", () => {
    // EBU Tech 3341 test 1: 1 kHz, -23 dBFS in both channels ≈ -23.0 LUFS.
    const amplitude = dbToGain(-23);
    const left = sine(3, 1000, amplitude);
    const right = sine(3, 1000, amplitude);
    const [stage1, stage2] = kWeightingFilters(SR);
    const wl = applyBiquad(applyBiquad(left, stage1), stage2);
    const wr = applyBiquad(applyBiquad(right, stage1), stage2);
    const { integrated } = integratedLoudness([wl, wr], SR);
    expect(integrated).toBeGreaterThan(-23.6);
    expect(integrated).toBeLessThan(-22.4);
  });

  it("is quieter for lower amplitudes", () => {
    const loud = analyzeBuffer([sine(2, 440, dbToGain(-12)), sine(2, 440, dbToGain(-12))], SR);
    const quiet = analyzeBuffer([sine(2, 440, dbToGain(-24)), sine(2, 440, dbToGain(-24))], SR);
    expect(loud.integratedLufs).toBeGreaterThan(quiet.integratedLufs + 8);
  });

  it("measures loudness range and stereo width from real signals", () => {
    const mono = sine(3, 220, 0.3);
    const analysis = analyzeBuffer([mono, mono], SR);
    expect(analysis.stereoWidthPct).toBeLessThan(1);
    expect(analysis.correlation).toBeGreaterThan(0.99);

    const right = sine(3, 220, 0.3, SR, Math.PI);
    const wide = analyzeBuffer([mono, right], SR);
    expect(wide.stereoWidthPct).toBeGreaterThan(50);
    expect(wide.correlation).toBeLessThan(-0.9);
  });

  it("detects clipping samples and reports honest technical metadata", () => {
    const clipped = new Float32Array(SR);
    clipped.fill(1);
    const analysis = analyzeBuffer([clipped], SR, { bitDepth: 16 });
    expect(analysis.clippingSamples).toBeGreaterThan(0);
    expect(analysis.bitDepth).toBe(16);
    expect(analysis.sampleRate).toBe(SR);
    expect(analysis.method).toContain("BS.1770");
  });
});

describe("true peak", () => {
  it("never reports below the sample peak", () => {
    const tone = sine(1, 997, 0.9);
    const tp = truePeakDb([tone]);
    const peak = gainToDb(peakOf([tone]));
    expect(tp).toBeGreaterThanOrEqual(peak - 0.01);
  });

  it("catches inter-sample overshoot on a phase-offset loud tone", () => {
    const a = sine(1, 11000, 0.95);
    const b = sine(1, 11000, 0.95, SR, Math.PI / 3);
    const tp = truePeakDb([a, b]);
    const peak = gainToDb(peakOf([a, b]));
    expect(tp).toBeGreaterThan(peak);
    expect(tp).toBeLessThan(3);
  });
});

describe("processing", () => {
  it("keeps the limiter below the requested ceiling", () => {
    const loud = sine(1, 200, 1.4);
    const limited = applyLimiter([loud, loud], SR, -1, 100);
    const peakDb = gainToDb(peakOf(limited));
    expect(peakDb).toBeLessThanOrEqual(-0.5);
    expect(truePeakDb(limited)).toBeLessThanOrEqual(0);
  });

  it("collapses a stereo signal to mono at 0% width", () => {
    const left = sine(1, 300, 0.4);
    const right = sine(1, 500, 0.4);
    const [l, r] = applyStereoWidth([left, right], 0);
    for (let i = 0; i < 1000; i += 97) expect(l[i]).toBeCloseTo(r[i], 5);
  });

  it("does not produce NaN from saturation", () => {
    const tone = sine(0.2, 100, 3);
    const [out] = applySaturation([tone], 0.8);
    expect(out.every((v) => Number.isFinite(v))).toBe(true);
    expect(Math.max(...out)).toBeLessThan(1.1);
  });

  it("applies high-shelf gain in the expected direction", () => {
    const tone = sine(1, 9000, 0.2);
    const boosted = applyBiquad(tone, highShelf(SR, 8500, 3));
    const before = Math.max(...tone);
    const after = Math.max(...Array.from(boosted));
    expect(after).toBeGreaterThan(before);
  });
});

describe("WAV encoding", () => {
  it("round-trips header metadata for 16 and 24 bit", () => {
    const channels = [sine(0.25, 440, 0.5), sine(0.25, 440, 0.5)];
    for (const bits of [16, 24] as const) {
      const bytes = encodeWav(channels, SR, bits, false);
      const info = readWavInfo(bytes);
      expect(info).not.toBeNull();
      expect(info?.bitDepth).toBe(bits);
      expect(info?.sampleRate).toBe(SR);
      expect(info?.channels).toBe(2);
      expect(info?.frames).toBe(channels[0].length);
      const expectedData = channels[0].length * 2 * (bits / 8);
      expect(bytes.byteLength).toBe(44 + expectedData);
    }
  });

  it("encodes 32-bit float with a fact chunk", () => {
    const bytes = encodeWav([sine(0.1, 220, 0.2)], SR, 32);
    const info = readWavInfo(bytes);
    expect(info?.audioFormat).toBe(3);
    expect(info?.bitDepth).toBe(32);
  });
});

describe("pitch shifting", () => {
  it("preserves duration and raises the measured pitch", () => {
    const tone = sine(1, 220, 0.4);
    const up = pitchShift(tone, 12);
    expect(up.length).toBe(tone.length);
    const before = estimateFrequency(tone, SR);
    const after = estimateFrequency(up, SR);
    expect(before).toBeGreaterThan(210);
    expect(before).toBeLessThan(230);
    // One octave is a 2x ratio; allow granular-engine tolerance.
    expect(after / before).toBeGreaterThan(1.75);
    expect(after / before).toBeLessThan(2.25);
  });

  it("returns an identity copy for zero semitones", () => {
    const tone = sine(0.2, 440, 0.3);
    const same = pitchShift(tone, 0, 0);
    expect(same.length).toBe(tone.length);
    for (let i = 0; i < 100; i++) expect(same[i]).toBeCloseTo(tone[i], 5);
  });

  it("stretches to the requested length", () => {
    const tone = sine(1, 330, 0.3);
    const stretched = timeStretch(tone, 1000);
    expect(stretched.length).toBe(1000);
    expect(stretched.every((v) => Number.isFinite(v))).toBe(true);
  });
});
