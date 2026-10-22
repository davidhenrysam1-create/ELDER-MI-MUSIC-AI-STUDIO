import type { ChoirStyleId, VocalToolId } from "@/lib/types";

/**
 * Deterministic vocal arrangement plan.
 *
 * This is a written plan, not an audio render: it translates the producer's
 * brief into concrete layer counts, entry points and stereo placement which
 * the user can review and then apply to the generator settings.
 */
export interface ArrangementSection {
  section: string;
  bars: string;
  density: "sparse" | "medium" | "full";
  layers: string[];
  placement: string;
}

export interface ArrangementPlan {
  summary: string;
  sections: ArrangementSection[];
  settings: {
    layerCount: number;
    intensity: number;
    density: number;
    choirSize: number;
    choirStyle: ChoirStyleId;
    tool: VocalToolId;
  };
}

export function buildArrangementPlan(
  prompt: string,
  bpm: number,
  durationSec: number,
  fallback: {
    layerCount: number;
    intensity: number;
    density: number;
    choirSize: number;
    choirStyle: ChoirStyleId;
  },
): ArrangementPlan {
  const p = prompt.toLowerCase();
  const has = (...terms: string[]) => terms.some((t) => p.includes(t));
  const energetic = has("energetic", "energy", "powerful", "club", "hype", "big");
  const intimate = has("intimate", "subtle", "soft", "warm", "gentle", "soul");
  const wantsChoir = has("choir", "group", "ensemble", "south african", "zulu");
  const wantsHarmony = has("harmony", "harmonies", "stack", "layer");
  const wantsAdlib = has("ad-lib", "adlib", "chant", "call", "response", "hype");
  const callResponse = has("call", "response", "answer", "repeat");

  const layerCount = wantsChoir ? 6 : energetic ? 5 : intimate ? 2 : Math.max(2, fallback.layerCount);
  const intensity = energetic ? 0.85 : intimate ? 0.45 : fallback.intensity;
  const density = callResponse ? 0.8 : intimate ? 0.4 : fallback.density;
  const choirSize = wantsChoir ? (energetic ? 16 : 10) : fallback.choirSize;
  const choirStyle: ChoirStyleId = wantsChoir
    ? has("amapiano", "log drum")
      ? "amapiano"
      : has("highlife")
        ? "highlife"
        : has("soul", "warm")
          ? "afro_soul"
          : callResponse
            ? "call_response"
            : "zulu"
    : fallback.choirStyle;

  const beat = 60 / Math.max(60, Math.min(200, bpm));
  const barSec = beat * 4;
  const totalBars = Math.max(4, Math.round(durationSec / barSec));

  const layers = [
    "Lead (untouched, centred)",
    wantsHarmony ? "High harmony +3/+7 semitones" : "Unison double (subtle detune)",
    wantsHarmony ? "Low harmony −5 semitones" : "Wide double",
    ...(wantsChoir ? [`Choir ensemble (${choirSize} voices)`] : []),
    ...(wantsAdlib ? ["Rhythmic ad-lib answers"] : []),
  ];

  const sections: ArrangementSection[] = [
    {
      section: "Intro / first bar",
      bars: `bars 1–${Math.max(2, Math.round(totalBars * 0.15))}`,
      density: "sparse",
      layers: ["Lead only", "One distant harmony (low level, 65% width)"],
      placement: "Keep the centre clear so the first vocal line reads immediately.",
    },
    {
      section: "Verse",
      bars: `bars ${Math.max(3, Math.round(totalBars * 0.15))}–${Math.round(totalBars * 0.45)}`,
      density: "medium",
      layers: ["Lead", "Unison double (−9/+9 cents)", wantsAdlib ? "Sparse ad-lib at phrase ends" : "Harmony pad at −12 dB"],
      placement: "Doubles hard-panned ±55%, harmony filtered at 9 kHz to sit behind the lead.",
    },
    {
      section: "Chorus / hook",
      bars: `bars ${Math.round(totalBars * 0.45)}–${Math.round(totalBars * 0.8)}`,
      density: "full",
      layers,
      placement: "Choir spread to ±75%, lead dry at −0 dB. Duck backing 2 dB under lead phrases.",
    },
    {
      section: "Outro",
      bars: `bars ${Math.round(totalBars * 0.8)}–${totalBars}`,
      density: "sparse",
      layers: callResponse ? ["Offset group answer", "Single harmony tail"] : ["Harmony tail only"],
      placement: "Let the reverb tail finish; reduce density rather than adding layers.",
    },
  ];

  return {
    summary: `Afrobeats ${Math.round(bpm)} BPM · ${totalBars} bars · ${
      energetic ? "high-energy" : intimate ? "warm and restrained" : "balanced"
    } arrangement. Lead stays centred and unprocessed; ${layers.length - 1} supporting layer group${
      layers.length - 1 === 1 ? "" : "s"
    } are built from your own recording.`,
    sections,
    settings: {
      layerCount,
      intensity,
      density,
      choirSize,
      choirStyle,
      tool: wantsAdlib && !wantsHarmony ? "adlib" : wantsChoir ? "choir" : "chorus",
    },
  };
}
