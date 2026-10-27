import type { ChoirStyleId, VocalToolId } from "@/lib/types";
import {
  delayChannel,
  lowPass,
  mixInto,
  panMonoToStereo,
  pitchShift,
  simpleReverb,
} from "@/lib/audio/pitch";

/**
 * Vocal layer synthesis.
 *
 * Every layer is derived from the producer's own recording using real DSP
 * (pitch shifting, time offsets, detune, ensemble spread, filtered reverb).
 * No synthetic lyrics are invented and no neural voice conversion is implied.
 */

export interface VocalRenderConfig {
  tool: VocalToolId;
  intensity: number; // 0..1
  density: number; // 0..1
  layerCount: number; // 1..8
  choirSize: number; // 4..24
  choirStyle: ChoirStyleId;
  sectionStartSec: number;
  sectionEndSec: number;
  bpm: number;
}

export interface VocalRenderResult {
  channels: [Float32Array, Float32Array];
  engineNote: string;
  voices: number;
}

interface VoiceSpec {
  semitones: number;
  cents?: number;
  pan: number;
  level: number;
  delayMs?: number;
  lowPassHz?: number;
  /** Optional slice of the selection (seconds, relative to section start). */
  slice?: { start: number; length: number };
}

const CHOIR_INTERVALS = [0, 4, 7, 12, -5, -12, 3, 9, 5, -7, 14, -9];

const CHOIR_TONE: Record<ChoirStyleId, { lowPass: number; spread: number; level: number }> = {
  zulu: { lowPass: 8200, spread: 0.55, level: 0.5 },
  call_response: { lowPass: 9500, spread: 0.65, level: 0.55 },
  amapiano: { lowPass: 10500, spread: 0.75, level: 0.5 },
  highlife: { lowPass: 9000, spread: 0.6, level: 0.5 },
  afro_soul: { lowPass: 7200, spread: 0.45, level: 0.45 },
};

function voicePlan(config: VocalRenderConfig, duration: number): VoiceSpec[] {
  const intensity = Math.max(0, Math.min(1, config.intensity));
  const density = Math.max(0, Math.min(1, config.density));
  const layerCount = Math.max(1, Math.min(8, Math.round(config.layerCount)));
  const detune = 5 + intensity * 12;

  switch (config.tool) {
    case "doubling":
      return [
        { semitones: 0, cents: detune, pan: -0.6, level: 0.55 + intensity * 0.25, delayMs: 14 + density * 18 },
        { semitones: 0, cents: -detune, pan: 0.6, level: 0.5 + intensity * 0.25, delayMs: 22 + density * 22 },
      ];

    case "harmony": {
      const high = [4, 7, 12, 3, 9, 5, 16, 19];
      const low = [-5, -3, -8, -12, -10, -15, -17, -19];
      const voices: VoiceSpec[] = [
        { semitones: 0, cents: detune * 0.5, pan: 0, level: 0.3, delayMs: 8 },
      ];
      for (let i = 0; i < layerCount; i++) {
        const useHigh = i % 2 === 0;
        const interval = (useHigh ? high : low)[Math.floor(i / 2) % 8];
        const pan = ((i + 1) / (layerCount + 1)) * 1.6 - 0.8;
        voices.push({
          semitones: interval,
          cents: (i % 2 === 0 ? 1 : -1) * (4 + density * 8),
          pan,
          level: 0.32 + intensity * 0.22,
          delayMs: 10 + i * 7,
          lowPassHz: interval > 0 ? 11000 : 9000,
        });
      }
      return voices;
    }

    case "chorus": {
      const voices: VoiceSpec[] = [
        { semitones: 0, cents: detune * 0.7, pan: -0.25, level: 0.45, delayMs: 12 },
        { semitones: 0, cents: -detune * 0.7, pan: 0.25, level: 0.45, delayMs: 19 },
      ];
      const stackIntervals = [3, 7, -5, 12, 4, -8, 9, -12];
      for (let i = 0; i < layerCount; i++) {
        voices.push({
          semitones: stackIntervals[i % stackIntervals.length],
          cents: (i % 2 ? -1 : 1) * (6 + intensity * 10),
          pan: ((i + 1) / (layerCount + 2)) * 1.7 - 0.85,
          level: (0.3 + intensity * 0.22) * (0.85 + density * 0.3),
          delayMs: 14 + i * 12,
          lowPassHz: 10500,
        });
      }
      return voices;
    }

    case "choir": {
      const count = Math.max(4, Math.min(24, Math.round(config.choirSize)));
      const tone = CHOIR_TONE[config.choirStyle] ?? CHOIR_TONE.call_response;
      const voices: VoiceSpec[] = [];
      for (let i = 0; i < count; i++) {
        const interval = CHOIR_INTERVALS[i % CHOIR_INTERVALS.length];
        const spread = ((i + 1) / (count + 1)) * 2 - 1;
        voices.push({
          semitones: interval,
          cents: ((i % 5) - 2) * (5 + density * 7),
          pan: spread * tone.spread,
          level: (tone.level / Math.sqrt(count)) * (0.7 + intensity * 0.6),
          delayMs: (i % 7) * 9 + 12,
          lowPassHz: tone.lowPass - (config.choirStyle === "afro_soul" ? 800 : 0),
        });
      }
      return voices;
    }

    case "adlib": {
      const stabs = Math.max(2, Math.min(5, Math.round(1 + density * 4)));
      const voices: VoiceSpec[] = [];
      const intervals = [7, 12, -5, 4, 19];
      for (let i = 0; i < stabs; i++) {
        const start = (duration * (i + 0.5)) / (stabs + 1) - 0.25;
        voices.push({
          semitones: intervals[i % intervals.length],
          cents: 6,
          pan: i % 2 === 0 ? -0.5 : 0.5,
          level: 0.5 + intensity * 0.4,
          delayMs: 0,
          slice: { start: Math.max(0, start), length: Math.min(0.9, duration) },
          lowPassHz: 11000,
        });
      }
      return voices;
    }

    case "backing": {
      return [
        { semitones: -5, pan: -0.35, level: 0.4, delayMs: 18, lowPassHz: 6500 },
        { semitones: -12, pan: 0.35, level: 0.3, delayMs: 26, lowPassHz: 5000 },
        { semitones: 0, cents: 7, pan: -0.7, level: 0.25, delayMs: 34, lowPassHz: 8000 },
        { semitones: 0, cents: -7, pan: 0.7, level: 0.25, delayMs: 41, lowPassHz: 8000 },
      ].slice(0, Math.max(2, layerCount));
    }

    case "transform":
      throw new Error(
        "Voice transformation needs a licensed neural provider. Configure VOICE_CONVERSION_API_URL before using this tool.",
      );

    case "arrangement":
    default:
      return [
        { semitones: 0, cents: detune, pan: -0.5, level: 0.4, delayMs: 20 },
        { semitones: 0, cents: -detune, pan: 0.5, level: 0.4, delayMs: 28 },
      ];
  }
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export async function renderVocalLayer(
  source: Float32Array[],
  sampleRate: number,
  config: VocalRenderConfig,
  onProgress?: (pct: number, message: string) => void,
): Promise<VocalRenderResult> {
  if (!source.length || !source[0].length) throw new Error("No source audio to process");
  if (config.tool === "transform") {
    throw new Error(
      "Neural voice transformation is not connected. No provider API is configured, so no audio was generated.",
    );
  }

  const totalFrames = source[0].length;
  const duration = totalFrames / sampleRate;
  const startSec = Math.max(0, Math.min(duration, config.sectionStartSec));
  const endSec = Math.max(startSec + 0.5, Math.min(duration, config.sectionEndSec));
  const startFrame = Math.round(startSec * sampleRate);
  const endFrame = Math.min(totalFrames, Math.round(endSec * sampleRate));
  const sectionLength = endFrame - startFrame;
  if (sectionLength < sampleRate * 0.2) {
    throw new Error("Select at least 0.2 s of audio to generate a layer.");
  }

  // Mono reference for all voices (mono summation is deliberate: each voice is
  // re-panned, so the original image must not be baked in twice).
  const mono = new Float32Array(sectionLength);
  for (const ch of source) {
    for (let i = 0; i < sectionLength; i++) mono[i] += ch[startFrame + i] / source.length;
  }

  const plan = voicePlan(config, sectionLength / sampleRate);
  const outL = new Float32Array(totalFrames);
  const outR = new Float32Array(totalFrames);

  let processed = 0;
  for (const voice of plan) {
    const offsetSamples = Math.round(((voice.delayMs ?? 0) / 1000) * sampleRate);
    const sliceStart = voice.slice ? Math.round(voice.slice.start * sampleRate) : 0;
    const sliceLength = voice.slice
      ? Math.min(sectionLength - sliceStart, Math.round(voice.slice.length * sampleRate))
      : sectionLength;
    if (sliceLength <= 0) continue;

    const slice = mono.subarray(sliceStart, sliceStart + sliceLength);
    let shifted = pitchShift(slice, voice.semitones, voice.cents ?? 0);
    if (voice.lowPassHz) shifted = lowPass(shifted, sampleRate, voice.lowPassHz);
    const delayed = delayChannel(shifted, offsetSamples);

    if (voice.slice) {
      // Short fades so the stab does not click.
      const fade = Math.min(Math.round(0.02 * sampleRate), Math.floor(delayed.length / 4));
      for (let i = 0; i < fade; i++) {
        const g = i / fade;
        delayed[i] *= g;
        delayed[delayed.length - 1 - i] *= g;
      }
    }

    // Position the voice on the timeline: the section offset plus the slice
    // offset, so a layer generated from bar 17 stays at bar 17.
    const timelineStart = startFrame + sliceStart;
    const placed = new Float32Array(timelineStart + delayed.length);
    placed.set(delayed, timelineStart);
    const sourceChannels = panMonoToStereo(placed, voice.pan);
    mixInto([outL, outR], sourceChannels, voice.level);

    processed++;
    onProgress?.(
      Math.round((processed / (plan.length + 1)) * 90),
      `Rendering voice ${processed}/${plan.length}`,
    );
    await yieldToUi();
  }

  onProgress?.(92, "Seating the layers in the stereo field");
  const wet =
    config.tool === "choir" ? 0.28 : config.tool === "adlib" ? 0.32 : 0.18 + config.intensity * 0.12;
  const [revL, revR] = simpleReverb([outL, outR], sampleRate, wet, 0.5);
  onProgress?.(97, "Finalising layer");

  const engineNote = buildEngineNote(config, plan.length);
  return {
    channels: [revL, revR],
    engineNote,
    voices: plan.length,
  };
}

function buildEngineNote(config: VocalRenderConfig, voices: number): string {
  const labels: Record<VocalToolId, string> = {
    chorus: "Layered chorus stack",
    harmony: "Harmonic stack",
    adlib: "Rhythmic ad-lib chops",
    choir: "Wide ensemble stack",
    doubling: "Humanised stereo double",
    backing: "Backing vocal bed",
    transform: "Unavailable",
    arrangement: "Arrangement guide",
  };
  return `${labels[config.tool]} · ${voices} voice${voices === 1 ? "" : "s"} · local DSP (pitch shift + ensemble spread + reverb). Derived from your uploaded recording; no synthetic vocals were generated.`;
}
