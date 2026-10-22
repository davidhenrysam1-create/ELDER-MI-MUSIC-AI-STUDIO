/**
 * Shared domain model for Elder Mi Music AI Studio.
 *
 * Everything here is serialisable and shared between the browser and the
 * server API routes. Audio binaries live outside Git in `.data/audio`, while
 * this metadata is persisted in `.data/db.json`.
 */

export const GENRES = [
  "Afrobeats",
  "Afro-pop",
  "Afro-fusion",
  "Afro-soul",
  "Amapiano-influenced Afrobeats",
  "Highlife",
  "Bongo Flava",
] as const;

export type Genre = (typeof GENRES)[number];

export type StudioId = "vocal" | "mix" | "mastering";

export const STUDIO_META: Record<
  StudioId,
  { name: string; short: string; href: string; tagline: string; gradient: string }
> = {
  vocal: {
    name: "Sam Vocal Studio",
    short: "Vocal",
    href: "/vocal",
    tagline:
      "Create AI-assisted choruses, harmonies, ad-libs, vocal doubles, and powerful backing-vocal arrangements.",
    gradient: "from-violet via-magenta to-cyan",
  },
  mix: {
    name: "Sam Mix Studio",
    short: "Mix",
    href: "/mix",
    tagline:
      "Analyse your tracks, improve the balance of your song, and refine your mix with AI-assisted production tools.",
    gradient: "from-cyan via-sky-400 to-violet",
  },
  mastering: {
    name: "Sam Mastering Studio",
    short: "Master",
    href: "/mastering",
    tagline:
      "Polish your final mix with tonal balancing, dynamics control, loudness analysis, and mastering tools.",
    gradient: "from-orange via-gold to-magenta",
  },
};

export type AssetKind =
  | "source"
  | "stem"
  | "vocal"
  | "mix"
  | "master"
  | "reference";

export type StemRole =
  | "lead_vocal"
  | "double"
  | "harmony"
  | "chorus"
  | "adlib"
  | "choir"
  | "drums"
  | "bass"
  | "percussion"
  | "keys"
  | "instrumental"
  | "other";

export const STEM_ROLE_LABEL: Record<StemRole, string> = {
  lead_vocal: "Lead Vocal",
  double: "Vocal Double",
  harmony: "Harmony",
  chorus: "Chorus",
  adlib: "Ad-lib",
  choir: "Choir",
  drums: "Drums",
  bass: "Bass",
  percussion: "Percussion",
  keys: "Keys",
  instrumental: "Instrumental",
  other: "Other",
};

/** A stored audio object plus its measured/declared technical metadata. */
export interface AssetMeta {
  id: string;
  projectId: string;
  name: string;
  kind: AssetKind;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  durationSec: number;
  sampleRate: number;
  channels: number;
  bitDepth: number | null;
  /** Normalised 0..1 waveform envelope for fast rendering (never audio data). */
  peaks: number[];
  /** Which engine produced this asset, e.g. "Local Web Audio DSP". */
  engine?: string;
  derivedFromId?: string | null;
  createdAt: string;
  sha256?: string;
}

export type MixChannelSettings = Pick<
  Track,
  | "volumeDb"
  | "pan"
  | "eqLowDb"
  | "eqMidDb"
  | "eqHighDb"
  | "compThresholdDb"
  | "compRatio"
  | "reverbSend"
  | "delaySend"
  | "width"
>;

export interface Track {
  id: string;
  name: string;
  role: StemRole;
  /** Optional mixer group ("rhythm" | "vocals" | "music"). */
  groupId?: string;
  assetId: string | null;
  volumeDb: number;
  pan: number; // -1 (L) .. 1 (R)
  muted: boolean;
  soloed: boolean;
  eqLowDb: number;
  eqMidDb: number;
  eqHighDb: number;
  compThresholdDb: number;
  compRatio: number;
  reverbSend: number; // 0..1
  delaySend: number; // 0..1
  width: number; // 0..2
  order: number;
  color: string;
  createdAt: string;
}

export interface MixRecommendation {
  id: string;
  stage: string;
  targetRole: StemRole | "all";
  summary: string;
  detail: string;
  applied: boolean;
  /** Concrete channel values the user can review before applying. */
  settings?: Partial<MixChannelSettings>;
}

export interface MixGroup {
  id: string;
  label: string;
  gainDb: number;
  muted: boolean;
  colour: string;
}

export interface MixState {
  prompt: string;
  improvedPrompt: string | null;
  improvedBy: "gemini" | "local-heuristic" | null;
  presetId: MixPresetId;
  recommendations: MixRecommendation[];
  lastMixAssetId: string | null;
  outputGainDb: number;
  limiterCeilingDb: number;
  groups: MixGroup[];
  lastMixAnalysis: Analysis | null;
  lastMixEngineNotes: string[];
}

export interface VocalState {
  tool: VocalToolId;
  prompt: string;
  improvedPrompt: string | null;
  improvedBy: "gemini" | "local-heuristic" | null;
  sourceAssetId: string | null;
  intensity: number; // 0..1
  density: number; // 0..1
  layerCount: number; // 1..8
  choirSize: number; // 4..24
  choirStyle: ChoirStyleId;
  performanceStyle: string;
  sectionStartSec: number;
  sectionEndSec: number;
  voiceProfileId: string | null;
  generatedAssetIds: string[];
}

export interface MasteringControls {
  targetLufs: number;
  truePeakCeilingDb: number;
  lowShelfDb: number;
  highShelfDb: number;
  stereoWidthPct: number;
  saturation: number; // 0..1
  dynamicPreservation: number; // 0..1
  limiterReleaseMs: number;
}

export interface BandBalance {
  low: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
}

export interface Analysis {
  durationSec: number;
  sampleRate: number;
  channels: number;
  bitDepth: number | null;
  integratedLufs: number;
  shortTermMaxLufs: number;
  momentaryMaxLufs: number;
  loudnessRangeLu: number;
  truePeakDb: number;
  peakDb: number;
  rmsDb: number;
  crestFactorDb: number;
  stereoWidthPct: number;
  correlation: number;
  clippingSamples: number;
  bandBalance: BandBalance; // percentage of energy per band (0..100)
  measuredAt: string;
  method: string;
}

export interface MasterState {
  prompt: string;
  improvedPrompt: string | null;
  improvedBy: "gemini" | "local-heuristic" | null;
  sourceAssetId: string | null;
  profileId: MasterProfileId;
  controls: MasteringControls;
  /** Measurement of the source mix, taken before rendering. */
  sourceAnalysis: Analysis | null;
  /** Measurement of the rendered master (never a prediction). */
  lastAnalysis: Analysis | null;
  lastMasterAssetId: string | null;
  loudnessMatched: boolean;
  outputSampleRate: number;
  outputBitDepth: 16 | 24 | 32;
  lastRenderNotes: string[];
  lastAppliedStages: string[];
}

export interface JobRecord {
  id: string;
  projectId: string;
  studio: StudioId;
  kind: string;
  title: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface ProjectVersion {
  id: string;
  label: string;
  note: string;
  createdAt: string;
  studio: StudioId;
  tracks: Track[];
  mix: MixState;
  vocal: VocalState;
  mastering: MasterState;
  masterAssetId: string | null;
}

export interface Project {
  id: string;
  name: string;
  genre: Genre;
  bpm: number;
  musicalKey: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  tracks: Track[];
  assets: AssetMeta[];
  versions: ProjectVersion[];
  jobs: JobRecord[];
  mix: MixState;
  vocal: VocalState;
  mastering: MasterState;
}

export interface ExportRecord {
  id: string;
  projectId: string;
  projectName: string;
  studio: StudioId;
  assetId: string | null;
  fileName: string;
  mimeType: string;
  format: "WAV" | "MP3";
  bitDepth: number | null;
  sampleRate: number;
  sizeBytes: number;
  durationSec: number;
  integratedLufs: number | null;
  truePeakDb: number | null;
  createdAt: string;
  storedName: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  timbreDescription: string;
  genreSuitability: string;
  consentConfirmed: boolean;
  consentName: string;
  referenceAssetId: string | null;
  createdAt: string;
}

export interface StudioSettings {
  defaultExportFormat: "wav24" | "wav16" | "mp3_320";
  dither16Bit: boolean;
  autoSave: boolean;
  processingQuality: "fast" | "balanced" | "high";
  maxUploadMb: number;
  maxDurationSec: number;
}

export interface Database {
  version: number;
  projects: Project[];
  exports: ExportRecord[];
  voiceProfiles: VoiceProfile[];
  settings: StudioSettings;
}

/* ------------------------------------------------------------------ */
/* Studio-specific option catalogues                                   */
/* ------------------------------------------------------------------ */

export type VocalToolId =
  | "chorus"
  | "harmony"
  | "adlib"
  | "choir"
  | "doubling"
  | "backing"
  | "transform"
  | "arrangement";

export interface VocalTool {
  id: VocalToolId;
  name: string;
  description: string;
  /** Honest implementation status shown in the UI. */
  status: "ready" | "needs-config" | "planned";
  statusNote: string;
  role: StemRole;
  accent: string;
}

export const VOCAL_TOOLS: VocalTool[] = [
  {
    id: "chorus",
    name: "AI Chorus Generator",
    description:
      "Builds a layered chorus stack from your lead vocal: stacked unisons, pitch-shifted upper/lower parts and rhythmic group answers.",
    status: "ready",
    statusNote:
      "Runs on the local Web Audio DSP engine using your uploaded vocal as the source. This is real audio processing, not synthetic singing.",
    role: "chorus",
    accent: "violet",
  },
  {
    id: "harmony",
    name: "AI Harmony Generator",
    description:
      "Creates high, middle and low harmony parts at chosen intervals with humanised timing and stereo placement.",
    status: "ready",
    statusNote:
      "Granular pitch-shifting engine on the local DSP. Interval and layer count are applied to the rendered audio.",
    role: "harmony",
    accent: "fuchsia",
  },
  {
    id: "adlib",
    name: "AI Ad-Lib Generator",
    description:
      "Derives short chants, hype stabs and sung responses from your own vocal takes.",
    status: "ready",
    statusNote:
      "Derived from your recording (rhythmic chops, transposition, gated repeats). It does not invent new lyrics.",
    role: "adlib",
    accent: "cyan",
  },
  {
    id: "choir",
    name: "South African-Inspired Choir",
    description:
      "Wide ensemble stacks, sustained group harmonies and call-and-response refrains with controllable choir size and energy.",
    status: "ready",
    statusNote:
      "Multi-voice local DSP ensemble built from your vocal. Broad musical characteristics only — no impersonation of any artist or choir.",
    role: "choir",
    accent: "gold",
  },
  {
    id: "doubling",
    name: "AI Vocal Doubling",
    description:
      "Tight, humanised stereo doubles and triple-takes with micro-detune and millisecond offsets.",
    status: "ready",
    statusNote:
      "Detune + delay + width DSP. Rendered as a separate, fully editable lane.",
    role: "double",
    accent: "sky",
  },
  {
    id: "backing",
    name: "Backing Vocal Generator",
    description:
      "Lowers and widens backing vocals behind the lead without touching your original file.",
    status: "ready",
    statusNote:
      "Level and stereo shaping applied by the local engine; the original asset is never modified.",
    role: "chorus",
    accent: "lime",
  },
  {
    id: "transform",
    name: "Authorised Voice Transformation",
    description:
      "Apply an authorised reference timbre to backing parts.",
    status: "needs-config",
    statusNote:
      "Requires an external neural voice-conversion provider (e.g. a licensed RVC/So-VITS/ElevenLabs-style service). No provider is connected, so this stays disabled instead of faking results.",
    role: "lead_vocal",
    accent: "orange",
  },
  {
    id: "arrangement",
    name: "Vocal Arrangement Assistant",
    description:
      "Suggests section-by-section vocal density, entry points and stereo placement from your prompt.",
    status: "ready",
    statusNote:
      "Uses the prompt engine (Gemini when configured, otherwise the local music-theory heuristic) and creates an editable arrangement plan.",
    role: "harmony",
    accent: "magenta",
  },
];

export type ChoirStyleId =
  | "zulu"
  | "call_response"
  | "amapiano"
  | "highlife"
  | "afro_soul";

export const CHOIR_STYLES: { id: ChoirStyleId; label: string; description: string }[] = [
  { id: "zulu", label: "Isicathamiya-style ensemble", description: "Rich low-mid harmonies, gentle melodic swells." },
  { id: "call_response", label: "Afro call & response", description: "Rhythmic lead answered by a tight group." },
  { id: "amapiano", label: "Amapiano vocal stabs", description: "Syncopated chants, stabs and falsetto answers." },
  { id: "highlife", label: "Highlife choir", description: "Warm, polyphonic, guitar-like voice leading." },
  { id: "afro_soul", label: "Afro-soul warmth", description: "Intimate, close-mic ensemble pad." },
];

export type MixPresetId =
  | "modern_afrobeats"
  | "afro_pop"
  | "afro_fusion"
  | "amapiano"
  | "custom";

export interface MixPreset {
  id: MixPresetId;
  label: string;
  description: string;
  /** Per-role starting points. Adjustable, never forced. */
  roles: Partial<
    Record<
      StemRole,
      Partial<
        Pick<
          Track,
          | "volumeDb"
          | "pan"
          | "eqLowDb"
          | "eqMidDb"
          | "eqHighDb"
          | "compThresholdDb"
          | "compRatio"
          | "reverbSend"
          | "delaySend"
          | "width"
        >
      >
    >
  >;
}

export const MIX_PRESETS: MixPreset[] = [
  {
    id: "modern_afrobeats",
    label: "Modern Afrobeats",
    description: "Punchy kick, controlled log-drum weight, wide shakers, vocal on top.",
    roles: {
      lead_vocal: { volumeDb: 0, eqLowDb: -2, eqMidDb: 0.5, eqHighDb: 1.5, compRatio: 3, compThresholdDb: -18, reverbSend: 0.18, delaySend: 0.1, width: 1 },
      drums: { volumeDb: -1, eqLowDb: 1, eqMidDb: 0, eqHighDb: 0.5, compRatio: 4, compThresholdDb: -16, width: 0.95 },
      bass: { volumeDb: -3, eqLowDb: 1.5, eqMidDb: -1, eqHighDb: -2, compRatio: 4, compThresholdDb: -20, width: 0.6 },
      percussion: { volumeDb: -4, eqLowDb: -4, eqHighDb: 1, width: 1.35, pan: 0.1 },
      chorus: { volumeDb: -6, eqLowDb: -3, eqHighDb: 1, reverbSend: 0.3, width: 1.25 },
      other: { volumeDb: -2 },
    },
  },
  {
    id: "afro_pop",
    label: "Afro-pop",
    description: "Bright, polished top end with an upfront vocal and tight low mids.",
    roles: {
      lead_vocal: { volumeDb: 1, eqLowDb: -2.5, eqMidDb: 1, eqHighDb: 2, compRatio: 3.5, compThresholdDb: -20, reverbSend: 0.22 },
      drums: { volumeDb: -0.5, eqHighDb: 1.5, width: 1 },
      bass: { volumeDb: -3.5, eqLowDb: 1, eqMidDb: -1.5 },
      percussion: { volumeDb: -5, eqHighDb: 2, width: 1.3 },
      chorus: { volumeDb: -5.5, eqHighDb: 1, reverbSend: 0.35, width: 1.3 },
    },
  },
  {
    id: "afro_fusion",
    label: "Afro-fusion",
    description: "Open, atmospheric mix with space around the percussion and a softer vocal pocket.",
    roles: {
      lead_vocal: { volumeDb: 0, eqLowDb: -1.5, eqMidDb: 0.5, eqHighDb: 1, compRatio: 2.5, reverbSend: 0.3, delaySend: 0.2, width: 1 },
      drums: { volumeDb: -1.5, eqLowDb: 0.5, width: 1.05 },
      bass: { volumeDb: -3, eqLowDb: 1 },
      percussion: { volumeDb: -6, eqHighDb: 1, width: 1.4 },
      keys: { volumeDb: -3, reverbSend: 0.28, width: 1.2 },
      chorus: { volumeDb: -7, reverbSend: 0.4, width: 1.35 },
    },
  },
  {
    id: "amapiano",
    label: "Amapiano-influenced",
    description: "Log-drum weight, soft shaker air, and deep sub control.",
    roles: {
      bass: { volumeDb: -1.5, eqLowDb: 3, eqMidDb: -2, eqHighDb: -4, compRatio: 3, compThresholdDb: -18, width: 0.5 },
      drums: { volumeDb: -2, eqLowDb: 0.5, eqHighDb: 0.5, compRatio: 3.5 },
      percussion: { volumeDb: -4.5, eqLowDb: -6, eqHighDb: 2.5, width: 1.4 },
      keys: { volumeDb: -3.5, reverbSend: 0.35, width: 1.25 },
      lead_vocal: { volumeDb: 0, eqLowDb: -3, eqMidDb: 1, eqHighDb: 1, reverbSend: 0.25, compRatio: 3 },
      chorus: { volumeDb: -6, reverbSend: 0.35, width: 1.3 },
    },
  },
  {
    id: "custom",
    label: "Custom",
    description: "Start from your own channel settings.",
    roles: {},
  },
];

export type MasterProfileId =
  | "streaming"
  | "loud"
  | "warm"
  | "club"
  | "vocal"
  | "bass"
  | "smooth"
  | "custom";

export interface MasterProfile {
  id: MasterProfileId;
  label: string;
  description: string;
  character: string;
  controls: MasteringControls;
}

const baseControls: MasteringControls = {
  targetLufs: -14,
  truePeakCeilingDb: -1,
  lowShelfDb: 0,
  highShelfDb: 0,
  stereoWidthPct: 100,
  saturation: 0.15,
  dynamicPreservation: 0.6,
  limiterReleaseMs: 120,
};

export const MASTER_PROFILES: MasterProfile[] = [
  {
    id: "streaming",
    label: "Streaming-Ready Master",
    description: "Balanced, transparent result that survives platform loudness normalisation.",
    character: "Clean · Balanced",
    controls: { ...baseControls, targetLufs: -14, truePeakCeilingDb: -1, saturation: 0.08 },
  },
  {
    id: "loud",
    label: "Loud and Energetic Master",
    description: "Denser, louder delivery for radio-style impact.",
    character: "Dense · Aggressive",
    controls: { ...baseControls, targetLufs: -10, truePeakCeilingDb: -0.5, lowShelfDb: 1, highShelfDb: 1, saturation: 0.3, dynamicPreservation: 0.35, limiterReleaseMs: 80 },
  },
  {
    id: "warm",
    label: "Warm Afrobeats Master",
    description: "Tape-style low-mid weight with a silky top end.",
    character: "Warm · Rounded",
    controls: { ...baseControls, targetLufs: -12, truePeakCeilingDb: -0.8, lowShelfDb: 1.5, highShelfDb: 1.2, saturation: 0.4, stereoWidthPct: 104 },
  },
  {
    id: "club",
    label: "Punchy Club Master",
    description: "Sub weight and transient snap for large systems.",
    character: "Punchy · Sub-heavy",
    controls: { ...baseControls, targetLufs: -9, truePeakCeilingDb: -0.3, lowShelfDb: 2.5, highShelfDb: 1, saturation: 0.28, dynamicPreservation: 0.3, limiterReleaseMs: 70 },
  },
  {
    id: "vocal",
    label: "Vocal-Forward Master",
    description: "Presence and air that pull the lead vocal to the front.",
    character: "Presence · Air",
    controls: { ...baseControls, targetLufs: -12.5, truePeakCeilingDb: -1, lowShelfDb: -1, highShelfDb: 2.5, saturation: 0.12 },
  },
  {
    id: "bass",
    label: "Bass-Focused Master",
    description: "Tight log-drum low end with controlled sub movement.",
    character: "Deep · Controlled",
    controls: { ...baseControls, targetLufs: -11, truePeakCeilingDb: -0.6, lowShelfDb: 3, highShelfDb: 0.5, saturation: 0.2, dynamicPreservation: 0.45 },
  },
  {
    id: "smooth",
    label: "Smooth and Premium Master",
    description: "Open dynamics and a wide, unhurried image.",
    character: "Pristine · Open",
    controls: { ...baseControls, targetLufs: -13.5, truePeakCeilingDb: -1.2, lowShelfDb: 0.5, highShelfDb: 1.5, saturation: 0.06, dynamicPreservation: 0.85, stereoWidthPct: 108 },
  },
  {
    id: "custom",
    label: "Custom",
    description: "Your own targets and tone controls.",
    character: "Manual",
    controls: { ...baseControls },
  },
];

export const DEFAULT_LIMITS = {
  maxUploadMb: 80,
  maxDurationSec: 12 * 60,
  acceptedExtensions: ["wav", "mp3", "aiff", "aif", "flac", "ogg", "m4a"],
};

export const PROMPT_SEEDS: Record<StudioId, string> = {
  vocal:
    "Generate an energetic Afrobeats chorus with layered backing vocals, catchy call-and-response phrases, high harmonies, low harmonies, and rhythmic group vocals. Keep the lead vocal clear and natural.",
  mix:
    "Give this Afrobeats song a balanced, modern mix. Improve vocal clarity, control the low frequencies, create space between the bass and kick, keep the percussion energetic, and make the backing vocals sit naturally behind the lead vocal.",
  mastering:
    "Master this Afrobeats track for a polished commercial release. Keep the bass powerful but controlled, preserve the punch of the percussion, improve vocal clarity, and increase loudness without excessive distortion.",
};
