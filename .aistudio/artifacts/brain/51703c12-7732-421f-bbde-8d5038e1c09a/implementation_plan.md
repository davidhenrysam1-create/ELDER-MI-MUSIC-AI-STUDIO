# Elder Mi Music AI Studio — Architectural Implementation Plan

Elder Mi Music AI Studio is a professional, interactive, AI-powered music production platform tailored for Afrobeats and African genres ("Your Sound. Your Culture. Your Studio."). This plan outlines the technical architecture, visual design system, and phased implementation for a native Android Digital Audio Workstation (DAW) and cloud processing service across three core workspaces: **Sam Vocal Studio**, **Sam Mix Studio**, and **Sam Mastering Studio**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified and confirmed with the user in Phase 1:
> - **Platform & UI Client**: Native Android DAW built with 100% Kotlin and Jetpack Compose, offering fluid, low-latency touch controls and edge-to-edge hardware acceleration.
> - **AI Audio Engine**: Hybrid architecture with local Android playback and canvas metering paired with a dedicated cloud audio microservice (Python, FFmpeg, PyTorch/Demucs, Librosa) and Google Gemini 3.5 Flash for natural-language prompt enhancement and arrangement guidance.
> - **Release Scope**: All three studios—**Sam Vocal Studio**, **Sam Mix Studio**, and **Sam Mastering Studio**—will be built concurrently with a shared project workflow.

---

## 1. Overview & Core Concept

- **What It Does**: Provides an end-to-end music production suite for Afrobeats producers, beatmakers, and sound engineers. Users can upload instrumentals, stems, or full songs, generate vocal arrangements (AI choruses, South African-inspired choirs, harmonies, ad-libs), mix multitrack stems with AI guidance, and master final releases with real LUFS and True Peak analysis.
- **Target Audience**: Afrobeats, Amapiano, Afro-pop, and Afro-fusion producers—from bedroom beatmakers wanting radio-ready vocal arrangements to experienced mixing engineers seeking accelerated stem balancing and release mastering.
- **Key Value**: Merges creative African musicality with high-precision digital audio workstation controls in a unified, non-destructive, African-futuristic interface.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Project Initiation & Dashboard**: Producer launches into a dark, glowing Afrobeats studio dashboard featuring quick stats, recent sessions, and three distinct workspace entry points.
2. **Sam Vocal Studio Flow**: Producer uploads an instrumental or lead vocal; sets harmony, choir, or chorus parameters; refines the prompt with Gemini AI; and edits generated vocal layers across interactive timeline lanes (Lead, Harmony, Choir, Ad-lib, Double).
3. **Sam Mix Studio Flow**: Producer imports stems or reviews FL Studio/Cubase export guidance; uses the AI Mixing Assistant with "Improve My Prompt" to establish genre balance; reviews AI recommendations; and fine-tunes channel faders, 3-band EQ, compressor, reverb, and delay.
4. **Sam Mastering Studio Flow**: Producer loads the final mix; inspects live acoustic measurements (Integrated LUFS, True Peak, dynamic spread); selects from 7 Afrobeats mastering profiles; engages loudness-matched A/B comparison; and exports verified WAV/MP3 files.

### Visual Identity & Theme
- **Aesthetic Direction**: African-Futuristic Glassmorphic DAW. Combines the tactile precision of a physical console with vibrant, glowing neon accents inspired by modern African music culture.
- **Color Palette**:
  - `Deep Midnight` (`#090914`): Main backdrop
  - `Dark Indigo` (`#15112B`): Layered panel background
  - `Electric Purple` (`#8B5CF6`) & `Neon Violet` (`#A855F7`): Sam Vocal Studio identity
  - `Cyan Blue` (`#22D3EE`): Sam Mix Studio identity & active indicators
  - `Magenta / Hot Pink` (`#EC4899`): Accents, highlights, and recording states
  - `Warm Orange` (`#FB923C`) & `Golden Yellow` (`#FACC15`): Sam Mastering Studio identity
  - `Soft White` (`#F8FAFC`): Primary readable text
  - `Muted Secondary` (`#A1A1B5`): Technical labels and scale markings
- **Typography & Hierarchy**:
  - Headers: African-futuristic display gradient typography for brand headings and studio names.
  - Body & Meters: High-contrast monospace and clean sans-serif for decibel values, timecodes, and parametric readouts.
- **Glassmorphism & Surfaces**:
  - Translucent cards with subtle gradient borders (1.dp Cyan-to-Purple stroke).
  - Layered visual depth with soft ambient glows and backdrop blur.
  - Tactile interactive controls: Rotary pots, motorized faders, LED VU meters, and dynamic canvas waveforms.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native Android (Kotlin + Jetpack Compose) with Media3**
  - *Chosen Approach*: Build the full client natively on Android using Jetpack Compose for the UI, Media3 ExoPlayer for multi-track synchronized playback, and custom Compose Canvas for 60fps waveform and meter rendering.
  - *Why*: Delivers responsive multi-touch mixing, eliminates browser audio thread latency, and supports tablets and mobile devices with fluid layout adaptation.
  - *Alternatives Considered*: Web-based Next.js inside a WebView (rejected due to audio thread throttling and jitter on touchscreens).

- **Decision 2: Cloud Processing Microservice for Heavy AI Audio**
  - *Chosen Approach*: Lightweight client orchestration coupled with a Python FastAPI microservice utilizing FFmpeg, Librosa, and Demucs for heavy stem separation and neural synthesis, with Gemini 3.5 Flash for prompt refinement.
  - *Why*: Mobile hardware cannot run deep neural models like stem separators or singing voice synthesizers without severe thermal throttling and battery exhaustion.
  - *Alternatives Considered*: On-device ONNX inference (rejected due to 4GB+ model sizes and Android memory limits).

- **Decision 3: Non-Destructive Multitrack Editing**
  - *Chosen Approach*: All original recordings and imported stems remain pristine. Generated vocal layers and mix adjustments are stored as non-destructive parameter overlays.
  - *Why*: Gives producers confidence to experiment without risking their primary takes or stems.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Elder Mi Music AI Studio                        │
│                (Native Android Client - Jetpack Compose)               │
├────────────────────────────────────────────────────────────────────────┤
│  Top Bar: Project Status | Studio Switcher | Save Indicator | User     │
├────────────────────────────────────────────────────────────────────────┤
│  Navigation Rail / Bottom Nav:                                         │
│  [Dashboard] [Sam Vocal] [Sam Mix] [Sam Mastering] [Projects] [Settings]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────┐  ┌────────────────────┐  ┌─────────────────┐ │
│  │   Sam Vocal Studio   │  │   Sam Mix Studio   │  │  Sam Mastering  │ │
│  │  • AI Chorus         │  │  • Stem Drag/Drop  │  │  • LUFS Meter   │ │
│  │  • SA Choir Gen      │  │  • Channel Strips  │  │  • 7 Profiles   │ │
│  │  • Harmonies/Ad-libs │  │  • 3-Band EQ & FX  │  │  • A/B Compare  │ │
│  │  • Multitrack Lanes  │  │  • AI Mix Recom.   │  │  • WAV/MP3 Export││
│  └──────────┬───────────┘  └──────────┬─────────┘  └────────┬────────┘ │
│             │                         │                     │          │
├─────────────┴─────────────────────────┴─────────────────────┴──────────┤
│                       Global Audio Player Bar                          │
│          Play/Pause | Scrubber | Master Level | Mute / Solo            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────────┐                     ┌───────────────────────┐
│     Local Audio Engine    │                     │   Cloud Microservice  │
│  • Media3 ExoPlayer       │                     │  • Gemini 3.5 Flash   │
│  • AudioTrack Synthesis   │◄── REST / OkHttp ──►│  • Python / FastAPI   │
│  • Canvas Waveform Visual │                     │  • FFmpeg / Librosa   │
│  • RMS & Peak Metering    │                     │  • Demucs Stem Engine │
└───────────────────────────┘                     └───────────────────────┘
```

### Data Model & Entity Strategy
- **`Project`**: `id`, `name`, `genre` (Afrobeats, Amapiano, etc.), `bpm`, `key`, `tracks: List<AudioTrack>`, `masterSettings: MasterSettings`, `updatedAt`.
- **`AudioTrack`**: `id`, `name`, `stemType` (Lead, Harmony, Choir, Kick, Bass, etc.), `volume` (0.0 to 1.5), `pan` (-1.0 to 1.0), `isMuted`, `isSolo`, `eqLow`, `eqMid`, `eqHigh`, `reverbSend`, `delaySend`, `waveformAmplitudes: List<Float>`.
- **`MasterProfile`**: `id`, `name`, `targetLufs`, `truePeakCeiling`, `warmth`, `stereoWidth`, `compressionRatio`.
- **`AudioAnalysis`**: `integratedLufs`, `shortTermLufs`, `peakDbfs`, `truePeakDbfs`, `stereoCorrelation`, `dynamicSpread`.

---

## 5. Phased Implementation Roadmap

1. **Phase 1: Design Tokens & Base Shell**: Set up `metadata.json`, color palette, glassmorphism card wrappers, gradient typography, and navigation routing.
2. **Phase 2: Project Management & Global State**: Build project store, persistent playback engine, and global audio bar.
3. **Phase 3: Dashboard**: Interactive cards for the 3 studios, recent sessions, and audio upload shortcut.
4. **Phase 4: Sam Vocal Studio**: Multitrack vocal timeline, lane controls (Lead, Harmony, Choir, Ad-lib), and AI choir/harmony configuration modals.
5. **Phase 5: Sam Mix Studio**: Stem drop zone, FL Studio/Cubase guidance modal, AI mixing assistant with Gemini "Improve My Prompt", and mixer channel strips with EQ/compression/FX.
6. **Phase 6: Sam Mastering Studio**: Acoustic analysis displays (LUFS, True Peak), 7 mastering profiles, loudness-matched A/B toggle, and export engine.
7. **Phase 7: Build Verification**: Run `compile_applet` and verify zero compiler warnings, fluid responsiveness, and touch-target compliance.
