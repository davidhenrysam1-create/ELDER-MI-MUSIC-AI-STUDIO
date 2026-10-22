import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { CAPABILITIES, STATUS_LABEL } from "@/lib/capabilities";
import { MASTER_PROFILES, MIX_PRESETS, VOCAL_TOOLS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Studio documentation — Elder Mi Music AI Studio",
};

const ENV_VARS = [
  {
    key: "GEMINI_API_KEY",
    detail:
      "Optional. Enables Gemini prompt improvement and AI mixing stages. Read only on the server; never bundled into the browser.",
  },
  {
    key: "GEMINI_MODEL",
    detail: "Optional. Model id, default gemini-2.5-flash.",
  },
  {
    key: "DATA_DIR",
    detail: "Optional. Where the JSON index and private audio files live (default ./.data).",
  },
  {
    key: "MAX_UPLOAD_MB / MAX_DURATION_SEC",
    detail: "Optional defaults for upload limits (80 MB / 720 s). Editable in Settings.",
  },
  {
    key: "VOICE_CONVERSION_API_URL",
    detail:
      "Reserved for a licensed voice-conversion adapter. When unset, voice transformation stays disabled.",
  },
];

export default function DocsPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <GradientText>Studio documentation</GradientText>
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            How the engine actually works, what it will and will not do, and how to configure or
            deploy it. This page mirrors <span className="mono">README.md</span> in the repository.
          </p>
        </div>
        <StatusPill tone="info" icon="info">
          v1.0 · local-first
        </StatusPill>
      </div>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Quick start</h2>
        <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          <li>
            1. <span className="text-softwhite">Create a project</span> from the dashboard and give it
            a name, genre, tempo and key.
          </li>
          <li>
            2. <span className="text-softwhite">Upload audio</span> in Sam Vocal Studio (instrumental
            or lead vocal) or Sam Mix Studio (stems / ZIP of stems).
          </li>
          <li>
            3. <span className="text-softwhite">Generate vocal layers</span>, review each lane, and
            bounce them if you want a vocal stem mix.
          </li>
          <li>
            4. <span className="text-softwhite">Mix</span> the channels, analyse the mix, bounce it.
          </li>
          <li>
            5. <span className="text-softwhite">Master</span> the bounce with a profile, compare A/B,
            then export WAV or MP3.
          </li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/vocal" className="btn-primary text-xs">
            <Icon name="mic" size={13} /> Sam Vocal Studio
          </Link>
          <Link href="/mix" className="btn-ghost text-xs">
            <Icon name="sliders" size={13} /> Sam Mix Studio
          </Link>
          <Link href="/mastering" className="btn-ghost text-xs">
            <Icon name="disc" size={13} /> Sam Mastering Studio
          </Link>
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard>
          <h2 className="text-base font-semibold text-softwhite">What runs for real</h2>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
              Audio is decoded and rendered in the browser with the Web Audio API; nothing about
              playback or export is animated mock-up.
            </li>
            <li className="flex gap-2">
              <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
              Loudness (ITU-R BS.1770-4 gated), true peak (4× oversampled), crest factor, LRA,
              correlation and octave-band balance are computed from the samples you loaded.
            </li>
            <li className="flex gap-2">
              <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
              EQ, compression, sends, width, saturation and limiting are applied by real DSP, then
              re-measured. The UI shows the measured result, not a prediction.
            </li>
            <li className="flex gap-2">
              <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
              Vocal layers are derived from your own recording with granular pitch shifting and
              ensemble DSP — they are not synthesised singing.
            </li>
            <li className="flex gap-2">
              <Icon name="info" size={12} className="mt-0.5 shrink-0 text-cyan-300" />
              The AI layer (Gemini or the local rules engine) writes prompts, plans and suggested
              channel values. It never invents measured audio facts.
            </li>
          </ul>
        </GlassCard>

        <GlassCard>
          <h2 className="text-base font-semibold text-softwhite">What needs configuration</h2>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <Icon name="lock" size={12} className="mt-0.5 shrink-0 text-amber-300" />
              <span>
                <span className="text-softwhite">Neural voice conversion</span> needs a licensed
                provider and explicit consent. The tool stays disabled; no placeholder audio is
                generated.
              </span>
            </li>
            <li className="flex gap-2">
              <Icon name="lock" size={12} className="mt-0.5 shrink-0 text-amber-300" />
              <span>
                <span className="text-softwhite">Gemini</span> is optional. Without{" "}
                <span className="mono">GEMINI_API_KEY</span>, prompt improvement and mixing stages use
                the labelled local rule engine.
              </span>
            </li>
            <li className="flex gap-2">
              <Icon name="info" size={12} className="mt-0.5 shrink-0 text-cyan-300" />
              <span>
                <span className="text-softwhite">Native .flp / .cpr projects</span> are not
                reconstructed. Export consolidated stems instead — the guide is built into Sam Mix
                Studio.
              </span>
            </li>
            <li className="flex gap-2">
              <Icon name="info" size={12} className="mt-0.5 shrink-0 text-cyan-300" />
              <span>
                <span className="text-softwhite">Multi-user accounts</span> are not included; this is
                a single-operator studio on private local storage.
              </span>
            </li>
          </ul>
        </GlassCard>
      </div>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Workspace reference</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold">
              <GradientText variant="vocal">Sam Vocal Studio</GradientText>
            </h3>
            <ul className="mt-2 space-y-1.5">
              {VOCAL_TOOLS.map((tool) => (
                <li key={tool.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-softwhite">{tool.name}</span>
                    <StatusPill tone={tool.status === "ready" ? "success" : "warning"}>
                      {tool.status === "ready" ? "Ready" : "Needs config"}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-[9px] leading-relaxed text-muted">{tool.statusNote}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              <GradientText variant="mix">Sam Mix Studio</GradientText>
            </h3>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Import stems or a ZIP, set channels (gain, pan, 3-band EQ, compression, reverb/delay
              sends, width), group them on rhythm/vocal/music buses, and bounce through a per-channel
              chain with a true-peak safety limiter.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {MIX_PRESETS.filter((p) => p.id !== "custom").map((preset) => (
                <span key={preset.id} className="chip py-0.5 text-[9px]">
                  {preset.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Presets are adjustable starting points applied to matching roles — never universal
              rules.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              <GradientText variant="master">Sam Mastering Studio</GradientText>
            </h3>
            <ul className="mt-2 space-y-1">
              {MASTER_PROFILES.filter((p) => p.id !== "custom").map((profile) => (
                <li key={profile.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                  <span className="text-[10px] text-softwhite">{profile.label}</span>
                  <span className="mono text-[9px] text-muted">
                    {profile.controls.targetLufs} / {profile.controls.truePeakCeilingDb}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Audio formats & limits</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            { title: "Accepted uploads", body: "WAV, AIFF, FLAC, MP3, OGG, M4A — decoded in the browser to PCM." },
            { title: "Default limits", body: "80 MB and 12 minutes per file, enforced client- and server-side." },
            { title: "Exports", body: "WAV 16-bit (TPDF dither), WAV 24-bit, WAV 32-bit float, MP3 320 kbps." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-semibold text-softwhite">{item.title}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Working sample rate is 48 kHz inside the browser. WAV metadata (sample rate, bit depth) is
          read from the file header; compressed formats have no bit depth until encoded.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Architecture</h2>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[10px] leading-relaxed text-muted">
{`Browser (Next.js client)                       Studio server (Next.js route handlers)
────────────────────────                       ─────────────────────────────────────
Web Audio decode + OfflineAudioContext  ─────▶ POST /api/projects/:id/assets
Granular pitch shift / ensemble DSP           POST /api/exports (final files)
EBU R128 + true peak analysis                 POST /api/projects/:id/jobs
WAV / MP3 encoding                             PATCH /api/projects/:id (state)
Canvas waveforms                               GET  /api/assets/:id/audio (Range)
Prompt + recommendations  ──────────────────▶ POST /api/prompt/improve
                                               POST /api/mix/recommendations
                                                        │
                                                        ▼
                                              .data/db.json (atomic writes)
                                              .data/audio/*  .data/exports/*
                                              optional GEMINI_API_KEY (server only)`}
        </pre>
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Jobs are rendered on the client (so no audio leaves the server) and their real lifecycle is
          recorded with the project. Swap <span className="mono">lib/server/db.ts</span> for Postgres or
          Supabase to move to a queue-backed multi-user deployment.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Configuration</h2>
        <div className="mt-2 space-y-1.5">
          {ENV_VARS.map((env) => (
            <div key={env.key} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
              <div className="mono text-[10px] text-cyan-200">{env.key}</div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{env.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
          Copy <span className="mono">.env.example</span> to <span className="mono">.env.local</span>.
          Secrets are read only inside route handlers.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Capability matrix</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-2">Capability</th>
                <th className="py-2 pr-2">Area</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((cap) => (
                <tr key={cap.name} className="border-b border-white/[0.05]">
                  <td className="py-1.5 pr-2 text-softwhite/90">{cap.name}</td>
                  <td className="py-1.5 pr-2 text-muted">{cap.area}</td>
                  <td className="py-1.5">
                    <StatusPill
                      tone={
                        cap.status === "ready"
                          ? "success"
                          : cap.status === "needs"
                            ? "warning"
                            : cap.status === "external"
                              ? "info"
                              : "neutral"
                      }
                    >
                      {STATUS_LABEL[cap.status]}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Deployment & testing</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] font-semibold text-softwhite">Run it</div>
            <pre className="mt-1 overflow-x-auto text-[10px] leading-relaxed text-muted">{`npm install
cp .env.example .env.local   # optional Gemini key
npm run dev                  # http://localhost:3000
npm run build && npm start   # production`}</pre>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] font-semibold text-softwhite">Verify it</div>
            <pre className="mt-1 overflow-x-auto text-[10px] leading-relaxed text-muted">{`npm test        # DSP + store unit tests
npm run typecheck
npm run build   # production compile`}</pre>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Tests cover LUFS against a −23 dBFS reference tone, true-peak oversampling, WAV
              round-trip, limiter ceilings, pitch-shift ratio, prompt engine output and project
              persistence.
            </p>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Deploy to Node hosting with a persistent volume mounted at <span className="mono">.data</span>.
          Serverless platforms with ephemeral disks will lose audio — use object storage instead.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Privacy & consent</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Uploads stay in <span className="mono">.data/audio</span> on this server and are streamed only
          through the studio API. They are sent to a third party only when you configure Gemini and
          ask for prompt work (text only — audio is never uploaded to the AI provider).
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Voice transformation requires explicit, recorded consent. No voice model is trained by this
          application, and no unconverted sample is ever displayed as a converted result.
        </p>
      </GlassCard>
    </div>
  );
}
