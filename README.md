# Elder Mi Music AI Studio

**Your Sound. Your Culture. Your Studio.**

An Afrobeats-first production platform with three connected workspaces:

| Workspace | Purpose |
| --- | --- |
| **Sam Vocal Studio** | AI-assisted choruses, harmonies, ad-libs, vocal doubles, backing vocals and South-African-inspired choir stacks built from your own recording. |
| **Sam Mix Studio** | Stem import (including ZIP packs), a real mixing console (gain, pan, EQ, compression, sends, width, groups), AI mixing stages you review before applying, measured mix analysis and verified bounces. |
| **Sam Mastering Studio** | Measured loudness/true-peak analysis, seven mastering starting points, a real processing chain, loudness-matched A/B comparison, technical reports and WAV/MP3 delivery. |

This is a working application, not a landing page or a visual prototype: audio is decoded,
processed, measured, stored and exported for real.

---

## 1. What was here before

The repository started as a **Kotlin/Jetpack Compose Android prototype** (`app/src/main/java/com/example/...`).
It could not be built in this environment (no JDK/Android SDK) and much of it was simulated:
random VU values, a synthetic sine "player", hard-coded LUFS numbers and an "export complete"
message with no file. The master brief requires a Next.js web application and explicitly forbids
fake audio results, so the Android prototype was replaced by this web studio. It remains in the
Git history, and the architecture/plan documents are kept in [`plan_app.txt`](./plan_app.txt) and
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## 2. Quick start

```bash
npm install
cp .env.example .env.local     # optional: add a Gemini key
npm run dev                    # http://localhost:3000
```

The dev server binds to `0.0.0.0:3000`. Private audio and the project index live in `./.data`
(created automatically, git-ignored).

Production:

```bash
npm run build
npm start
```

> **Deployment note:** `.data` must be a persistent volume. Serverless platforms with an ephemeral
> filesystem will lose audio between requests. For multi-user hosting, replace
> `lib/server/db.ts` + `lib/server/storage.ts` with Postgres/Supabase and object storage; all
> callers use the same repository functions.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:3000` |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit/integration tests (DSP, prompt engine, persistence) |

---

## 3. Using the studio

1. **Create a project** (dashboard → *Create New Project*): name, genre, tempo, key.
2. **Vocal work** — in *Sam Vocal Studio*, upload an instrumental or a lead vocal, choose a tool
   (chorus, harmony, ad-lib, choir, doubling, backing), set intensity/density/layers and the render
   section, then *Generate*. Each result becomes its own lane with play, mute, solo, volume, pan,
   reverb send, width, rename, reorder, re-render and export. Use *Arrangement assistant* to review a
   written section-by-section plan before applying it to the settings.
3. **Mixing** — in *Sam Mix Studio*, drop stems (individually or as one ZIP). Each file becomes a
   channel. Pick a genre starting point, describe the mix, press *Improve My Prompt*, then
   *Apply Mixing Recommendations* to get reviewable stages with concrete channel values. Apply a
   selection, fine-tune the console, *Analyse mix* to measure it, then *Bounce mix*.
4. **Mastering** — in *Sam Mastering Studio*, the latest bounce is preselected. *Analyse source*,
   choose a profile, adjust the targets, *Render master*, compare original vs master with loudness
   matching, then open the *Technical report* and export WAV/MP3.
5. **Everything persists** — projects, audio objects, mixer state, mastering targets, versions,
   jobs and exports are stored server-side. "Save version" snapshots the studio state; restoring is
   reversible.

### Supported audio

- Uploads: WAV, AIFF, FLAC, MP3, OGG, M4A (browser decode) — default limits 80 MB / 12 min.
- Stem packages: `.zip` is unpacked in the browser; non-audio entries are ignored.
- Exports: WAV 16-bit (TPDF dither, optional), WAV 24-bit, WAV 32-bit float, MP3 320 kbps.
- Native **.flp** / **.cpr** projects are detected and explained rather than reconstructed — a guide
  for exporting consolidated stems is built into Sam Mix Studio.

---

## 4. What is real, what needs configuration

`Settings → Capability matrix` and `/docs` show the same table. Summary:

**Implemented and exercised**

- Browser-side decoding, canvas waveforms from real sample peaks, Range-request streaming, seeking.
- ITU-R BS.1770-4 gated loudness, 4× oversampled true peak, crest factor, loudness range, stereo
  correlation/width, octave-band balance, clipping detection.
- Channel EQ (low shelf 120 Hz, bell 1 kHz, high shelf 8 kHz), native compression, reverb/delay
  sends, per-channel and group faders, mid/side width, mix-bus gain and a true-peak safety limiter.
- Vocal layering with granular pitch shifting, detune, ensemble spread, filtering and reverb.
- Mastering chain: tonal shelves, glue compression, width, saturation, look-ahead limiter with
  post-render true-peak verification and iterative loudness targeting.
- WAV/MP3 encoding, private storage, export history, project versions, atomic JSON persistence.

**Implemented, awaiting a provider/credential**

- *Improve My Prompt* and AI mixing stages use **Gemini** when `GEMINI_API_KEY` is set. Without it,
  a deterministic music-production rule engine runs and the response is labelled
  `local-heuristic` — the UI never claims a model was called.
- **Neural voice transformation** requires a licensed external provider and explicit consent. The
  tool is disabled and explains why; no placeholder audio is produced.

**Deliberately not implemented**

- AI singing synthesis from lyrics, automated reference-track matching, native DAW project
  reconstruction, multi-user accounts/cloud storage. These are listed as planned/unsupported rather
  than faked.

---

## 5. Configuration

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Optional. Enables Gemini prompt improvement and mixing stages. Read server-side only. |
| `GEMINI_MODEL` | Optional, default `gemini-2.5-flash`. |
| `DATA_DIR` | Optional private data directory (default `./.data`). |
| `MAX_UPLOAD_MB`, `MAX_DURATION_SEC` | Default upload limits; editable in Settings. |
| `VOICE_CONVERSION_API_URL` | Reserved for a licensed voice-conversion adapter. |
| `STUDIO_PASSWORD`, `STUDIO_USER` | Optional HTTP Basic auth for the whole studio. |

Secrets never reach the browser: API routes read them and return only results.

---

## 6. Architecture

```
app/                     Next.js App Router pages + API route handlers
  page.tsx               Dashboard
  vocal|mix|mastering/   The three studios
  projects|voice-profiles|exports|settings|docs/
  api/                   projects, assets (upload/stream), exports, jobs,
                         prompt improvement, mixing recommendations, settings
components/              Shell, audio widgets (waveform, player, upload), studio panels
lib/
  audio/                 DSP: analysis, pitch, render, WAV/MP3, peaks, arrangement
  client/                Studio provider, API client, audio cache, mixdown, ZIP, export
  server/                JSON store, repository, storage, prompt engine, validation
  types.ts, projects.ts  Domain model and defaults
tests/                   Vitest suites (DSP, prompt engine, persistence, migration)
```

- **Rendering happens in the browser** (`OfflineAudioContext` + in-house JS post-chain), so uploaded
  audio is never sent to a third party and long renders don't block the server. Job lifecycles are
  recorded server-side so status survives a reload.
- **Analysis is computed from samples** in `lib/audio/analysis.ts`; no value is pre-filled.
- **Writes are atomic** (temp file + rename) and serialised; every mutation is persisted.
- Design system: deep midnight surfaces, translucent glass panels, gradient display typography,
  neon accents, keyboard-accessible controls and `prefers-reduced-motion` support.

---

## 7. Security & privacy

- Private audio is stored outside `public/` and served only through `/api/assets/:id/audio`, which
  requires the owning project id and supports ranges.
- Uploads are validated by extension, size and duration on the server as well as in the browser.
- Original files are never overwritten; every generated layer, bounce and master is a new object.
- Deleting a project removes its audio files and exports. Settings → *Delete all studio data* wipes
  everything.
- Voice profiles require explicit consent (name + confirmation) before they can be created.
- No audio leaves the studio server; Gemini receives **text prompts only**, and only if configured.

This build is a **single-operator studio**. Auth is optional and off by default so local use needs no
setup: set `STUDIO_PASSWORD` (and optionally `STUDIO_USER`, default `studio`) to require HTTP Basic
credentials for every page and API route through `middleware.ts`. For a public deployment also put the
app behind a reverse proxy or platform auth, and add multi-user accounts by extending the repository
layer.

---

## 8. Testing

```bash
npm test          # 100 tests
npm run typecheck
npm run build
```

Covered (`tests/`):

- API contracts: project validation, upload rejection for native DAW files and oversized audio,
  channel-role guessing, version restore checkpoints, export measurement coercion, settings clamps,
  consent-gated voice profiles, labelled AI fallbacks.
- Client pages: every studio and supporting page renders with and without a project, the DAW guide
  opens, a genre preset writes into the project, a mastering profile loads its controls, and the
  voice-transformation tool reports that it needs configuration instead of producing audio.
- UI kit: icons, gradient headings, segmented control behaviour, progress semantics, and a guard
  that fails if a Tailwind opacity step that does not compile (e.g. `border-white/8`) sneaks in.
- Loudness: a 1 kHz, −23 dBFS stereo tone measures ≈ −23 LUFS (EBU-style reference).
- True peak never reports below the sample peak and catches inter-sample overshoot.
- Limiter output respects its ceiling; width control collapses to mono; saturation is stable.
- WAV header round-trip for 16/24-bit PCM and 32-bit float.
- Pitch shift preserves duration and shifts pitch by the expected octave ratio.
- Prompt engine: labelled local fallback, no fabricated claims, bounded recommended settings,
  API-level rejection of empty briefs.
- Persistence: create/patch/reload, atomic JSON, asset file deletion, version save/restore, export
  records, legacy schema migration, purge, file-name sanitisation.
- Helpers: arrangement plans, DAW/MIDI import guardrails, time/byte/level formatting, export file
  naming, preset and prompt-seed integrity.

---

## 9. Limitations & roadmap

- Vocal layers are DSP arrangements of your recording; they are **not** synthetic singing. The
  granular pitch engine is intended for harmony/double/choir layering and shows artefacts on extreme
  shifts.
- Analysis/render time scales with length; on low-power devices trim the render section.
- MP3 encoding supports 32/44.1/48 kHz (lamejs limitation) — the UI explains this instead of failing
  silently.
- Planned: multi-user auth, object storage, job queue, neural voice conversion adapter, stem
  separation, reference-target mastering.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the deeper design notes and
[`/docs`](http://localhost:3000/docs) in the running app for the in-product version.
