import type {
  Genre,
  MasteringControls,
  MixState,
  Project,
  StemRole,
  Track,
  VocalState,
} from "@/lib/types";
import { MASTER_PROFILES, MIX_PRESETS, PROMPT_SEEDS } from "@/lib/types";

export const DEFAULT_MASTER_CONTROLS: MasteringControls = {
  ...MASTER_PROFILES[0].controls,
};

export const TRACK_COLORS: Record<StemRole, string> = {
  lead_vocal: "#A855F7",
  double: "#38BDF8",
  harmony: "#EC4899",
  chorus: "#8B5CF6",
  adlib: "#22D3EE",
  choir: "#FACC15",
  drums: "#FB923C",
  bass: "#F43F5E",
  percussion: "#A3E635",
  keys: "#67E8F9",
  instrumental: "#C084FC",
  other: "#A1A1B5",
};

export function uid(prefix = "id") {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function defaultMixState(): MixState {
  return {
    prompt: PROMPT_SEEDS.mix,
    improvedPrompt: null,
    improvedBy: null,
    presetId: "modern_afrobeats",
    recommendations: [],
    lastMixAssetId: null,
    outputGainDb: 0,
    limiterCeilingDb: -1,
    groups: [
      { id: "rhythm", label: "Rhythm bus", gainDb: 0, muted: false, colour: "#FB923C" },
      { id: "vocals", label: "Vocal bus", gainDb: 0, muted: false, colour: "#A855F7" },
      { id: "music", label: "Music bus", gainDb: 0, muted: false, colour: "#22D3EE" },
    ],
    lastMixAnalysis: null,
    lastMixEngineNotes: [],
  };
}

export function groupForRole(role: StemRole): string {
  if (["lead_vocal", "double", "harmony", "chorus", "adlib", "choir"].includes(role)) return "vocals";
  if (["drums", "bass", "percussion"].includes(role)) return "rhythm";
  return "music";
}

export function defaultVocalState(): VocalState {
  return {
    tool: "chorus",
    prompt: PROMPT_SEEDS.vocal,
    improvedPrompt: null,
    improvedBy: null,
    sourceAssetId: null,
    intensity: 0.7,
    density: 0.65,
    layerCount: 4,
    choirSize: 8,
    choirStyle: "call_response",
    performanceStyle: "Lively · Syncopated · Warm",
    sectionStartSec: 0,
    sectionEndSec: 30,
    voiceProfileId: null,
    generatedAssetIds: [],
  };
}

export function emptyProject(
  name: string,
  genre: Genre = "Afrobeats",
  bpm = 104,
  musicalKey = "F# minor",
): Project {
  const ts = nowIso();
  return {
    id: uid("prj"),
    // Ownership is assigned by the caller (the signed-in account). Projects
    // restored from a pre-accounts database keep `null` until claimed.
    ownerId: null,
    name: name.trim() || "Untitled session",
    genre,
    bpm,
    musicalKey,
    notes: "",
    createdAt: ts,
    updatedAt: ts,
    tracks: [],
    assets: [],
    versions: [],
    jobs: [],
    mix: defaultMixState(),
    vocal: defaultVocalState(),
    mastering: {
      prompt: PROMPT_SEEDS.mastering,
      improvedPrompt: null,
      improvedBy: null,
      sourceAssetId: null,
      profileId: "streaming",
      controls: { ...DEFAULT_MASTER_CONTROLS },
      sourceAnalysis: null,
      lastAnalysis: null,
      lastMasterAssetId: null,
      loudnessMatched: true,
      outputSampleRate: 48000,
      outputBitDepth: 24,
      lastRenderNotes: [],
      lastAppliedStages: [],
    },
  };
}

export function makeTrack(
  assetId: string,
  name: string,
  role: StemRole,
  order: number,
): Track {
  return {
    id: uid("trk"),
    name,
    role,
    groupId: groupForRole(role),
    assetId,
    volumeDb: 0,
    pan: 0,
    muted: false,
    soloed: false,
    eqLowDb: 0,
    eqMidDb: 0,
    eqHighDb: 0,
    compThresholdDb: -18,
    compRatio: 2.5,
    reverbSend: 0.12,
    delaySend: 0.05,
    width: 1,
    order,
    color: TRACK_COLORS[role],
    createdAt: nowIso(),
  };
}

/** Apply a genre preset to existing tracks, leaving mute/solo/order intact. */
export function applyPresetToTracks(tracks: Track[], presetId: string): Track[] {
  const preset = MIX_PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.id === "custom") return tracks;
  return tracks.map((t) => {
    const rolePreset = preset.roles[t.role] ?? preset.roles.other;
    if (!rolePreset) return t;
    return { ...t, ...rolePreset, pan: rolePreset.pan ?? t.pan };
  });
}

export function guessRoleFromName(fileName: string): StemRole {
  const n = fileName.toLowerCase();
  const table: [RegExp, StemRole][] = [
    [/lead ?(vox|vocal)|main ?vox/, "lead_vocal"],
    [/backing|bgv|bg vox|harmony ?vox|stack/, "harmony"],
    [/harmon/, "harmony"],
    [/choir/, "choir"],
    [/ad.?lib|chant/, "adlib"],
    [/double|dbl/, "double"],
    [/chorus|hook/, "chorus"],
    [/kick|drum|snare|hat|clap|perc.*drum/, "drums"],
    [/bass|808|log ?drum|sub/, "bass"],
    [/perc|shaker|shekere|conga|tamb/, "percussion"],
    [/keys|piano|synth|pad|guitar/, "keys"],
    [/instrumental|beat|inst|backing ?track/, "instrumental"],
    [/vocal|vox|voice/, "lead_vocal"],
  ];
  for (const [re, role] of table) if (re.test(n)) return role;
  return "other";
}

export function findAsset(project: Project, assetId: string | null | undefined) {
  if (!assetId) return null;
  return project.assets.find((a) => a.id === assetId) ?? null;
}

export function projectDuration(project: Project) {
  return project.assets.reduce((max, a) => Math.max(max, a.durationSec), 0);
}

export function exportedMasterAsset(project: Project) {
  return findAsset(project, project.mastering.lastMasterAssetId);
}
