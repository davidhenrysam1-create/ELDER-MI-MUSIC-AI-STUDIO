"use client";

import { useCallback, useEffect, useState } from "react";
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
import { api, type ProviderCatalogue } from "@/lib/client/api";
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
  // Generation providers come from the server so the list can never drift from
  // what the API actually supports.
  const [catalogue, setCatalogue] = useState<ProviderCatalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [capInput, setCapInput] = useState<string>(String(settings?.spendCapUsd ?? 5));

  const loadProviders = useCallback(async () => {
    try {
      setCatalogue(await api.providers());
      setCatalogueError(null);
    } catch (err) {
      setCatalogueError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  /** Persist the spend cap, clamped to the same 0–500 range as the API. */
  const saveCap = async () => {
    const value = Math.max(0, Math.min(500, Number(capInput) || 0));
    setCapInput(String(value));
    await patch({ spendCapUsd: value });
    await loadProviders();
  };

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


        {/* -------------------------------------------------------------- *
         * AI music generation providers                                    *
         * -------------------------------------------------------------- */}
        <GlassCard>
          <SectionHeading
            eyebrow="AI music generation"
            title="Music providers"
            description="These hosted models generate new beats, instrumentals, songs and vocal hooks. Each one is billed by its own vendor, to your own account — the studio only sends the request."
            action={
              <StatusPill tone={catalogue?.summary.configured ? "success" : "warning"}>
                {catalogue
                  ? `${catalogue.summary.configured}/${catalogue.summary.total} configured`
                  : "Loading…"}
              </StatusPill>
            }
          />

          <ul className="space-y-2">
            {(catalogue?.providers ?? []).map((provider) => (
              <li
                key={provider.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-softwhite">
                    {provider.name}{" "}
                    <span className="text-[9px] font-normal text-muted">{provider.vendor}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{provider.note}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-muted/80">
                    <span className="mono">{provider.model}</span>
                    <span>
                      {provider.kinds.join(" · ")} · max {provider.maxDurationSec}s
                    </span>
                    <span className="mono">~${provider.estimateUsdPerSecond.toFixed(3)}/s</span>
                  </div>
                  <div className="mt-1 text-[9px] text-muted/70">
                    Key: <span className="mono">{provider.keyEnv.join(" + ")}</span>
                  </div>
                </div>
                <StatusPill tone={provider.configured ? "success" : "warning"}>
                  {provider.configured ? "Real" : "Awaiting configuration"}
                </StatusPill>
              </li>
            ))}
            {catalogueError ? (
              <li className="text-[10px] text-rose-200">{catalogueError}</li>
            ) : null}
          </ul>

          {catalogue && catalogue.summary.configured === 0 ? (
            <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-[10px] leading-relaxed text-amber-100/85">
              No generation key is set, so the Generate panel shows setup instructions instead of a
              button. Add any one of the variables above to{" "}
              <span className="mono">.env.local</span> and restart the studio — see{" "}
              <Link href="/docs" className="underline">
                Docs → Music generation
              </Link>
              .
            </div>
          ) : null}

          {/* Spend guard: off by default, and a hard cap on top. */}
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-softwhite">Allow paid generation</div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                  Off by default. While off, the generate endpoints refuse every request with{" "}
                  <span className="mono">403</span> and nothing is billed.
                </p>
              </div>
              <Toggle
                checked={settings?.allowPaidGeneration ?? false}
                onChange={(value) => void patch({ allowPaidGeneration: value }).then(loadProviders)}
                label="Allow paid generation"
              />
            </div>

            <div>
              <label className="label mb-1 block" htmlFor="spend-cap">
                Spend cap (USD)
              </label>
              <div className="flex gap-2">
                <input
                  id="spend-cap"
                  type="number"
                  min={0}
                  max={500}
                  step={1}
                  className="field w-28 text-xs"
                  value={capInput}
                  onChange={(event) => setCapInput(event.target.value)}
                />
                <button className="btn-subtle text-xs" onClick={() => void saveCap()} disabled={busy}>
                  Save cap
                </button>
              </div>
              <p className="mt-1 text-[9px] leading-relaxed text-muted/70">
                A request whose estimate would push tracked spend past this cap is refused with{" "}
                <span className="mono">402</span>. Tracked spend is the studio&apos;s own estimate from
                published per-second prices — your provider invoice is authoritative.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px]">
              <span className="text-muted">
                Tracked spend{" "}
                <span className="mono text-softwhite">
                  ${(catalogue?.spend.lifetimeUsd ?? 0).toFixed(2)}
                </span>
              </span>
              <span className="text-muted">
                Cap <span className="mono text-softwhite">${(catalogue?.spend.capUsd ?? 0).toFixed(2)}</span>
              </span>
              <span className="text-muted">
                Left{" "}
                <span className="mono text-softwhite">
                  ${(catalogue?.spend.remainingUsd ?? 0).toFixed(2)}
                </span>
              </span>
            </div>
          </div>
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
          <div className="mt-3 space-y-2">
            {system?.storageDrivers?.warning ? (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-[10px] leading-relaxed text-rose-100">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Icon name="alert" size={12} /> Supabase was requested but did not start
                </div>
                <p className="mt-1">{system.storageDrivers.warning}</p>
                <p className="mt-1 text-rose-100/80">
                  Nothing is lost — the studio is working normally on this machine. Paste the missing
                  value in <span className="mono">.env.local</span> and restart.
                </p>
              </div>
            ) : null}
            {[
              { title: "Audio and exports", status: system?.storageDrivers?.blobs },
              { title: "Database (projects, accounts)", status: system?.storageDrivers?.database },
            ].map((row) => (
              <div
                key={row.title}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-[10px] leading-relaxed text-muted"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-semibold text-softwhite">{row.title}</span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide",
                      row.status?.durable
                        ? "border-emerald-400/30 text-emerald-200"
                        : "border-amber-400/30 text-amber-200",
                    )}
                  >
                    {row.status?.durable ? "off this machine" : "on this machine"}
                  </span>
                </div>
                <div className="mt-1 mono text-[10px] text-softwhite/80">
                  {row.status?.label ?? "This machine's disk (.data)"}
                </div>
                <p className="mt-1">{row.status?.reason}</p>
              </div>
            ))}
            <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-[10px] leading-relaxed text-muted">
              Audio is streamed through authenticated studio endpoints with Range support — never from a
              public folder, whichever driver is in use. Deleting a project removes its audio, bounces
              and versions.
            </p>
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
