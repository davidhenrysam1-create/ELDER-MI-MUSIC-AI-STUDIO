import type { StudioId } from "@/lib/types";

/**
 * Single source of truth for the capability matrix.
 *
 * "ready"      → fully implemented and verified in this repository.
 * "needs"      → implemented, but requires an external service / credential.
 * "external"   → deliberately not bundled; a documented workflow is offered.
 * "planned"    → not implemented yet. Never presented as working.
 */
export type CapabilityStatus = "ready" | "needs" | "external" | "planned";

export interface Capability {
  name: string;
  area: "Platform" | "Sam Vocal Studio" | "Sam Mix Studio" | "Sam Mastering Studio";
  status: CapabilityStatus;
  detail: string;
}

export const STATUS_LABEL: Record<CapabilityStatus, string> = {
  ready: "Implemented",
  needs: "Awaiting configuration",
  external: "External workflow",
  planned: "Planned",
};

export const CAPABILITIES: Capability[] = [
  {
    name: "Accounts, sign-in and per-account libraries",
    area: "Platform",
    status: "ready",
    detail:
      "Scrypt password hashing, HttpOnly session cookies (the database stores only a hash), 30-day expiry, password change that revokes other sessions, and ownership checks on every project, asset, export and profile.",
  },
  {
    name: "Share a project with friends by private link",
    area: "Platform",
    status: "ready",
    detail:
      "Read-only `/s/<token>` page exposing only mixer-channel audio, with optional download, expiry and passcode, instant revocation, and hashed tokens (the link is shown once).",
  },
  {
    name: "Email verification, password-reset mail and email changes",
    area: "Platform",
    status: "planned",
    detail:
      "No mail service is configured, so none of these are offered rather than faked. Recovery is done by the person running the server.",
  },
  {
    name: "Public artist pages, follows and a social feed",
    area: "Platform",
    status: "planned",
    detail:
      "Sharing is per-project, per-link and revocable. There is no public discovery, no follower graph and no comment system.",
  },
  {
    name: "Generation billing guards (paid off by default, hard spend cap)",
    area: "Platform",
    status: "ready",
    detail:
      "`allowPaidGeneration` defaults to off and refuses requests with 403; an estimate that would pass `spendCapUsd` is refused with 402. Every charge is an estimate from published per-second prices — the provider invoice is authoritative.",
  },
  {
    name: "A local model bundled with the studio",
    area: "Platform",
    status: "planned",
    detail:
      "No neural model is bundled: the download is a browser studio, not a model runtime. All generation is hosted and requires an API key.",
  },
  {
    name: "Project creation, private audio storage and persistence",
    area: "Platform",
    status: "ready",
    detail:
      "Projects, audio objects, versions, exports and jobs are stored on the studio server (JSON index + private files). Deleting a project removes its files.",
  },
  {
    name: "Upload validation & format support",
    area: "Platform",
    status: "ready",
    detail:
      "WAV, AIFF, FLAC, MP3, OGG and M4A are decoded in the browser with size and duration limits enforced again on the server.",
  },
  {
    name: "Non-destructive workflow",
    area: "Platform",
    status: "ready",
    detail:
      "Uploads are never overwritten. Vocal layers, bounces and masters are new audio objects linked back to their source.",
  },
  {
    name: "Waveform rendering, transport and seeking",
    area: "Platform",
    status: "ready",
    detail:
      "Peak envelopes are extracted from real samples and rendered on canvas. Range-request streaming lets the player seek.",
  },
  {
    name: "Prompt improvement (Improve My Prompt)",
    area: "Platform",
    status: "ready",
    detail:
      "Gemini is used when GEMINI_API_KEY is set; otherwise a deterministic music-production rule engine runs and is labelled as such.",
  },
  {
    name: "Cloud storage / multi-server hosting",
    area: "Platform",
    status: "planned",
    detail:
      "Accounts are isolated logically but stored on one node (JSON index + files under .data). Supabase/Postgres with object storage is the path to running several servers; it is not implemented.",
  },
  {
    name: "Vocal layers: chorus, harmony, ad-lib, double, choir, backing",
    area: "Sam Vocal Studio",
    status: "ready",
    detail:
      "Real local DSP: granular pitch shifting, detune, ensemble spread, filtering and reverb applied to your own recording. Outputs are separate editable lanes.",
  },
  {
    name: "Vocal arrangement assistant",
    area: "Sam Vocal Studio",
    status: "ready",
    detail:
      "Produces a section-by-section written plan from the brief and tempo. Applying it changes generator settings only — no audio is fabricated.",
  },
  {
    name: "Neural voice transformation / voice cloning",
    area: "Sam Vocal Studio",
    status: "needs",
    detail:
      "Requires a licensed conversion provider plus consent. The tool is shown as unavailable; no fake output is produced.",
  },
  {
    name: "Generated vocals and songs (hosted models)",
    area: "Sam Vocal Studio",
    status: "needs",
    detail:
      "Implemented against ElevenLabs Music (`ELEVENLABS_API_KEY`) and Replicate MusicGen (`REPLICATE_API_TOKEN`). Needs your own provider key; nothing renders without one, and the licence is the vendor's.",
  },
  {
    name: "Singing synthesis from your own lyrics with a local model",
    area: "Sam Vocal Studio",
    status: "planned",
    detail:
      "No singing voice model ships with the studio. Hosted generation (above) writes new audio from a text brief; it does not sing your lyric sheet with your voice.",
  },
  {
    name: "Beat and instrumental generation (hosted models)",
    area: "Sam Mix Studio",
    status: "needs",
    detail:
      "Implemented against Google Lyria 2 (`GOOGLE_API_KEY` / Vertex token), Stability Stable Audio 2 (`STABILITY_API_KEY`) and Replicate MusicGen (`REPLICATE_API_TOKEN`). Needs a key; results are imported as ordinary editable audio with prompt and licence recorded.",
  },
  {
    name: "Automatic stem separation of a generated or uploaded mix",
    area: "Sam Mix Studio",
    status: "planned",
    detail:
      "Not wired up. A hosted Demucs model on Replicate is the intended path; until then split stems in your own tool and import them here.",
  },
  {
    name: "Stem import incl. ZIP packages",
    area: "Sam Mix Studio",
    status: "ready",
    detail:
      "Individual files or a ZIP of stems are unpacked in the browser, validated and given their own mixer channels.",
  },
  {
    name: "Native FL Studio / Cubase project import",
    area: "Sam Mix Studio",
    status: "external",
    detail:
      "Native projects depend on plugins and libraries that cannot be reconstructed. `.flp`/`.cpr` files are detected and explained; consolidated stem export is the supported path.",
  },
  {
    name: "Mixer: gain, pan, 3-band EQ, compression, sends, width, groups",
    area: "Sam Mix Studio",
    status: "ready",
    detail:
      "Native Web Audio processing with per-channel sends, three group buses, true-peak safety limiting and offline bounce.",
  },
  {
    name: "AI mixing recommendations with reviewable channel values",
    area: "Sam Mix Studio",
    status: "ready",
    detail:
      "Gemini or the local rule engine proposes stages with concrete channel values. Nothing is applied until you select and confirm.",
  },
  {
    name: "Measured audio analysis (LUFS, true peak, tone, width)",
    area: "Sam Mastering Studio",
    status: "ready",
    detail:
      "ITU-R BS.1770-4 gated loudness, 4× oversampled true peak, crest factor, loudness range, correlation and octave band balance — computed from your audio.",
  },
  {
    name: "Mastering profiles and processing chain",
    area: "Sam Mastering Studio",
    status: "ready",
    detail:
      "Seven starting points drive tonal shelves, glue compression, width, saturation and a look-ahead true-peak limiter measured after render.",
  },
  {
    name: "A/B comparison with loudness matching",
    area: "Sam Mastering Studio",
    status: "ready",
    detail:
      "Switches between the original and master at the same playback position, attenuating the louder version using measured integrated loudness.",
  },
  {
    name: "WAV (16/24/32-bit) and MP3 320 export",
    area: "Sam Mastering Studio",
    status: "ready",
    detail:
      "Encoded in the browser, then stored privately and listed in Export History with measured loudness. MP3 requires 32/44.1/48 kHz.",
  },
  {
    name: "Automated reference masters / distribution delivery",
    area: "Sam Mastering Studio",
    status: "planned",
    detail:
      "No automated streaming delivery or reference-track matching is included. A preset is a starting point, not a guarantee.",
  },
];
