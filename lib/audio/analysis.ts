import type { Analysis, BandBalance } from "@/lib/types";
import {
  applyBiquad,
  applyKWeighting,
  bandpass,
  dbToGain,
  gainToDb,
  peakOf,
  rmsOf,
  stereoWidth,
  truePeakDb,
} from "@/lib/audio/dsp";

/**
 * Real audio measurement. Nothing in this module invents numbers: every value
 * is derived from the samples that were passed in.
 *
 * Loudness: ITU-R BS.1770-4 (K-weighting, 400 ms blocks, absolute + relative
 * gating). True peak: 4× oversampled sinc reconstruction. Band balance:
 * octave band-pass energy. All methods are named in `analysis.method`.
 */

export interface AudioChannels {
  channels: Float32Array[];
  sampleRate: number;
}

const ABSOLUTE_GATE = -70;
const BLOCK_MS = 400;
const HOP_MS = 100;
const SHORT_TERM_MS = 3000;

function blockPowers(
  weighted: Float64Array[],
  sampleRate: number,
  blockMs: number,
  hopMs: number,
): number[] {
  const block = Math.max(1, Math.round((blockMs / 1000) * sampleRate));
  const hop = Math.max(1, Math.round((hopMs / 1000) * sampleRate));
  const length = weighted[0]?.length ?? 0;
  if (length < block) return [];
  const out: number[] = [];
  for (let start = 0; start + block <= length; start += hop) {
    let sum = 0;
    for (const ch of weighted) {
      let s = 0;
      for (let i = 0; i < block; i++) {
        const v = ch[start + i];
        s += v * v;
      }
      sum += s / block;
    }
    out.push(sum);
  }
  return out;
}

const loudnessFromPower = (power: number) => -0.691 + 10 * Math.log10(Math.max(power, 1e-20));

/** Integrated gated loudness in LUFS. */
export function integratedLoudness(
  weightedChannels: Float64Array[],
  sampleRate: number,
): { integrated: number; shortTermMax: number; momentaryMax: number; lra: number } {
  const blocks = blockPowers(weightedChannels, sampleRate, BLOCK_MS, HOP_MS);
  if (!blocks.length) {
    return { integrated: -Infinity, shortTermMax: -Infinity, momentaryMax: -Infinity, lra: 0 };
  }
  const loudness = blocks.map(loudnessFromPower);
  const momentaryMax = Math.max(...loudness.filter((l) => l > ABSOLUTE_GATE), -Infinity);

  const firstGate: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (loudness[i] > ABSOLUTE_GATE) firstGate.push(blocks[i]);
  }
  if (!firstGate.length) {
    return { integrated: -Infinity, shortTermMax: -Infinity, momentaryMax, lra: 0 };
  }
  const meanFirst = firstGate.reduce((a, b) => a + b, 0) / firstGate.length;
  const relativeGate = loudnessFromPower(meanFirst) - 10;

  let sum = 0;
  let count = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (loudness[i] > ABSOLUTE_GATE && loudness[i] > relativeGate) {
      sum += blocks[i];
      count++;
    }
  }
  const integrated = count ? loudnessFromPower(sum / count) : -Infinity;

  // Short-term (3 s) loudness for range statistics.
  const shortBlocks = blockPowers(weightedChannels, sampleRate, SHORT_TERM_MS, HOP_MS);
  const shortLoudness = shortBlocks
    .map(loudnessFromPower)
    .filter((l) => l > ABSOLUTE_GATE)
    .sort((a, b) => a - b);
  const shortTermMax = shortLoudness.length ? shortLoudness[shortLoudness.length - 1] : -Infinity;
  let lra = 0;
  if (shortLoudness.length >= 4) {
    const at = (p: number) =>
      shortLoudness[Math.min(shortLoudness.length - 1, Math.max(0, Math.round(p * (shortLoudness.length - 1))))];
    lra = Math.max(0, at(0.95) - at(0.1));
  }

  return { integrated, shortTermMax, momentaryMax, lra };
}

/** Fast integrated-only measurement used inside the mastering feedback loop. */
export function measureIntegrated(channels: Float32Array[], sampleRate: number): number {
  const weighted = channels.map((c) => applyKWeighting(c, sampleRate));
  return integratedLoudness(weighted, sampleRate).integrated;
}

export function bandBalance(channels: Float32Array[], sampleRate: number): BandBalance {
  const mono = new Float32Array(channels[0].length);
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / channels.length;
  }
  const bands: { key: keyof BandBalance; centre: number; q: number }[] = [
    { key: "low", centre: 60, q: 1.1 },
    { key: "lowMid", centre: 250, q: 1.1 },
    { key: "mid", centre: 1000, q: 1.1 },
    { key: "highMid", centre: 3500, q: 1.1 },
    { key: "high", centre: 10000, q: 1.0 },
  ];
  const raw: Record<string, number> = {};
  let total = 0;
  for (const band of bands) {
    const filtered = applyBiquad(mono, bandpass(sampleRate, band.centre, band.q));
    let sum = 0;
    for (let i = 0; i < filtered.length; i++) sum += filtered[i] * filtered[i];
    const energy = Math.sqrt(sum / Math.max(1, filtered.length));
    raw[band.key] = energy;
    total += energy;
  }
  const safe = total > 0 ? total : 1;
  const pct = (v: number) => Math.round((v / safe) * 1000) / 10;
  return {
    low: pct(raw.low),
    lowMid: pct(raw.lowMid),
    mid: pct(raw.mid),
    highMid: pct(raw.highMid),
    high: pct(raw.high),
  };
}

export function analyzeBuffer(
  channels: Float32Array[],
  sampleRate: number,
  options: { bitDepth?: number | null; durationSec?: number; filePeakDb?: number } = {},
): Analysis {
  const usable = channels.filter((c) => c.length > 0);
  if (!usable.length) throw new Error("No audio samples to analyse");

  const weighted = usable.map((c) => applyKWeighting(c, sampleRate));
  const loudness = integratedLoudness(weighted, sampleRate);
  const peak = peakOf(usable);
  const rms = rmsOf(usable);
  const tp = truePeakDb(usable);
  const { widthPct, correlation } = stereoWidth(usable);
  const balance = bandBalance(usable, sampleRate);

  let clipping = 0;
  for (const ch of usable) {
    for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]) >= 0.9999) clipping++;
  }

  const peakDb = gainToDb(peak);
  const rmsDb = gainToDb(rms);
  const durationSec =
    options.durationSec ?? usable[0].length / Math.max(1, sampleRate);

  return {
    durationSec,
    sampleRate,
    channels: usable.length,
    bitDepth: options.bitDepth ?? null,
    integratedLufs: round(loudness.integrated, 1),
    shortTermMaxLufs: round(loudness.shortTermMax, 1),
    momentaryMaxLufs: round(loudness.momentaryMax, 1),
    loudnessRangeLu: round(loudness.lra, 1),
    truePeakDb: round(tp, 2),
    peakDb: round(peakDb, 2),
    rmsDb: round(rmsDb, 2),
    crestFactorDb: round(peakDb - rmsDb, 1),
    stereoWidthPct: round(widthPct, 0),
    correlation: round(correlation, 2),
    clippingSamples: clipping,
    bandBalance: balance,
    measuredAt: new Date().toISOString(),
    method:
      "ITU-R BS.1770-4 K-weighted gated loudness (400 ms blocks, 100 ms hop); true peak via 4× windowed-sinc interpolation; octave-band energy balance",
  };
}

function round(v: number, digits: number) {
  if (!Number.isFinite(v)) return v;
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/** Convert dBFS to a 0..1 display value for meters. */
export function dbToMeter(db: number, floor = -60) {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db - floor) / -floor));
}

/** Convert LUFS to a 0..1 display value (target window -24..-6). */
export function lufsToMeter(lufs: number) {
  if (!Number.isFinite(lufs)) return 0;
  return Math.max(0, Math.min(1, (lufs + 24) / 18));
}

export const dbToLinear = dbToGain;
