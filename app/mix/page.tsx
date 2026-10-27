"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  EmptyState,
  GlassCard,
  Modal,
  SectionHeading,
  Segmented,
  Slider,
  StatusPill,
  Tooltip,
  cn,
} from "@/components/ui/primitives";
import { ProjectGate, SessionStrip, StudioHeader } from "@/components/studio/ProjectGate";
import { PromptEditor } from "@/components/studio/PromptEditor";
import { AnalysisPanel } from "@/components/studio/AnalysisPanel";
import { JobStatusCard, useJobRunner } from "@/components/studio/useJobRunner";
import { MixChannelStrip } from "@/components/studio/MixChannelStrip";
import { UploadZone } from "@/components/audio/UploadZone";
import { useStudio } from "@/lib/client/studio";
import { assetChannels, loadAssetBuffer } from "@/lib/client/audio";
import { analyzeBuffer } from "@/lib/audio/analysis";
import { exportChannels } from "@/lib/client/exporting";
import { renderTrackSubset } from "@/lib/client/mixdown";
import { detectUnsupportedPackage, extractZipStems } from "@/lib/client/zip";
import { applyPresetToTracks, groupForRole, guessRoleFromName } from "@/lib/projects";
import {
  MIX_PRESETS,
  PROMPT_SEEDS,
  STEM_ROLE_LABEL,
  type MixRecommendation,
  type MixState,
  type StemRole,
  type Track,
} from "@/lib/types";
import { formatDb } from "@/lib/format";

const ROLE_OPTIONS: StemRole[] = [
  "lead_vocal",
  "double",
  "harmony",
  "chorus",
  "adlib",
  "choir",
  "drums",
  "bass",
  "percussion",
  "keys",
  "instrumental",
  "other",
];

export default function MixPage() {
  return (
    <ProjectGate
      studio="mix"
      title="Sam Mix Studio"
      tagline="AI-assisted song mixing, audio analysis, stem processing, mixing recommendations and compatible audio project workflows."
      icon="sliders"
    >
      <MixStudio />
    </ProjectGate>
  );
}

function MixStudio() {
  const {
    project,
    updateProject,
    upload,
    uploadChannels,
    deleteAsset,
    playAsset,
    player,
    saveVersion,
    notify,
    saveExport,
    settings,
  } = useStudio();
  const { job, run } = useJobRunner("mix");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<"wav24" | "wav16" | "mp3_320">(
    settings?.defaultExportFormat ?? "wav24",
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const [recMeta, setRecMeta] = useState<{ source: string; note: string } | null>(null);
  const [selectedRecs, setSelectedRecs] = useState<Set<string>>(new Set());

  if (!project) return null;
  const mix = project.mix;
  const tracks = [...project.tracks].sort((a, b) => a.order - b.order);
  const selected = tracks.find((t) => t.id === selectedId) ?? tracks[0] ?? null;
  const preset = MIX_PRESETS.find((p) => p.id === mix.presetId) ?? MIX_PRESETS[0];
  const analysis = mix.lastMixAnalysis;
  const audible = tracks.filter((t) => t.assetId);

  const setMix = (patch: Partial<MixState>) =>
    updateProject((p) => ({ ...p, mix: { ...p.mix, ...patch } }));

  const updateTrack = (trackId: string, patch: Partial<Track>) =>
    updateProject((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
    }));

  const handleFiles = async (files: File[]) => {
    const blocked = files
      .map((f) => ({ name: f.name, message: detectUnsupportedPackage(f.name) }))
      .filter((x) => x.message);
    if (blocked.length) throw new Error(blocked[0].message as string);

    let audioFiles: File[] = [];
    for (const file of files) {
      if (/\.zip$/i.test(file.name)) {
        const { files: inner, skipped } = await extractZipStems(file);
        audioFiles.push(...inner);
        if (skipped.length) {
          notify("info", "ZIP expanded", `${inner.length} audio files imported, ${skipped.length} non-audio entries skipped.`);
        }
      } else {
        audioFiles.push(file);
      }
    }
    if (audioFiles.length > 24) {
      throw new Error(`That is ${audioFiles.length} files. Import at most 24 stems at a time.`);
    }

    const importedIds: string[] = [];
    for (const file of audioFiles) {
      const role = guessRoleFromName(file.name);
      const asset = await upload(file, {
        kind: "stem",
        role,
        createTrack: true,
        trackName: file.name.replace(/\.[^.]+$/, ""),
      });
      importedIds.push(asset.id);
    }

    // Apply the selected genre preset only to the freshly imported channels.
    const activePreset = MIX_PRESETS.find((p) => p.id === mix.presetId) ?? MIX_PRESETS[0];
    updateProject(
      (p) => ({
        ...p,
        tracks: p.tracks.map((t) => {
          if (!t.assetId || !importedIds.includes(t.assetId)) return t;
          const rolePreset = activePreset.roles[t.role] ?? activePreset.roles.other;
          return rolePreset ? { ...t, ...rolePreset } : t;
        }),
      }),
      { flush: true },
    );
    notify("success", "Stems imported", `${audioFiles.length} channel${audioFiles.length === 1 ? "" : "s"} ready in the mixer.`);
  };

  const fetchRecommendations = async () => {
    setRecBusy(true);
    try {
      const res = await fetch("/api/mix/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: mix.improvedPrompt ?? mix.prompt,
          presetId: mix.presetId,
          stems: tracks.map((t) => t.role),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The mixing assistant could not respond");
      setMix({ recommendations: data.recommendations as MixRecommendation[] });
      setRecMeta({ source: data.source, note: data.note });
      setSelectedRecs(new Set((data.recommendations as MixRecommendation[]).map((r) => r.id)));
      notify("success", "Mixing stages proposed", `${(data.recommendations as MixRecommendation[]).length} reviewable stages.`);
    } catch (err) {
      notify("error", "Could not build recommendations", (err as Error).message);
    } finally {
      setRecBusy(false);
    }
  };

  const applySelectedRecs = () => {
    const chosen = mix.recommendations.filter((r) => selectedRecs.has(r.id));
    const withSettings = chosen.filter((r) => r.settings && Object.keys(r.settings).length);
    if (!chosen.length) {
      notify("error", "Nothing selected", "Tick at least one mixing stage.");
      return;
    }
    if (!withSettings.length) {
      notify(
        "info",
        "These stages are guidance only",
        "The assistant returned no channel values, so nothing was written to the mixer. Use the details as a manual checklist.",
      );
      return;
    }
    updateProject(
      (p) => ({
        ...p,
        tracks: p.tracks.map((t) => {
          const matches = withSettings.filter(
            (r) => r.targetRole === "all" || r.targetRole === t.role,
          );
          if (!matches.length) return t;
          const merged = matches.reduce<Record<string, number>>(
            (acc, r) => ({ ...acc, ...(r.settings ?? {}) }),
            {},
          );
          return { ...t, ...merged } as Track;
        }),
        mix: {
          ...p.mix,
          recommendations: p.mix.recommendations.map((r) =>
            selectedRecs.has(r.id) && r.settings ? { ...r, applied: true } : r,
          ),
        },
      }),
      { flush: true },
    );
    notify("success", "Mixing stages applied", `${withSettings.length} stage(s) written to the matching channels.`);
  };

  const analyseMix = async () => {
    if (!audible.length) {
      notify("error", "No audio to analyse", "Import stems or generate vocal layers first.");
      return;
    }
    await run("Analyse mix", "mix-analysis", async (report) => {
      const rendered = await renderTrackSubset(project, audible, {
        ceilingDb: 0,
        outputGainDb: mix.outputGainDb,
        onProgress: (pct, message) => report(pct, message),
      });
      report(90, "Measuring loudness, true peak and tone");
      const result = analyzeBuffer(rendered.channels, rendered.sampleRate);
      setMix({ lastMixAnalysis: result, lastMixEngineNotes: rendered.applied });
      report(100, `${result.integratedLufs.toFixed(1)} LUFS · ${result.truePeakDb.toFixed(2)} dBTP measured`);
    });
  };

  const bounceMix = async () => {
    if (!audible.length) {
      notify("error", "No audio to bounce", "Import stems first.");
      return;
    }
    await run("Bounce mix", "mix-bounce", async (report) => {
      const rendered = await renderTrackSubset(project, audible, {
        ceilingDb: mix.limiterCeilingDb,
        outputGainDb: mix.outputGainDb,
        onProgress: (pct, message) => report(pct, message),
      });
      report(80, "Measuring the bounced mix");
      const result = analyzeBuffer(rendered.channels, rendered.sampleRate);
      report(85, "Storing the mix file");
      const asset = await uploadChannels(rendered.channels, rendered.sampleRate, {
        name: `${project.name} — Mix ${project.assets.filter((a) => a.kind === "mix").length + 1}`,
        kind: "mix",
        engine: rendered.applied.join(" · "),
        createTrack: false,
      });
      updateProject(
        (p) => ({
          ...p,
          mix: { ...p.mix, lastMixAssetId: asset.id, lastMixAnalysis: result, lastMixEngineNotes: rendered.applied },
          mastering: { ...p.mastering, sourceAssetId: asset.id },
        }),
        { flush: true },
      );
      notify("success", "Mix bounced", `${result.integratedLufs.toFixed(1)} LUFS · ${result.truePeakDb.toFixed(2)} dBTP · stored privately.`);
      report(100, "Mix stored and ready for mastering");
    });
  };

  const exportMix = async () => {
    if (!mix.lastMixAssetId) {
      notify("error", "Bounce the mix first", "Export writes the bounced mix file, not a live render.");
      return;
    }
    setShowExport(false);
    await run("Export mix", "mix-export", async (report) => {
      report(10, "Loading bounced mix");
      const buffer = await loadAssetBuffer(project.id, mix.lastMixAssetId!);
      report(50, "Encoding");
      const record = await exportChannels({
        channels: assetChannels(buffer),
        sampleRate: buffer.sampleRate,
        format: exportFormat,
        project,
        studio: "mix",
        assetId: mix.lastMixAssetId,
        label: `${project.name}_Mix`,
        analysis: mix.lastMixAnalysis,
        saveExport,
        dither: settings?.dither16Bit,
        onProgress: (pct, stage) => report(50 + pct * 0.45, stage),
      });
      report(100, `${record.fileName} exported`);
    });
  };

  const avgPeak = useMemo(() => {
    const peaks = tracks
      .map((t) => project.assets.find((a) => a.id === t.assetId)?.peaks ?? [])
      .flat();
    return peaks.length ? peaks.reduce((a, b) => a + b, 0) / peaks.length : 0;
  }, [tracks, project.assets]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StudioHeader
          studio="mix"
          title="Sam Mix Studio"
          tagline="Upload stems, balance channels with real EQ/compression, review AI mixing stages and bounce a mix for mastering."
          icon="sliders"
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-xs" onClick={() => setShowGuide(true)}>
            <Icon name="info" size={13} /> FL Studio & Cubase stems
          </button>
          <button className="btn-ghost text-xs" onClick={() => void saveVersion("Mix checkpoint", "mix")}>
            <Icon name="save" size={13} /> Save version
          </button>
          <button className="btn-ghost text-xs" onClick={() => void analyseMix()} disabled={job?.status === "running"}>
            <Icon name="target" size={13} /> Analyse mix
          </button>
          <button className="btn-primary text-xs" onClick={() => void bounceMix()} disabled={job?.status === "running"}>
            <Icon name="waveform" size={13} /> Bounce mix
          </button>
          <button
            className="btn-subtle text-xs"
            onClick={() => setShowExport(true)}
            disabled={!mix.lastMixAssetId || job?.status === "running"}
          >
            <Icon name="download" size={13} /> Export
          </button>
        </div>
      </div>
      <SessionStrip />
      {job ? <JobStatusCard job={job} /> : null}

      {/* Upload + assistant */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <GlassCard accent="mix">
          <SectionHeading
            eyebrow="Stem import"
            title="Drop Your Music Project Here"
            description="Audio tracks, stems or a ZIP of stems. Native FL Studio (.flp) and Cubase (.cpr) projects are explained rather than silently misinterpreted."
            action={
              <StatusPill tone="info" icon="music">
                {tracks.length} channels
              </StatusPill>
            }
          />
          <UploadZone
            onFiles={handleFiles}
            multiple
            busy={job?.status === "running"}
            title="Drop your stems here"
            subtitle="WAV · AIFF · MP3 · FLAC · OGG · M4A · ZIP stem packages"
            hint="Each file becomes its own mixer channel. Files are decoded in your browser, then stored privately on your studio server. Native DAW projects are detected and explained."
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { label: "WAV / AIFF", detail: "24-bit preferred", icon: "file" as const },
              { label: "MP3 / FLAC / M4A", detail: "decoded to PCM", icon: "music" as const },
              { label: "ZIP stem pack", detail: "unpacked in-browser", icon: "folder" as const },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-softwhite">
                  <Icon name={item.icon} size={11} className="text-cyan-300" />
                  {item.label}
                </div>
                <p className="mt-0.5 text-[9px] text-muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeading
            eyebrow="AI mixing assistant"
            title="What should this mix do?"
            action={
              <StatusPill tone="ready" icon="bolt">
                {preset.label}
              </StatusPill>
            }
          />
          <div className="mb-3">
            <div className="label mb-1">Genre starting point</div>
            <select
              className="field text-xs"
              value={mix.presetId}
              onChange={(e) => setMix({ presetId: e.target.value as MixState["presetId"] })}
            >
              {MIX_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#15112B]">
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">{preset.description}</p>
            <div className="mt-2 flex gap-2">
              <button
                className="btn-subtle flex-1 px-2 py-1.5 text-[10px]"
                onClick={() => {
                  updateProject((p) => ({ ...p, tracks: applyPresetToTracks(p.tracks, p.mix.presetId) }), {
                    flush: true,
                  });
                  notify("success", "Preset applied", `${preset.label} values written to every channel.`);
                }}
                disabled={!tracks.length || preset.id === "custom"}
              >
                Apply preset to channels
              </button>
            </div>
          </div>

          <PromptEditor
            studio="mix"
            prompt={mix.prompt}
            onPromptChange={(value) => setMix({ prompt: value })}
            improvedPrompt={mix.improvedPrompt}
            onImproved={(result) =>
              setMix({
                improvedPrompt: result.text,
                improvedBy: result.source === "gemini" ? "gemini" : "local-heuristic",
              })
            }
            seed={PROMPT_SEEDS.mix}
            rows={4}
          />

          <button
            className="btn-primary mt-3 w-full text-xs"
            onClick={() => void fetchRecommendations()}
            disabled={recBusy}
          >
            <Icon name="sparkles" size={14} />
            {recBusy ? "Building stages…" : "Apply Mixing Recommendations"}
          </button>
          {recMeta ? (
            <p className="mt-2 text-[10px] leading-relaxed text-muted">{recMeta.note}</p>
          ) : null}
        </GlassCard>
      </div>

      {/* Recommendations */}
      {mix.recommendations.length ? (
        <GlassCard>
          <SectionHeading
            eyebrow="Review before applying"
            title="Proposed mixing stages"
            description="Nothing is written to the mixer until you apply a stage. Each stage lists the channel values it would set."
            action={
              <div className="flex gap-2">
                <button
                  className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-muted hover:text-white"
                  onClick={() =>
                    setSelectedRecs(
                      selectedRecs.size === mix.recommendations.length
                        ? new Set()
                        : new Set(mix.recommendations.map((r) => r.id)),
                    )
                  }
                >
                  {selectedRecs.size === mix.recommendations.length ? "Clear all" : "Select all"}
                </button>
                <button className="btn-primary px-3 py-1.5 text-[10px]" onClick={applySelectedRecs}>
                  <Icon name="check" size={12} /> Apply {selectedRecs.size} stage{selectedRecs.size === 1 ? "" : "s"}
                </button>
              </div>
            }
          />
          <div className="grid gap-2 md:grid-cols-2">
            {mix.recommendations.map((rec) => {
              const checked = selectedRecs.has(rec.id);
              return (
                <label
                  key={rec.id}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3 transition-colors",
                    checked ? "border-violet/40 bg-violet/[0.06]" : "border-white/10 bg-black/20",
                    rec.applied && "border-emerald-400/30 bg-emerald-400/[0.05]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedRecs((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(rec.id);
                          else next.delete(rec.id);
                          return next;
                        })
                      }
                      className="mt-1 accent-violet"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-softwhite">{rec.stage}</span>
                        <StatusPill tone="neutral">
                          {rec.targetRole === "all" ? "All channels" : STEM_ROLE_LABEL[rec.targetRole]}
                        </StatusPill>
                        {rec.applied ? <StatusPill tone="success" icon="check">Applied</StatusPill> : null}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-softwhite/85">{rec.summary}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted">{rec.detail}</p>
                      {rec.settings ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {Object.entries(rec.settings).map(([key, value]) => (
                            <span
                              key={key}
                              className="mono rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-cyan-100"
                            >
                              {key} {typeof value === "number" ? value.toFixed(1) : value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[9px] italic text-muted/70">Guidance only — no channel values attached.</p>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </GlassCard>
      ) : null}

      {/* Mixer */}
      <GlassCard>
        <SectionHeading
          eyebrow="Console"
          title="Mixer"
          description="All controls write to the project and are re-applied on every bounce. Muted channels and muted groups are excluded."
          action={
            <div className="flex items-center gap-2">
              <Tooltip label="Average stored peak envelope across channels — not a live meter">
                <span className="chip">
                  <Icon name="waveform" size={11} /> level {(avgPeak * 100).toFixed(0)}%
                </span>
              </Tooltip>
              <Segmented
                size="sm"
                value={showAdvanced ? "advanced" : "basic"}
                onChange={(v) => setShowAdvanced(v === "advanced")}
                options={[
                  { value: "basic", label: "Basic" },
                  { value: "advanced", label: "Advanced" },
                ]}
              />
            </div>
          }
        />

        {tracks.length === 0 ? (
          <EmptyState
            icon="sliders"
            title="The console is empty"
            description="Import stems or instruments above. You can also generate vocal layers in Sam Vocal Studio — they appear here as channels automatically."
            action={
              <Link href="/vocal" className="btn-subtle text-xs">
                <Icon name="mic" size={13} /> Open Sam Vocal Studio
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Group buses */}
            <div className="flex flex-wrap gap-2">
              {mix.groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: group.colour }} />
                  <span className="text-[10px] font-semibold text-softwhite">{group.label}</span>
                  <input
                    type="range"
                    min={-24}
                    max={6}
                    step={0.5}
                    value={group.gainDb}
                    aria-label={`${group.label} gain`}
                    onChange={(e) => {
                      const gainDb = Number(e.target.value);
                      updateProject((p) => ({
                        ...p,
                        mix: {
                          ...p.mix,
                          groups: p.mix.groups.map((g) => (g.id === group.id ? { ...g, gainDb } : g)),
                        },
                      }));
                    }}
                    className="w-24"
                  />
                  <span className="mono w-12 text-[9px] text-muted">{formatDb(group.gainDb, 0)}</span>
                  <button
                    onClick={() =>
                      updateProject((p) => ({
                        ...p,
                        mix: {
                          ...p.mix,
                          groups: p.mix.groups.map((g) =>
                            g.id === group.id ? { ...g, muted: !g.muted } : g,
                          ),
                        },
                      }))
                    }
                    aria-pressed={group.muted}
                    aria-label={`Mute ${group.label}`}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-bold",
                      group.muted ? "bg-rose-500/30 text-rose-100" : "bg-white/10 text-muted",
                    )}
                  >
                    M
                  </button>
                </div>
              ))}
            </div>

            <div className="scroll-x -mx-1 flex gap-2 px-1 pb-2">
              {tracks.map((track) => {
                const asset = project.assets.find((a) => a.id === track.assetId) ?? null;
                const group = mix.groups.find((g) => g.id === (track.groupId ?? groupForRole(track.role)));
                return (
                  <MixChannelStrip
                    key={track.id}
                    track={track}
                    asset={asset}
                    selected={selected?.id === track.id}
                    playing={Boolean(asset && player.assetId === asset.id && player.playing)}
                    groupLabel={group?.label.replace(" bus", "") ?? "music"}
                    groupColour={group?.colour ?? "#22D3EE"}
                    onSelect={() => setSelectedId(track.id)}
                    onPlay={() => {
                      if (!asset) {
                        notify("error", "Channel has no audio", "Assign an audio file to this channel.");
                        return;
                      }
                      void playAsset({ id: asset.id, name: asset.name }, project.id);
                    }}
                    onUpdate={(patch) => updateTrack(track.id, patch)}
                  />
                );
              })}
            </div>

            {selected ? (
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: selected.color }} />
                    <input
                      value={selected.name}
                      onChange={(e) => updateTrack(selected.id, { name: e.target.value })}
                      aria-label="Channel name"
                      className="w-full min-w-0 max-w-[10rem] border-none bg-transparent text-sm font-semibold text-softwhite focus:outline-none"
                    />
                    <StatusPill tone="neutral">{STEM_ROLE_LABEL[selected.role]}</StatusPill>
                    {project.assets.find((a) => a.id === selected.assetId) ? (
                      <span className="mono text-[10px] text-muted">
                        {(project.assets.find((a) => a.id === selected.assetId)?.extension ?? "").toUpperCase()}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-softwhite"
                      value={selected.groupId ?? groupForRole(selected.role)}
                      onChange={(e) =>
                        updateTrack(selected.id, { groupId: e.target.value })
                      }
                      aria-label="Channel group"
                    >
                      {mix.groups.map((g) => (
                        <option key={g.id} value={g.id} className="bg-[#15112B]">
                          {g.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-softwhite"
                      value={selected.role}
                      onChange={(e) => updateTrack(selected.id, { role: e.target.value as StemRole })}
                      aria-label="Channel role"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role} className="bg-[#15112B]">
                          {STEM_ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded-lg border border-rose-400/30 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-500/10"
                      onClick={async () => {
                        if (!selected.assetId) return;
                        await deleteAsset(selected.assetId);
                        setSelectedId(null);
                      }}
                      disabled={!selected.assetId}
                    >
                      Remove channel
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <div className="label">Channel</div>
                    <Slider
                      label="Volume"
                      min={-24}
                      max={6}
                      step={0.5}
                      value={selected.volumeDb}
                      onChange={(v) => updateTrack(selected.id, { volumeDb: v })}
                      format={(v) => formatDb(v)}
                    />
                    <Slider
                      label="Pan"
                      min={-1}
                      max={1}
                      step={0.01}
                      tone="cyan"
                      value={selected.pan}
                      onChange={(v) => updateTrack(selected.id, { pan: v })}
                      format={(v) => (Math.abs(v) < 0.02 ? "C" : `${v < 0 ? "L" : "R"}${Math.round(Math.abs(v) * 50)}`)}
                    />
                    <Slider
                      label="Stereo width"
                      min={0}
                      max={2}
                      step={0.01}
                      tone="orange"
                      value={selected.width}
                      onChange={(v) => updateTrack(selected.id, { width: v })}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="label">Equalisation</div>
                    <Slider
                      label="Low shelf (120 Hz)"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={selected.eqLowDb}
                      onChange={(v) => updateTrack(selected.id, { eqLowDb: v })}
                      format={(v) => formatDb(v)}
                    />
                    <Slider
                      label="Mid bell (1 kHz)"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={selected.eqMidDb}
                      onChange={(v) => updateTrack(selected.id, { eqMidDb: v })}
                      format={(v) => formatDb(v)}
                    />
                    <Slider
                      label="High shelf (8 kHz)"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={selected.eqHighDb}
                      onChange={(v) => updateTrack(selected.id, { eqHighDb: v })}
                      format={(v) => formatDb(v)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="label">Dynamics</div>
                    <Slider
                      label="Compressor threshold"
                      min={-40}
                      max={0}
                      step={1}
                      value={selected.compThresholdDb}
                      onChange={(v) => updateTrack(selected.id, { compThresholdDb: v })}
                      format={(v) => `${v.toFixed(0)} dB`}
                    />
                    <Slider
                      label="Ratio"
                      min={1}
                      max={8}
                      step={0.1}
                      value={selected.compRatio}
                      onChange={(v) => updateTrack(selected.id, { compRatio: v })}
                      format={(v) => `${v.toFixed(1)}:1`}
                    />
                    <p className="text-[9px] leading-relaxed text-muted/70">
                      Native Web Audio compressor · 12 ms attack / 160 ms release, soft knee.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="label">Space</div>
                    <Slider
                      label="Reverb send"
                      min={0}
                      max={1}
                      step={0.01}
                      tone="gold"
                      value={selected.reverbSend}
                      onChange={(v) => updateTrack(selected.id, { reverbSend: v })}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />
                    <Slider
                      label="Delay send"
                      min={0}
                      max={1}
                      step={0.01}
                      tone="gold"
                      value={selected.delaySend}
                      onChange={(v) => updateTrack(selected.id, { delaySend: v })}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />
                    {showAdvanced ? (
                      <>
                        <Slider
                          label="Mix bus gain"
                          min={-12}
                          max={6}
                          step={0.5}
                          value={mix.outputGainDb}
                          onChange={(v) => setMix({ outputGainDb: v })}
                          format={(v) => formatDb(v)}
                        />
                        <Slider
                          label="Safety limiter ceiling"
                          min={-6}
                          max={0}
                          step={0.1}
                          tone="cyan"
                          value={mix.limiterCeilingDb}
                          onChange={(v) => setMix({ limiterCeilingDb: v })}
                          format={(v) => `${v.toFixed(1)} dBTP`}
                        />
                      </>
                    ) : (
                      <p className="text-[9px] leading-relaxed text-muted/70">
                        Switch the console to Advanced for mix-bus gain and the true-peak safety
                        limiter.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </GlassCard>

      {/* Analysis & delivery */}
      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard>
          <SectionHeading
            eyebrow="Measurement"
            title="Mix analysis"
            description="Rendered from the current channel settings, then measured. No value here is estimated."
            action={
              <button className="btn-ghost px-2.5 py-1.5 text-[10px]" onClick={() => void analyseMix()}>
                <Icon name="refresh" size={12} /> Re-analyse
              </button>
            }
          />
          <AnalysisPanel
            analysis={analysis}
            title="Measured mix"
            subtitle="Safety limiter bypassed during analysis (ceiling 0 dBTP) so the true mix balance is measured."
          />
          {mix.lastMixEngineNotes.length ? (
            <div className="mt-3">
              <div className="label mb-1">Processing applied in the last render</div>
              <ul className="flex flex-wrap gap-1">
                {mix.lastMixEngineNotes.map((note) => (
                  <li key={note} className="chip py-0.5 text-[9px]">
                    <Icon name="check" size={10} className="text-emerald-300" /> {note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </GlassCard>

        <GlassCard>
          <SectionHeading
            eyebrow="Delivery"
            title="Bounced mixes"
            description="A bounce stores the rendered stereo mix privately; mastering reads it automatically."
          />
          {project.assets.filter((a) => a.kind === "mix").length === 0 ? (
            <EmptyState
              compact
              icon="waveform"
              title="No bounced mix yet"
              description="Press Bounce mix to render the console. The bounce includes EQ, compression, sends, width and the safety limiter."
            />
          ) : (
            <ul className="space-y-1.5">
              {project.assets
                .filter((a) => a.kind === "mix")
                .map((asset) => (
                  <li
                    key={asset.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2",
                      mix.lastMixAssetId === asset.id
                        ? "border-cyan/30 bg-cyan/[0.05]"
                        : "border-white/10 bg-black/20",
                    )}
                  >
                    <button
                      onClick={() => playAsset({ id: asset.id, name: asset.name }, project.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-violet/40"
                      aria-label={`Play ${asset.name}`}
                    >
                      <Icon
                        name={player.assetId === asset.id && player.playing ? "pause" : "play"}
                        size={11}
                        filled
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-softwhite">{asset.name}</div>
                      <div className="text-[9px] text-muted">
                        {asset.durationSec.toFixed(1)}s · {(asset.sizeBytes / 1048576).toFixed(1)} MB
                        {mix.lastMixAssetId === asset.id ? " · current mix" : ""}
                      </div>
                    </div>
                    <Link href="/mastering" className="rounded border border-white/10 px-2 py-1 text-[10px] text-gold hover:text-white">
                      Master →
                    </Link>
                  </li>
                ))}
            </ul>
          )}
          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5 text-[10px] leading-relaxed text-muted">
            <span className="font-semibold text-softwhite">Non-destructive:</span> the console works
            from your original stems. Bounces are new files; originals are never overwritten.
          </div>
        </GlassCard>
      </div>

      {/* Guide modal */}
      <Modal
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="FL Studio & Cubase stem workflow"
        description="Native project files contain plugin state that cannot be reconstructed here. Export audio stems instead — that workflow is fully supported."
        size="lg"
        footer={
          <button className="btn-primary" onClick={() => setShowGuide(false)}>
            Got it
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-softwhite">
              <Icon name="sliders" size={14} className="text-cyan-300" /> FL Studio
            </h4>
            <ol className="space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>1. Set the loop to the full song (Ctrl+A in the playlist).</li>
              <li>2. Choose File → Export → WAV.</li>
              <li>
                3. Enable <span className="text-softwhite">Split mixer tracks</span> so every mixer
                insert is rendered to its own WAV.
              </li>
              <li>4. Use 24-bit, and keep the master fader at 0 dB with no limiter.</li>
              <li>5. Import the resulting WAVs here (individually or as one ZIP).</li>
            </ol>
            <p className="mt-2 text-[10px] text-amber-200/80">
              .flp projects are detected and rejected with this explanation — no session is
              reconstructed.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-softwhite">
              <Icon name="sliders" size={14} className="text-cyan-300" /> Cubase
            </h4>
            <ol className="space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>1. Select the locator range for the whole song.</li>
              <li>2. File → Export → Audio Mixdown.</li>
              <li>
                3. Select the channel batch, tick{" "}
                <span className="text-softwhite">Multiple files</span> and name the tracks.
              </li>
              <li>4. Export 24-bit WAV at the project sample rate, no master plugins.</li>
              <li>5. Upload the WAVs or a ZIP of them here.</li>
            </ol>
            <p className="mt-2 text-[10px] text-amber-200/80">
              .cpr projects are detected and rejected with this explanation.
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3 text-[11px] leading-relaxed text-cyan-100/80">
          <span className="font-semibold">Why:</span> a native project references VST instruments,
          sample libraries, automation and plugin states that only exist on your machine. Rendering
          stems captures the sound you actually hear and can be processed reliably.
        </div>
      </Modal>

      {/* Export modal */}
      <Modal
        open={showExport}
        onClose={() => setShowExport(false)}
        title="Export the bounced mix"
        description="Writes the stored bounce, not a fresh render. Re-bounce after changing channel settings."
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShowExport(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void exportMix()}>
              <Icon name="download" size={14} /> Export
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Segmented
            value={exportFormat}
            onChange={(v) => setExportFormat(v)}
            options={[
              { value: "wav24", label: "WAV 24-bit" },
              { value: "wav16", label: "WAV 16-bit" },
              { value: "mp3_320", label: "MP3 320" },
            ]}
          />
          <p className="text-[11px] leading-relaxed text-muted">
            {mix.lastMixAnalysis
              ? `Last measurement: ${mix.lastMixAnalysis.integratedLufs.toFixed(1)} LUFS, ${mix.lastMixAnalysis.truePeakDb.toFixed(2)} dBTP.`
              : "No measurement recorded for this bounce yet — run Analyse mix."}
          </p>
        </div>
      </Modal>
    </div>
  );
}
