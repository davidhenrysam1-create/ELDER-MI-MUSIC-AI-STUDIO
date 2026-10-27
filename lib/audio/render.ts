import type { MasteringControls, StemRole } from "@/lib/types";
import { analyzeBuffer, measureIntegrated } from "@/lib/audio/analysis";
import {
  applyGain,
  applyLimiter,
  applySaturation,
  dbToGain,
  truePeakDb,
} from "@/lib/audio/dsp";
import { encodeWav, type WavBitDepth } from "@/lib/audio/wav";
import { encodeMp3 } from "@/lib/audio/mp3";

/**
 * Offline rendering.
 *
 * Native Web Audio nodes handle EQ, dynamics, sends, panning and summing;
 * a post pass in JavaScript applies saturation, stereo width, limiting and
 * true-peak verification. The measured result is always reported back so the
 * UI cannot display an unverified "mastered" value.
 */

export interface RenderTrackInput {
  buffer: AudioBuffer;
  role: StemRole;
  name: string;
  volumeDb: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  eqLowDb: number;
  eqMidDb: number;
  eqHighDb: number;
  compThresholdDb: number;
  compRatio: number;
  reverbSend: number;
  delaySend: number;
  width: number;
}

export interface MixRenderResult {
  channels: Float32Array[];
  sampleRate: number;
  durationSec: number;
  applied: string[];
  truePeakDb: number;
  integratedLufs: number;
}

function makeImpulseResponse(ctx: BaseAudioContext, seconds = 2.2, decay = 3.2) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Decorrelate the channels slightly for a wide plate character.
      const noise = Math.random() * 2 - 1;
      data[i] = noise * Math.pow(1 - t, decay) * (i < rate * 0.01 ? i / (rate * 0.01) : 1);
    }
  }
  return impulse;
}

export function channelsToAudioBuffer(
  ctx: BaseAudioContext,
  channels: Float32Array[],
  sampleRate = ctx.sampleRate,
): AudioBuffer {
  const frames = Math.max(1, ...channels.map((ch) => ch.length));
  // Keep the source's own rate: a BufferSource resamples it to the render rate.
  // Copying 44.1 kHz samples into a 48 kHz buffer would change the pitch.
  const buffer = ctx.createBuffer(Math.max(1, channels.length), frames, sampleRate);
  channels.forEach((ch, i) => {
    const dest = buffer.getChannelData(i);
    dest.set(ch.subarray(0, frames));
  });
  return buffer;
}

export async function renderMix(
  tracks: RenderTrackInput[],
  sampleRate: number,
  options: {
    outputGainDb?: number;
    ceilingDb?: number;
    onProgress?: (pct: number, stage: string) => void;
  } = {},
): Promise<MixRenderResult> {
  const audible = tracks.filter((t) => t.buffer && !t.muted && t.buffer.length > 0);
  const anySolo = audible.some((t) => t.soloed);
  const selected = anySolo ? audible.filter((t) => t.soloed) : audible;
  if (!selected.length) {
    throw new Error(
      "No tracks are audible. Add stems and make sure nothing needed is muted or soloed.",
    );
  }

  const durationSec = selected.reduce((m, t) => Math.max(m, t.buffer.duration), 0);
  const frames = Math.max(1, Math.round(durationSec * sampleRate));
  const ctx = new OfflineAudioContext(2, frames, sampleRate);

  const master = ctx.createGain();
  master.gain.value = dbToGain(options.outputGainDb ?? 0);
  master.connect(ctx.destination);

  // Shared FX buses.
  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulseResponse(ctx);
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.9;
  reverb.connect(reverbReturn).connect(master);

  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.28;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const delayReturn = ctx.createGain();
  delayReturn.gain.value = 0.7;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = "lowpass";
  delayFilter.frequency.value = 3800;
  delay.connect(delayFilter).connect(feedback).connect(delay);
  delayFilter.connect(delayReturn).connect(master);

  const applied: string[] = ["Channel gain & equal-power panning", "3-band EQ per channel"];
  if (selected.some((t) => t.compRatio > 1.01)) applied.push("Channel compression");
  if (selected.some((t) => t.reverbSend > 0.001)) applied.push("Plate reverb send");
  if (selected.some((t) => t.delaySend > 0.001)) applied.push("Tempo delay send");
  if (selected.some((t) => Math.abs(t.width - 1) > 0.01)) applied.push("Per-channel stereo width");

  selected.forEach((track, index) => {
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;

    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 120;
    low.gain.value = track.eqLowDb;

    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 1.1;
    mid.gain.value = track.eqMidDb;

    const high = ctx.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 8000;
    high.gain.value = track.eqHighDb;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = Math.max(-100, Math.min(0, track.compThresholdDb));
    comp.ratio.value = Math.max(1, Math.min(20, track.compRatio));
    comp.attack.value = 0.012;
    comp.release.value = 0.16;
    comp.knee.value = 8;

    const gain = ctx.createGain();
    gain.gain.value = dbToGain(track.volumeDb);

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, track.pan));

    source.connect(low).connect(mid).connect(high).connect(comp).connect(gain);

    // Mid/side width matrix (native nodes, so no extra JS pass).
    const width = Math.max(0, Math.min(2, track.width));
    let tail: AudioNode = gain;
    if (width !== 1) {
      const splitter = ctx.createChannelSplitter(2);
      const merger = ctx.createChannelMerger(2);
      const gLL = ctx.createGain();
      const gLR = ctx.createGain();
      const gRL = ctx.createGain();
      const gRR = ctx.createGain();
      gLL.gain.value = (1 + width) / 2;
      gLR.gain.value = (1 - width) / 2;
      gRL.gain.value = (1 - width) / 2;
      gRR.gain.value = (1 + width) / 2;
      gain.connect(splitter);
      splitter.connect(gLL, 0);
      splitter.connect(gRL, 0);
      splitter.connect(gLR, 1);
      splitter.connect(gRR, 1);
      gLL.connect(merger, 0, 0);
      gRL.connect(merger, 0, 0);
      gLR.connect(merger, 0, 1);
      gRR.connect(merger, 0, 1);
      tail = merger;
      tail.connect(panner);
    } else {
      gain.connect(panner);
    }
    panner.connect(master);

    if (track.reverbSend > 0.001) {
      const send = ctx.createGain();
      send.gain.value = track.reverbSend * 0.8;
      panner.connect(send).connect(reverb);
    }
    if (track.delaySend > 0.001) {
      const send = ctx.createGain();
      send.gain.value = track.delaySend * 0.6;
      panner.connect(send).connect(delay);
    }

    source.start(0);
    options.onProgress?.(
      Math.round(((index + 1) / selected.length) * 55),
      `Preparing ${track.name}`,
    );
  });

  options.onProgress?.(60, "Rendering mix");
  const rendered = await ctx.startRendering();
  options.onProgress?.(85, "Verifying peak level");

  let channels: Float32Array[] = [rendered.getChannelData(0), rendered.getChannelData(1)];
  const ceiling = options.ceilingDb ?? -1;
  channels = applyLimiter(channels, sampleRate, ceiling, 140);
  let tp = truePeakDb(channels);
  if (tp > ceiling + 0.05) {
    channels = applyGain(channels, ceiling - tp);
    tp = truePeakDb(channels);
  }
  applied.push(`True-peak safety limiter (ceiling ${ceiling.toFixed(1)} dBTP)`);

  const integrated = measureIntegrated(channels, sampleRate);
  options.onProgress?.(100, "Mix rendered");

  return {
    channels,
    sampleRate,
    durationSec,
    applied,
    truePeakDb: tp,
    integratedLufs: integrated,
  };
}

export interface MasterRenderOptions {
  controls: MasteringControls;
  sampleRate: number;
  onProgress?: (pct: number, stage: string) => void;
}

export interface MasterRenderResult {
  channels: Float32Array[];
  sampleRate: number;
  applied: string[];
  measured: ReturnType<typeof analyzeBuffer>;
  notes: string[];
}

export async function renderMaster(
  source: Float32Array[],
  sourceRate: number,
  options: MasterRenderOptions,
): Promise<MasterRenderResult> {
  if (!source.length || !source[0]?.length) throw new Error("No audio to master");
  const { controls } = options;
  const sampleRate = options.sampleRate;

  const frames = Math.max(1, Math.round((source[0].length / sourceRate) * sampleRate));
  const ctx = new OfflineAudioContext(2, frames, sampleRate);
  const decodedSource = channelsToAudioBuffer(ctx, source, sourceRate);
  const src = ctx.createBufferSource();
  src.buffer = decodedSource;

  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 90;
  low.gain.value = controls.lowShelfDb;

  const mud = ctx.createBiquadFilter();
  mud.type = "peaking";
  mud.frequency.value = 320;
  mud.Q.value = 0.9;
  mud.gain.value = -Math.max(0, controls.lowShelfDb) * 0.35;

  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 8500;
  high.gain.value = controls.highShelfDb;

  const glue = ctx.createDynamicsCompressor();
  const density = 1 - Math.min(1, Math.max(0, controls.dynamicPreservation));
  glue.threshold.value = -16 - density * 6;
  glue.ratio.value = 1.3 + density * 2.4;
  glue.attack.value = 0.03;
  glue.release.value = 0.25;
  glue.knee.value = 10;

  const width = Math.max(0, Math.min(2, controls.stereoWidthPct / 100));
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const gLL = ctx.createGain();
  const gLR = ctx.createGain();
  const gRL = ctx.createGain();
  const gRR = ctx.createGain();
  gLL.gain.value = (1 + width) / 2;
  gLR.gain.value = (1 - width) / 2;
  gRL.gain.value = (1 - width) / 2;
  gRR.gain.value = (1 + width) / 2;

  const out = ctx.createGain();
  src.connect(low).connect(mud).connect(high).connect(glue).connect(splitter);
  splitter.connect(gLL, 0);
  splitter.connect(gRL, 0);
  splitter.connect(gLR, 1);
  splitter.connect(gRR, 1);
  gLL.connect(merger, 0, 0);
  gRL.connect(merger, 0, 0);
  gLR.connect(merger, 0, 1);
  gRR.connect(merger, 0, 1);
  merger.connect(out).connect(ctx.destination);
  src.start(0);

  options.onProgress?.(20, "Applying tonal shaping and glue compression");
  const rendered = await ctx.startRendering();

  let channels: Float32Array[] = [rendered.getChannelData(0), rendered.getChannelData(1)];
  options.onProgress?.(45, "Adding harmonic colour");
  channels = applySaturation(channels, controls.saturation);
  // Width is already applied by the mid/side matrix in the offline graph;
  // applying it a second time in JavaScript would double the amount.

  const notes: string[] = [];
  const targetLufs = controls.targetLufs;
  const ceiling = controls.truePeakCeilingDb;

  // Coarse gain from the measured integrated loudness.
  const sourceLufs = measureIntegrated(channels, sampleRate);
  if (Number.isFinite(sourceLufs)) {
    channels = applyGain(channels, Math.max(-24, Math.min(18, targetLufs - sourceLufs)));
  }

  options.onProgress?.(60, "Limiting toward the loudness target");
  for (let attempt = 0; attempt < 3; attempt++) {
    channels = applyLimiter(channels, sampleRate, ceiling, controls.limiterReleaseMs);
    const tp = truePeakDb(channels);
    if (tp > ceiling + 0.03) channels = applyGain(channels, ceiling - tp);
    const lufs = measureIntegrated(channels, sampleRate);
    if (!Number.isFinite(lufs)) break;
    const delta = targetLufs - lufs;
    notes.push(
      `Pass ${attempt + 1}: ${lufs.toFixed(1)} LUFS / ${tp.toFixed(2)} dBTP`,
    );
    if (delta > 0.25) {
      // Push a little further, letting the limiter manage the peaks.
      channels = applyGain(channels, Math.min(2.5, delta));
    } else {
      break;
    }
    options.onProgress?.(60 + (attempt + 1) * 10, "Refining loudness");
  }

  // Final protective limit + verification in the true-peak domain.
  channels = applyLimiter(channels, sampleRate, ceiling, controls.limiterReleaseMs);
  const preFixTp = truePeakDb(channels);
  if (preFixTp > ceiling) {
    channels = applyGain(channels, ceiling - preFixTp);
    notes.push(
      `Final true-peak trim of ${(ceiling - preFixTp).toFixed(2)} dB to respect the ${ceiling.toFixed(1)} dBTP ceiling.`,
    );
  }

  options.onProgress?.(95, "Measuring the finished master");
  const measured = analyzeBuffer(channels, sampleRate);
  options.onProgress?.(100, "Master rendered");

  return {
    channels,
    sampleRate,
    applied: [
      "Low-shelf / mud cut / high-shelf tonal balance",
      `Glue compression (ratio ${glue.ratio.value.toFixed(1)}:1)`,
      `${controls.stereoWidthPct}% stereo width`,
      `Saturation drive ${(controls.saturation * 100).toFixed(0)}%`,
      `Look-ahead limiter at ${ceiling.toFixed(1)} dBTP, ${controls.limiterReleaseMs} ms release`,
      "Measured true-peak verification after render",
    ],
    measured,
    notes,
  };
}

export async function encodeChannels(
  channels: Float32Array[],
  sampleRate: number,
  format: "wav24" | "wav16" | "wav32" | "mp3_320",
  onProgress?: (pct: number) => void,
  options?: { dither?: boolean },
): Promise<{ bytes: Uint8Array; mimeType: string; extension: string; bitDepth: number | null; label: string }> {
  if (!channels.length || !channels[0]?.length) {
    throw new Error("There is no audio to encode.");
  }
  // All encoders expect equally long channels; trim to the shortest one.
  const shortest = Math.min(...channels.map((c) => c.length));
  if (channels.some((c) => c.length !== shortest)) {
    channels = channels.map((c) => c.subarray(0, shortest));
  }
  if (format === "mp3_320") {
    const bytes = await encodeMp3(channels, sampleRate, 320, onProgress);
    return {
      bytes,
      mimeType: "audio/mpeg",
      extension: "mp3",
      bitDepth: null,
      label: "MP3 320 kbps CBR",
    };
  }
  const bitDepth: WavBitDepth = format === "wav16" ? 16 : format === "wav32" ? 32 : 24;
  onProgress?.(20);
  const dither = options?.dither ?? true;
  const bytes = encodeWav(channels, sampleRate, bitDepth, bitDepth === 16 && dither);
  onProgress?.(100);
  return {
    bytes,
    mimeType: "audio/wav",
    extension: "wav",
    bitDepth,
    label: `WAV ${bitDepth}-bit / ${(sampleRate / 1000).toFixed(1)} kHz${
      bitDepth === 16 ? (dither ? " (TPDF dithered)" : " (no dither)") : ""
    }`,
  };
}
