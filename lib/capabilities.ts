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
    name: "Durable storage (Supabase Postgres + Storage)",
    area: "Platform",
    status: "needs",
    detail:
      "The blob store and the database are pluggable drivers. With SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set, audio moves to a private bucket and the database to one Postgres row guarded by a revision number, so a reset or redeploy cannot take your music. This project's Supabase URL, bucket (tracks) and table (songs) are configured; the service-role key is still missing, so the studio stays on this machine's disk and Settings shows a red banner naming it.",
  },
  {
    name: "Open studio (no sign-in screen)",
    area: "Platform",
    status: "ready",
    detail:
      "Default mode: opening the app acts as the studio owner, so every studio, project, share link, public page and the admin console are reachable without signing in. Sign-in screens forward to the dashboard. Set STUDIO_ACCOUNTS=on to restore accounts and private libraries — no data is migrated or deleted either way.",
  },
  {
    name: "Accounts, sign-in and per-account libraries (STUDIO_ACCOUNTS=on)",
    area: "Platform",
    status: "ready",
    detail:
      "Scrypt password hashing, HttpOnly session cookies (the database stores only a hash), 30-day expiry, password change that revokes other sessions, and ownership checks on every project, asset, export and profile.",
  },
  {
    name: "Password reset by email",
    area: "Platform",
    status: "needs",
    detail:
      "`/forgot` mints a one-use token (SHA-256 stored, 1 hour), emails a link through Resend, `/reset` sets the new password and ends every session. Awaiting configuration: without RESEND_API_KEY and EMAIL_FROM the screen says plainly that no email was sent.",
  },
  {
    name: "Share a project with friends by private link",
    area: "Platform",
    status: "ready",
    detail:
      "Read-only `/s/<token>` page exposing only mixer-channel audio, with optional download, expiry and passcode, instant revocation, and hashed tokens (the link is shown once).",
  },
  {
    name: "Roles: artist, producer, engineer and promoter dashboards",
    area: "Platform",
    status: "ready",
    detail:
      "One account can hold several roles. Roles decide which of the three studios and which dashboard sections appear, are enforced again by the API, and can be changed by the account holder or by the admin.",
  },
  {
    name: "Admin console for every account",
    area: "Platform",
    status: "ready",
    detail:
      "The account named by ADMIN_EMAIL can list all accounts with their projects, files, storage and live share links, then set roles, mark an address verified, suspend (which ends that session immediately) or delete an account and its work. Admin sign-in: optional ADMIN_PASSWORD setup password, Google, or a one-time bootstrap code.",
  },
  {
    name: "Continue with Google",
    area: "Platform",
    status: "needs",
    detail:
      "Code-complete OAuth 2.0 flow (state cookie, code exchange, verified email). It stays visibly off until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set, and the sign-in screen says so instead of showing a button that cannot finish.",
  },
  {
    name: "Email verification links",
    area: "Platform",
    status: "needs",
    detail:
      "Tokens are issued, hashed and expire after 24 hours, and the admin can verify an address by hand. Sending needs RESEND_API_KEY and EMAIL_FROM; without them the app reports that nothing was sent.",
  },
  {
    name: "Public creator pages with social links",
    area: "Platform",
    status: "ready",
    detail:
      "`/u/<handle>` shows a creator's name, roles, bio and AudioMack / Instagram / Facebook links without revealing an email address. Whether a page exists at all is the creator's choice.",
  },
  {
    name: "Publish a song, with likes, follows and downloads",
    area: "Platform",
    status: "ready",
    detail:
      "Publish a finished file from one of your projects: public (Discover) or unlisted (your page only), listen-only or downloadable. Listeners can like, follow the creator and download when allowed; plays, downloads, likes and followers are real counts. The project, mixer and stems stay private.",
  },
  {
    name: "Comments, paid support and notifications",
    area: "Platform",
    status: "planned",
    detail:
      "Not built. There is no comment thread, no tipping/subscription and no email or push notification when someone follows or likes you. The UI labels these as planned.",
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
