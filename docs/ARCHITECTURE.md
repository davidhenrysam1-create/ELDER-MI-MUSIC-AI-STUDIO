# Elder Mi Music AI Studio — Architecture

> Companion to `README.md`. This document explains how the audio engine, persistence and
> capability boundaries are implemented, and why.

## 1. Product shape

- One shared project context across three workspaces: **Sam Vocal Studio**, **Sam Mix Studio**,
  **Sam Mastering Studio**.
- Non-destructive: uploads are immutable. Vocal layers, mix bounces and masters are new audio
  objects linked to their source (`derivedFromId`).
- Honest status: every capability is either implemented, awaiting configuration, external, or
  planned — see `lib/capabilities.ts`.

## 2. Runtime split

| Concern | Where | Why |
| --- | --- | --- |
| Decoding, DSP, rendering, encoding | Browser (`OfflineAudioContext`, in-house JS) | No audio upload of unknown size, low latency, no server CPU queue needed for a single-operator studio |
| Metadata, audio storage, export files | Server route handlers + `.data` | Persistence, private access, Range streaming |
| Prompt improvement / mix recommendations | Server (Gemini or local rules) | Keeps API keys out of the bundle; results are reviewable text |
| Job lifecycle | Browser renders, server records | Accurate statuses that survive reloads without a queue service |

## 3. Data model (`lib/types.ts`)

```
Database
├── projects[]
│   ├── assets[]        uploaded / generated audio metadata (+ waveform peaks)
│   ├── tracks[]        mixer channels (gain, pan, EQ, comp, sends, width, group)
│   ├── versions[]      studio-state snapshots (reversible restore)
│   ├── jobs[]          render lifecycle records
│   ├── mix             prompt, preset, recommendations, group buses, measurements
│   ├── vocal           tool, prompt, section, intensity, density, choir settings
│   └── mastering       profile, controls, source + master measurements, output config
├── exports[]           delivered files with measured loudness
├── voiceProfiles[]     consent-gated references
└── settings            defaults + upload limits
```

Audio binaries are **not** in the database: they live in `.data/audio/<assetId>.<ext>`, exports in
`.data/exports/`. Only waveform envelopes (~1200 floats) are stored with metadata.

`lib/server/db.ts` performs schema filling on load, so databases written by earlier builds keep
working (tested in `tests/store.test.ts`).

## 4. Audio engine

### 4.1 Measurement (`lib/audio/analysis.ts`)

- K-weighting: ITU-R BS.1770-4 high shelf (1681.974 Hz, +4 dB, Q 0.7072) + 38.136 Hz high-pass,
  implemented as RBJ biquads in double-precision state.
- Integrated loudness: 400 ms blocks, 100 ms hop, absolute −70 LUFS gate then −10 LU relative gate.
- Short-term (3 s) blocks feed loudness range (10th/95th percentiles).
- True peak: 4× windowed-sinc interpolation around high-amplitude neighbourhoods (fast and
  accurate for overshoot; method disclosed in the UI).
- Additional: sample peak, RMS, crest factor, mono correlation, side/mid width, clipping count,
  5-band octave energy balance.

Verified against the EBU-style reference (1 kHz, −23 dBFS stereo ≈ −23 LUFS) in `tests/dsp.test.ts`.

### 4.2 Mixing (`lib/audio/render.ts`)

Native graph per channel: source → low shelf 120 Hz → bell 1 kHz → high shelf 8 kHz → compressor
(12 ms / 160 ms, soft knee) → fader → optional mid/side width matrix → pan → master.
Shared reverb (generated impulse) and tempo delay buses receive post-pan sends. Group buses add
gain / mute in `lib/client/mixdown.ts`. After offline rendering: true-peak safety limiting and
verification. Solo logic is explicit (any solo → only soloed channels).

### 4.3 Vocal layering (`lib/audio/vocal.ts`, `lib/audio/pitch.ts`)

- Pitch shift = resample + Hann overlap-add time stretch (duration preserved).
- Tool plans (per tool) define voices: semitone offsets, cents detune, pan, level, delay, low-pass,
  slice/position and ensemble size. Choir spreads up to 24 voices over stacked intervals with a
  style-dependent tone profile.
- Output is stereo, positioned on the timeline, seated with a Schroeder-style reverb.
- The engine never invents lyrics; everything is derived from the user's recording. This is stated
  in the UI and in each asset's `engine` note.

### 4.4 Mastering (`lib/audio/render.ts → renderMaster`)

1. Offline graph: low shelf (90 Hz) + linked 320 Hz compensation, high shelf (8.5 kHz), glue
   compressor (ratio driven by dynamic preservation), mid/side width.
2. JS post: saturation (bounded), static gain to the loudness target.
3. Up to three limiter passes with measured integrated loudness feedback.
4. Final look-ahead limiter + true-peak verification (with a documented trim if the measured true
   peak exceeds the ceiling).
5. `analyzeBuffer` on the finished samples; the UI displays those measured values and the pass log.

### 4.5 Encoding

- WAV: in-house RIFF writer, 16/24-bit PCM or 32-bit float; TPDF dither optional for 16-bit.
- MP3: `lamejs` at 320 kbps CBR, 32/44.1/48 kHz; unsupported rates are rejected with an explanation.
- Exports are uploaded to `/api/exports` (so history stays downloadable) and downloaded to the
  device. Stored loudness values come from measurement.

## 5. Prompt/AI layer (`lib/server/promptEngine.ts`)

- `improvePrompt`: Gemini when configured; on failure or no key, the deterministic local
  production rule engine runs and the response carries `source` + an explanatory note.
- `mixRecommendations`: Gemini (JSON-validated) or local role-aware stages with bounded channel
  values. Unknown keys/out-of-range numbers are discarded (`sanitizeSettings`).
- Neither path receives audio. Neither invents measurements.

## 5b. Music generation (`lib/server/providers/*`, `lib/server/generation.ts`)

The only place the studio *creates* audio rather than processing yours.

**Adapter contract** (`lib/server/providers/types.ts`)

```ts
interface MusicProvider {
  descriptor(): ProviderDescriptor;                 // public, recomputed per call
  start(request): Promise<ProviderStart>;           // "ready" | "pending"
  poll(providerJobId, request): Promise<ProviderStart>;
  cancel?(providerJobId): Promise<void>;            // async providers only
}
```

- `descriptor().configured` is derived **only** from environment variables, so the UI cannot claim a
  provider works when it has no key.
- Failures throw `ProviderError { message, status, retryable }`. The vendor's own wording is preserved
  and shown in the job list; 429/5xx/timeouts are `retryable`, auth and validation errors are not.
- `http.ts` wraps `fetch` with a timeout (60 s default, 120–240 s per adapter), an AbortController,
  JSON/bytes readers, empty-body detection and `ProviderError` mapping.

**Adapters**

| File | Provider | Shape | Notes |
| --- | --- | --- | --- |
| `lyria.ts` | Google Lyria 2 (`lyria-002`, Vertex `:predict`) | synchronous | base64 WAV in `predictions[0]`; caps at 30 s; credential = API key or access token + project |
| `stableAudio.ts` | Stability Stable Audio 2 | synchronous | multipart form → raw WAV body; path configurable via `STABLE_AUDIO_PATH` |
| `elevenlabs.ts` | ElevenLabs Music (`music_v1`) | synchronous | JSON → MP3 body; length in ms; kind folded into the prompt |
| `replicate.ts` | MusicGen (`meta/musicgen`) | asynchronous | create prediction → poll → download the delivery URL; `cancel` posts `/cancel` |

**Orchestration** (`lib/server/generation.ts`)

1. Validate: project exists, descriptor configured, kind supported, prompt 6–600 chars, duration
   clamped to the adapter's max.
2. Budget gates run **before** any network call: `allowPaidGeneration === false` → 403; estimate +
   `spend.lifetimeUsd > spendCapUsd` → 402.
3. Persist a `GenerationJob`, call `start`. `ready` → store; `pending` → job stays `running` with the
   provider's handle.
4. `storeResult` writes the bytes to private storage, decodes WAV for real peaks/duration (`MP3` has no
   server decoder, so peaks stay empty until the browser plays it), builds the `AssetMeta` with
   `provenance`, appends a mixer channel (`makeTrack`), promotes the first generated vocal to the
   vocal source, charges the spend ledger and marks the job complete.
5. Runtime failures mark the job `failed` with the vendor message and charge nothing. Cancelling a
   pending job clears it with no charge.

**Client** — `components/studio/GeneratePanel.tsx` reads `GET /api/providers` (catalogue + spend), shows
the live estimate from `estimateUsdPerSecond`, then `POST /api/generate` and polls
`GET /api/generate/:id` every 4 s for asynchronous providers. With no key, it renders setup
instructions instead of a generate button.

**Money model** — costs are estimates from `*_USD_PER_SEC` (defaults: Lyria 0.002, Stable Audio 0.0015,
ElevenLabs 0.01, MusicGen 0.0009 USD/s) rounded to cents, stored in `db.spend.lifetimeUsd`. They are
tracked, not billed: the vendor invoice is authoritative and every screen says so.

## 6. API surface

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/projects` | GET, POST | list / create |
| `/api/projects/:id` | GET, PATCH, DELETE | patch ignores `id`/`createdAt`; DELETE removes files |
| `/api/projects/:id/assets` | POST | multipart; extension, size, duration validation; optional channel creation |
| `/api/projects/:id/jobs` | POST | job lifecycle records |
| `/api/projects/:id/versions` | GET, POST, PUT | save / restore (restore stores a pre-restore checkpoint at the route layer) |
| `/api/projects/:id/duplicate` | POST | shares audio objects; deletion is reference-counted |
| `/api/assets/:id` | DELETE | requires `projectId`; unlinks tracks and versions |
| `/api/assets/:id/audio` | GET | private stream with Range support |
| `/api/exports` | GET, POST | multipart delivery storage |
| `/api/exports/:id` | GET, DELETE | attachment download / delete |
| `/api/voice-profiles` | GET, POST | consent required (403 otherwise) |
| `/api/prompt/improve` | POST | Gemini or labelled local engine |
| `/api/mix/recommendations` | POST | validated recommendation stages |
| `/api/system` | GET | providers, engines, storage, settings |
| `/api/settings` | GET, PATCH, DELETE | defaults / purge; `allowPaidGeneration`, `spendCapUsd` |
| `/api/providers` | GET | generation catalogue, licence, cost estimate, spend summary |
| `/api/generate` | GET, POST | list jobs / create (budget-gated, 403/402/400) |
| `/api/generate/:id` | GET, DELETE | advance a pending job / cancel and charge nothing |

## 7. UI system

- `components/shell/*`: persistent navigation, project switcher, save status, notifications,
  mobile drawer, global player.
- `components/audio/*`: canvas waveform (real peaks, keyboard-seekable), upload zone with
  validation feedback, section overlay, transport.
- `components/studio/*`: prompt editor with labelled results, analysis panel, mixer strips and
  faders, job runner + status card, asset pickers, project gate, generation panel.
- Design tokens live in `tailwind.config.ts` and `app/globals.css` (glass surfaces, gradients,
  focus rings, reduced-motion support).

## 8. Multi-device delivery

One codebase serves every screen size; there is no separate mobile build.

| Layer | Implementation |
| --- | --- |
| Layout | Phone-first Tailwind breakpoints (`xs` 400, `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `3xl` 1800) plus `short`/`coarse` media variants. Sidebar becomes a drawer below `lg`; studios get a compact tab bar. |
| Viewport | `width=device-width`, `viewport-fit=cover`, `100dvh` shell, `env(safe-area-inset-*)` padding on the player, top bar and modal footers. |
| Touch | 16px form fields on `<=640px` (prevents iOS focus zoom), 34px slider tracks and 22px thumbs on `pointer: coarse`, waveform seek uses `touch-action: none` + pointer capture. |
| Overflow | Mixer strips scroll horizontally with snap points (`.scroll-x`), tables scroll inside their panels, modals become bottom sheets with an internally scrolling body. |
| Install | `app/manifest.ts` (standalone, any orientation, maskable icon, three studio shortcuts), `app/apple-icon.png`, Next-generated `/icon.png`, and `components/pwa/PwaBridge.tsx` handling `beforeinstallprompt` plus the iOS Share-sheet instructions. |
| Offline | `public/sw.js` precaches the shell, caches static assets cache-first with background refresh, is network-first for navigations with a cached/`/offline` fallback, and deliberately never caches `/api/*` or audio (stale + privacy). Registered only in production builds. |
| Print | Light print stylesheet for reports and capability tables. |

## 9. Known trade-offs

- Granular pitch shifting is not a phase vocoder; extreme shifts sound artefacty. Acceptable for
  doubles/choir support layers and disclosed in the docs.
- Global 48 kHz Web Audio working rate; file metadata reports the header rate where available.
- Rendering happens on one thread per job; long files are chunked with progress yields but not
  worker-pooled yet.
- Single-operator storage: `.data` on disk. Multi-tenant hosting requires swapping the repository
  layer.
- Rendering happens on the client device, so a phone is slower than a laptop for long bounces; the
  render section selector exists for that.
- Generated audio quality and licensing are the vendor's; the licence string is stored per asset but the
  studio cannot verify your plan or territory. Read the provider terms before release.
- Cost figures are estimates from published per-second prices, not a billing integration; a job that
  fails after the vendor charges you is not reconciled.
- No local model ships. Offline, the Generate panel is inert and the local DSP is unaffected.
- Access control is a single optional Basic-auth gate (`STUDIO_PASSWORD`). It is not a user system:
  no roles, sessions, per-user libraries or audit trail.
