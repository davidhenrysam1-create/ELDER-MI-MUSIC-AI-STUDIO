"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  ConfirmButton,
  GlassCard,
  GradientText,
  SectionHeading,
  StatusPill,
  Toggle,
  cn,
} from "@/components/ui/primitives";
import { useStudio } from "@/lib/client/studio";
import { api } from "@/lib/client/api";
import { formatBytes } from "@/lib/format";
import { CAPABILITIES, STATUS_LABEL, type CapabilityStatus } from "@/lib/capabilities";
import type { StudioSettings } from "@/lib/types";

const STATUS_TONE: Record<CapabilityStatus, "success" | "warning" | "info" | "neutral"> = {
  ready: "success",
  needs: "warning",
  external: "info",
  planned: "neutral",
};

export default function SettingsPage() {
  const { settings, system, updateSettings, refreshSystem, refreshExports, notify } = useStudio();
  const [uploadLimit, setUploadLimit] = useState(settings?.maxUploadMb ?? 80);
  const [busy, setBusy] = useState(false);

  const patch = async (value: Partial<StudioSettings>) => {
    try {
      await updateSettings(value);
    } catch (err) {
      notify("error", "Could not save settings", (err as Error).message);
    }
  };

  const saveLimit = async () => {
    setBusy(true);
    try {
      await updateSettings({ maxUploadMb: Math.round(uploadLimit) });
      await refreshSystem();
    } finally {
      setBusy(false);
    }
  };

  const purge = async () => {
    try {
      await api.purge();
      await Promise.all([refreshSystem(), refreshExports(), api.projects()]);
      notify("success", "Studio data deleted", "All projects, audio, exports and profiles were removed.");
      setTimeout(() => window.location.assign("/"), 600);
    } catch (err) {
      notify("error", "Purge failed", (err as Error).message);
    }
  };

  const storage = system?.storage;
  const used = (storage?.audioBytes ?? 0) + (storage?.exportBytes ?? 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-fluid-title font-display font-bold tracking-tight">
          <GradientText>Settings</GradientText>
        </h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
          Studio configuration, external provider status, storage and data controls. Everything on
          this page affects real behaviour.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard>
          <SectionHeading
            eyebrow="Services"
            title="External providers"
            description="The studio works without any provider. AI features that would require one are labelled instead of simulated."
          />
          <ul className="space-y-2">
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-softwhite">
                  <Icon name="sparkles" size={13} className="text-violet-300" />
                  Gemini prompt engine
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                  Improves prompts and proposes mixing stages. Key stays server-side in{" "}
                  <span className="mono">GEMINI_API_KEY</span>.
                </p>
              </div>
              <div className="text-right">
                <StatusPill tone={system?.providers.gemini.configured ? "success" : "warning"}>
                  {system?.providers.gemini.configured ? "Configured" : "Not configured"}
                </StatusPill>
                <div className="mt-1 text-[9px] text-muted">{system?.providers.gemini.model}</div>
              </div>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-softwhite">
                  <Icon name="voice" size={13} className="text-amber-300" />
                  Neural voice conversion
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {system?.providers.voiceConversion.note ??
                    "Requires a licensed external provider."}
                </p>
              </div>
              <StatusPill tone={system?.providers.voiceConversion.configured ? "success" : "warning"}>
                {system?.providers.voiceConversion.configured ? "Configured" : "Not configured"}
              </StatusPill>
            </li>
          </ul>
          {!system?.providers.gemini.configured ? (
            <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3 text-[10px] leading-relaxed text-cyan-100/80">
              Without a key, <span className="font-semibold">Improve My Prompt</span> uses a
              deterministic music-production rule engine and reports{" "}
              <span className="mono">local-heuristic</span> in the result. It never pretends a model
              was called.
            </div>
          ) : null}
        </GlassCard>

        <GlassCard>
          <SectionHeading
            eyebrow="Delivery"
            title="Export defaults"
            description="Defaults are applied when a studio page loads. Exports always re-encode from the stored render."
          />
          <div className="space-y-3">
            <div>
              <div className="label mb-1">Default export format</div>
              <select
                className="field text-xs"
                value={settings?.defaultExportFormat ?? "wav24"}
                onChange={(e) =>
                  void patch({ defaultExportFormat: e.target.value as StudioSettings["defaultExportFormat"] })
                }
              >
                <option value="wav24" className="bg-[#15112B]">WAV 24-bit</option>
                <option value="wav16" className="bg-[#15112B]">WAV 16-bit</option>
                <option value="mp3_320" className="bg-[#15112B]">MP3 320 kbps</option>
              </select>
            </div>
            <Toggle
              checked={settings?.dither16Bit ?? true}
              onChange={(v) => void patch({ dither16Bit: v })}
              label="TPDF dither on 16-bit WAV"
              description="Applies triangular dither when encoding 16-bit files. 24-bit and float exports are never dithered."
            />
            <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-[10px] leading-relaxed text-muted">
              <span className="font-semibold text-softwhite">Autosave is always on.</span> Project
              changes are debounced (≈650 ms), written atomically to disk, and flushed when you leave
              the page. There is no risk-free reason to disable it, so it is not offered as a toggle.
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeading eyebrow="Limits" title="Uploads & duration" description="Enforced in the browser and again by the API." />
          <div className="space-y-3">
            <div>
              <label className="label mb-1 block" htmlFor="upload-limit">
                Max file size (MB)
              </label>
              <div className="flex gap-2">
                <input
                  id="upload-limit"
                  type="number"
                  min={5}
                  max={500}
                  className="field text-xs"
                  value={uploadLimit}
                  onChange={(e) => setUploadLimit(Number(e.target.value))}
                />
                <button className="btn-primary whitespace-nowrap text-[11px]" onClick={() => void saveLimit()} disabled={busy}>
                  Save limit
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-[10px] leading-relaxed text-muted">
              Maximum duration: <span className="text-softwhite">{((settings?.maxDurationSec ?? 720) / 60).toFixed(0)} minutes</span> per
              file (configurable with <span className="mono">MAX_DURATION_SEC</span>). Accepted: WAV, AIFF, FLAC, MP3, OGG, M4A.
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-[10px] leading-relaxed text-muted">
              Rendering uses your browser's CPU. Long files on low-power devices may need the render
              section trimmed in Sam Vocal Studio.
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeading eyebrow="Storage" title="Data on this studio" />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Audio objects</span>
              <span className="mono text-softwhite">{formatBytes(storage?.audioBytes ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Exports</span>
              <span className="mono text-softwhite">{formatBytes(storage?.exportBytes ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs text-muted">
              <span>Total</span>
              <span className="mono text-softwhite">{formatBytes(used)}</span>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-[10px] leading-relaxed text-muted">
            Audio is stored in <span className="mono">.data/audio</span> on the server and streamed
            through authenticated studio endpoints with Range support. Files are never served from a
            public folder. Delete a project to remove its audio, bounces and versions.
          </div>
          <div className="mt-3">
            <ConfirmButton
              label="Delete all studio data"
              title="Delete every project and file?"
              description="This removes all projects, private audio, exports, jobs and voice profiles from this server. It cannot be undone."
              confirmLabel="Delete everything"
              icon="trash"
              onConfirm={purge}
            />
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionHeading
          eyebrow="Transparency"
          title="Capability matrix"
          description="A beautiful interface is not evidence that audio processing works. This table states exactly what is implemented."
          action={
            <Link href="/docs" className="btn-ghost px-2.5 py-1.5 text-[10px]">
              <Icon name="file" size={12} /> Full documentation
            </Link>
          }
        />
        <div className="grid gap-2 md:grid-cols-2">
          {CAPABILITIES.map((cap) => (
            <div key={cap.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-[11px] font-semibold text-softwhite">{cap.name}</span>
                <StatusPill tone={STATUS_TONE[cap.status]}>{STATUS_LABEL[cap.status]}</StatusPill>
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted/70">{cap.area}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{cap.detail}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeading eyebrow="About" title="Engine details" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(system?.engines ?? {}).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-muted/70">{key}</div>
              <div className={cn("mt-0.5 text-[10px] leading-relaxed text-softwhite/90")}>{value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Elder Mi Music AI Studio v{system?.version ?? "1.0.0"} · Afrobeats-first production tooling ·
          “Your Sound. Your Culture. Your Studio.”
        </p>
      </GlassCard>
    </div>
  );
}
