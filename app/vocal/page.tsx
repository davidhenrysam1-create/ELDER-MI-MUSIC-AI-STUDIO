"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  EmptyState,
  GlassCard,
  IconButton,
  Modal,
  ProgressBar,
  SectionHeading,
  Segmented,
  Slider,
  StatusPill,
  Tooltip,
  cn,
} from "@/components/ui/primitives";
import { ProjectGate, SessionStrip, StudioHeader } from "@/components/studio/ProjectGate";
import { PromptEditor } from "@/components/studio/PromptEditor";
import { AudioAssetSelect } from "@/components/studio/AudioAssetSelect";
import { AnalysisPanel } from "@/components/studio/AnalysisPanel";
import { JobStatusCard, useJobRunner } from "@/components/studio/useJobRunner";
import { UploadZone } from "@/components/audio/UploadZone";
import { Waveform } from "@/components/audio/Waveform";
import { SectionWaveform } from "@/components/audio/SectionWaveform";
import { useStudio } from "@/lib/client/studio";
import { assetChannels, loadAssetBuffer } from "@/lib/client/audio";
import { renderVocalLayer } from "@/lib/audio/vocal";
import { analyzeBuffer } from "@/lib/audio/analysis";
import { buildArrangementPlan } from "@/lib/audio/arrangement";
import { exportChannels } from "@/lib/client/exporting";
import { renderTrackSubset } from "@/lib/client/mixdown";
import { CHOIR_STYLES, PROMPT_SEEDS, STEM_ROLE_LABEL, VOCAL_TOOLS } from "@/lib/types";
import type { Analysis, StemRole, Track, VocalToolId } from "@/lib/types";
import { formatDb, formatTime } from "@/lib/format";
import { guessRoleFromName } from "@/lib/projects";

const VOCAL_ROLES: StemRole[] = ["lead_vocal", "double", "harmony", "chorus", "adlib", "choir"];

const ROLE_TO_TOOL: Partial<Record<StemRole, VocalToolId>> = {
  chorus: "chorus",
  harmony: "harmony",
  adlib: "adlib",
  choir: "choir",
  double: "doubling",
};

export default function VocalPage() {
  return (
    <ProjectGate
      studio="vocal"
      title="Sam Vocal Studio"
      tagline="AI vocal generation, chorus creation, vocal harmonies, ad-libs, backing vocals, choir arrangements and vocal production."
      icon="mic"
    >
      <VocalStudio />
    </ProjectGate>
  );
}

function VocalStudio() {
  const {
    project,
    updateProject,
    upload,
    uploadChannels,
    deleteAsset,
    playAsset,
    player,
    seek,
    saveVersion,
    notify,
    saveExport,
    settings,
  } = useStudio();
  const { job, run } = useJobRunner("vocal");
  const [showTools, setShowTools] = useState(false);
  const [lastRender, setLastRender] = useState<{ analysis: Analysis; name: string } | null>(null);
  const [exportingTrack, setExportingTrack] = useState<Track | null>(null);
  const [exportFormat, setExportFormat] = useState<"wav24" | "wav32" | "mp3_320">(
    settings?.defaultExportFormat === "mp3_320" ? "mp3_320" : "wav24",
  );
  const [showPlan, setShowPlan] = useState(false);
  const [deletingTrack, setDeletingTrack] = useState<Track | null>(null);

  if (!project) return null;
  const vocal = project.vocal;
  const assets = project.assets;
  const sourceAsset =
    assets.find((a) => a.id === vocal.sourceAssetId) ??
    assets.find((a) => a.kind === "source" || a.kind === "stem") ??
    null;
  const duration = sourceAsset?.durationSec ?? 0;
  const sectionStart = Math.min(vocal.sectionStartSec, Math.max(0, duration - 0.5));
  const sectionEnd = Math.min(Math.max(sectionStart + 0.5, vocal.sectionEndSec), duration || 0);

  const vocalTracks = project.tracks.filter(
    (t) => VOCAL_ROLES.includes(t.role) && t.assetId && assets.some((a) => a.id === t.assetId),
  );

  const tool = VOCAL_TOOLS.find((t) => t.id === vocal.tool) ?? VOCAL_TOOLS[0];
  const toolReady = tool.status === "ready";
  const activeTool = tool;

  const setVocal = (patch: Partial<typeof vocal>) =>
    updateProject((p) => ({ ...p, vocal: { ...p.vocal, ...patch } }));

  const plan = useMemo(
    () =>
      showPlan
        ? buildArrangementPlan(vocal.prompt, project.bpm, Math.max(4, sectionEnd - sectionStart), {
            layerCount: vocal.layerCount,
            intensity: vocal.intensity,
            density: vocal.density,
            choirSize: vocal.choirSize,
            choirStyle: vocal.choirStyle,
          })
        : null,
    [showPlan, vocal, project.bpm, sectionEnd, sectionStart],
  );

  const handleUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const role = guessRoleFromName(file.name);
    const asset = await upload(file, {
      kind: role === "lead_vocal" ? "source" : "stem",
      role,
      createTrack: true,
      trackName: file.name.replace(/\.[^.]+$/, ""),
    });
    const buffer = await loadAssetBuffer(project.id, asset.id);
    updateProject(
      (p) => ({
        ...p,
        vocal: {
          ...p.vocal,
          sourceAssetId: asset.id,
          sectionStartSec: 0,
          sectionEndSec: Math.min(buffer.duration, 30),
        },
      }),
      { flush: true },
    );
  };

  const generate = async (override?: { tool: VocalToolId; role?: StemRole; name?: string }) => {
    if (!sourceAsset) {
      notify("error", "Add source audio first", "Upload the instrumental or lead vocal you want to build from.");
      return;
    }
    const targetTool = VOCAL_TOOLS.find((t) => t.id === (override?.tool ?? vocal.tool)) ?? activeTool;
    if (targetTool.status !== "ready") {
      notify("error", `${targetTool.name} is not available`, targetTool.statusNote);
      return;
    }
    const start = sectionStart;
    const end = sectionEnd;
    if (end - start < 0.3) {
      notify("error", "Select a longer section", "Choose at least 0.3 seconds of audio.");
      return;
    }

    await run(`${targetTool.name}`, "vocal-layer", async (report) => {
      report(5, `Loading ${sourceAsset.name}`);
      const buffer = await loadAssetBuffer(project.id, sourceAsset.id);
      report(12, `Preparing ${Math.round(end - start)}s section`);
      const result = await renderVocalLayer(
        assetChannels(buffer),
        buffer.sampleRate,
        {
          tool: targetTool.id,
          intensity: vocal.intensity,
          density: vocal.density,
          layerCount: vocal.layerCount,
          choirSize: vocal.choirSize,
          choirStyle: vocal.choirStyle,
          sectionStartSec: start,
          sectionEndSec: end,
          bpm: project.bpm,
        },
        (pct, message) => report(12 + pct * 0.62, message),
      );

      report(76, "Measuring the rendered layer");
      const analysis = analyzeBuffer(result.channels, buffer.sampleRate);

      const index = project.assets.filter((a) => a.kind === "vocal").length + 1;
      const name = override?.name ?? `${targetTool.name.replace("AI ", "").replace(" Generator", "")} ${index}`;
      report(82, "Encoding 24-bit WAV layer");
      const asset = await uploadChannels(result.channels, buffer.sampleRate, {
        name,
        kind: "vocal",
        role: override?.role ?? targetTool.role,
        engine: result.engineNote,
        derivedFromId: sourceAsset.id,
        createTrack: true,
        trackName: name,
      });
      setLastRender({ analysis, name });
      updateProject(
        (p) => ({
          ...p,
          vocal: {
            ...p.vocal,
            sourceAssetId: sourceAsset.id,
            generatedAssetIds: [asset.id, ...p.vocal.generatedAssetIds],
          },
        }),
        { flush: true },
      );
      report(100, `${name} added to the timeline`);
    });
  };

  const regenerate = async (track: Track) => {
    const toolId = ROLE_TO_TOOL[track.role];
    if (!toolId) {
      notify("error", "Cannot re-render this lane", "This lane's tool is not available for re-rendering.");
      return;
    }
    const source = assets.find((a) => a.id === (vocal.sourceAssetId ?? sourceAsset?.id)) ?? sourceAsset;
    if (!source) return;

    await run(`Re-render ${track.name}`, "vocal-layer", async (report) => {
      report(6, "Loading source audio");
      const buffer = await loadAssetBuffer(project.id, source.id);
      const result = await renderVocalLayer(
        assetChannels(buffer),
        buffer.sampleRate,
        {
          tool: toolId,
          intensity: vocal.intensity,
          density: vocal.density,
          layerCount: vocal.layerCount,
          choirSize: vocal.choirSize,
          choirStyle: vocal.choirStyle,
          sectionStartSec: sectionStart,
          sectionEndSec: sectionEnd,
          bpm: project.bpm,
        },
        (pct, message) => report(8 + pct * 0.6, message),
      );
      report(74, "Measuring the new render");
      const analysis = analyzeBuffer(result.channels, buffer.sampleRate);
      report(80, "Replacing the lane audio");
      const asset = await uploadChannels(result.channels, buffer.sampleRate, {
        name: `${track.name} (re-render)`,
        kind: "vocal",
        role: track.role,
        engine: result.engineNote,
        derivedFromId: source.id,
        createTrack: false,
      });
      const oldAssetId = track.assetId;
      updateProject(
        (p) => ({
          ...p,
          tracks: p.tracks.map((t) => (t.id === track.id ? { ...t, assetId: asset.id } : t)),
          vocal: {
            ...p.vocal,
            generatedAssetIds: [
              asset.id,
              ...p.vocal.generatedAssetIds.filter((id) => id !== oldAssetId),
            ],
          },
        }),
        { flush: true },
      );
      if (oldAssetId) {
        try {
          await deleteAsset(oldAssetId);
        } catch {
          /* keep the old file if deletion fails */
        }
      }
      setLastRender({ analysis, name: track.name });
      report(100, "Lane updated in place");
    });
  };

  const moveTrack = (trackId: string, direction: -1 | 1) => {
    updateProject((p) => {
      const sorted = [...p.tracks].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((t) => t.id === trackId);
      const swapWith = index + direction;
      if (index < 0 || swapWith < 0 || swapWith >= sorted.length) return p;
      const a = sorted[index];
      const b = sorted[swapWith];
      return {
        ...p,
        tracks: p.tracks.map((t) =>
          t.id === a.id ? { ...t, order: b.order } : t.id === b.id ? { ...t, order: a.order } : t,
        ),
      };
    });
  };

  const exportVocalMix = async () => {
    if (!vocalTracks.length) {
      notify("error", "Nothing to bounce", "Generate at least one vocal layer first.");
      return;
    }
    await run("Bounce vocal layers", "vocal-export", async (report) => {
      report(5, "Loading vocal lanes");
      const rendered = await renderTrackSubset(project, vocalTracks, {
        onProgress: (pct, message) => report(pct, message),
        ceilingDb: -1,
      });
      report(82, "Measuring and encoding the bounce");
      const mixAnalysis = analyzeBuffer(rendered.channels, rendered.sampleRate);
      const record = await exportChannels({
        channels: rendered.channels,
        sampleRate: rendered.sampleRate,
        format: exportFormat,
        project,
        studio: "vocal",
        assetId: null,
        label: `${project.name}_Vocals`,
        analysis: mixAnalysis,
        saveExport,
        dither: settings?.dither16Bit,
        onProgress: (pct, stage) => report(82 + pct * 0.15, stage),
      });
      notify(
        "success",
        "Vocal bounce exported",
        `${record.fileName} · ${record.format} · ${(record.sizeBytes / 1048576).toFixed(1)} MB`,
      );
      report(100, "Vocal bounce exported");
    });
  };

  const exportLayer = async (track: Track) => {
    if (!track.assetId) return;
    setExportingTrack(null);
    await run(`Export ${track.name}`, "vocal-export", async (report) => {
      report(10, "Loading lane audio");
      const buffer = await loadAssetBuffer(project.id, track.assetId!);
      const analysis = analyzeBuffer(assetChannels(buffer), buffer.sampleRate);
      report(55, "Encoding");
      const record = await exportChannels({
        channels: assetChannels(buffer),
        sampleRate: buffer.sampleRate,
        format: exportFormat,
        project,
        studio: "vocal",
        assetId: track.assetId,
        label: `${project.name}_${track.name}`,
        analysis,
        saveExport,
        dither: settings?.dither16Bit,
        onProgress: (pct, stage) => report(55 + pct * 0.4, stage),
      });
      report(100, `${record.fileName} exported`);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StudioHeader
          studio="vocal"
          title="Sam Vocal Studio"
          tagline="Build choruses, harmonies, ad-libs, doubles and choir stacks from your own recording — every layer stays separate and editable."
          icon="mic"
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-xs" onClick={() => void saveVersion("Vocal session saved", "vocal")}>
            <Icon name="save" size={13} /> Save version
          </button>
          <button className="btn-subtle text-xs" onClick={() => setShowPlan(true)}>
            <Icon name="layers" size={13} /> Arrangement assistant
          </button>
        </div>
      </div>
      <SessionStrip />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Generator column */}
        <div className="space-y-4">
          <GlassCard accent="vocal">
            <SectionHeading
              eyebrow="Source"
              title="What are we building from?"
              description="Upload an instrumental or a lead vocal. Layers are derived from this file — it is never modified."
            />
            <AudioAssetSelect
              label="Source audio"
              assets={assets}
              value={sourceAsset?.id ?? null}
              onChange={(id) =>
                updateProject((p) => ({ ...p, vocal: { ...p.vocal, sourceAssetId: id } }))
              }
              hint="Tip: a dry lead vocal gives the cleanest harmony and choir extraction."
              emptyHint="No audio in this project yet — upload an instrumental or lead vocal below."
            />
            <div className="mt-3">
              <UploadZone
                compact
                title="Add a source track"
                subtitle="WAV, AIFF, FLAC, MP3, OGG or M4A · max 80 MB"
                onFiles={handleUpload}
                busy={job?.status === "running"}
              />
            </div>
            {sourceAsset && duration > 0 ? (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="label">Render section</span>
                  <span className="mono text-[10px] text-cyan-200">
                    {formatTime(sectionStart, true)} → {formatTime(sectionEnd, true)}
                  </span>
                </div>
                <SectionWaveform
                  peaks={sourceAsset.peaks}
                  durationSec={duration}
                  startSec={sectionStart}
                  endSec={sectionEnd}
                />
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Slider
                    label="Section start"
                    min={0}
                    max={Math.max(0, duration - 0.5)}
                    step={0.1}
                    value={sectionStart}
                    tone="cyan"
                    onChange={(v) =>
                      setVocal({ sectionStartSec: v, sectionEndSec: Math.max(v + 0.5, sectionEnd) })
                    }
                    format={(v) => formatTime(v, true)}
                  />
                  <Slider
                    label="Section end"
                    min={0.5}
                    max={duration}
                    step={0.1}
                    value={sectionEnd}
                    tone="cyan"
                    onChange={(v) => setVocal({ sectionEndSec: Math.max(sectionStart + 0.5, v) })}
                    format={(v) => formatTime(v, true)}
                  />
                </div>
              </div>
            ) : null}
          </GlassCard>

          <GlassCard>
            <SectionHeading
              eyebrow="Vocal tools"
              title="Generation engine"
              action={
                <StatusPill tone="ready" icon="bolt">
                  Local DSP
                </StatusPill>
              }
            />
            <div className="grid grid-cols-2 gap-2">
              {VOCAL_TOOLS.map((item) => {
                const selected = item.id === vocal.tool;
                const unavailable = item.status !== "ready";
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setVocal({ tool: item.id });
                      if (unavailable) notify("info", `${item.name} needs configuration`, item.statusNote);
                    }}
                    aria-pressed={selected}
                    className={cn(
                      "group relative rounded-xl border p-2.5 text-left transition-all",
                      selected
                        ? "border-violet/60 bg-violet/15 shadow-glow"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]",
                      unavailable && "opacity-70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className={cn("text-[11px] font-semibold leading-tight", selected ? "text-white" : "text-softwhite/90")}>
                        {item.name.replace(" Generator", "").replace("AI ", "")}
                      </span>
                      {item.status === "ready" ? (
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      ) : (
                        <Icon name="lock" size={10} className="mt-0.5 shrink-0 text-amber-300" />
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-muted">{item.description}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-softwhite">
                <Icon name={toolReady ? "check" : "alert"} size={12} className={toolReady ? "text-emerald-300" : "text-amber-300"} />
                {activeTool.name}
                <StatusPill tone={toolReady ? "success" : "warning"}>
                  {toolReady ? "Ready" : "Needs configuration"}
                </StatusPill>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{activeTool.statusNote}</p>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeading eyebrow="Arrangement" title="Layer controls" />
            <div className="space-y-3">
              <Slider
                label="Vocal intensity"
                min={0}
                max={1}
                step={0.01}
                value={vocal.intensity}
                onChange={(v) => setVocal({ intensity: v })}
                format={(v) => `${Math.round(v * 100)}%`}
                hint="Drives level, detune spread and upper-harmony presence."
              />
              <Slider
                label="Arrangement density"
                min={0}
                max={1}
                step={0.01}
                value={vocal.density}
                onChange={(v) => setVocal({ density: v })}
                format={(v) => `${Math.round(v * 100)}%`}
                hint="Higher density adds more voice copies and rhythmic answers."
              />
              <Slider
                label="Layers"
                min={1}
                max={8}
                step={1}
                value={vocal.layerCount}
                onChange={(v) => setVocal({ layerCount: v })}
                format={(v) => `${v} layer${v === 1 ? "" : "s"}`}
              />
              {vocal.tool === "choir" ? (
                <>
                  <Slider
                    label="Choir size"
                    min={4}
                    max={24}
                    step={1}
                    value={vocal.choirSize}
                    onChange={(v) => setVocal({ choirSize: v })}
                    format={(v) => `${v} voices`}
                    tone="gold"
                  />
                  <div>
                    <div className="label mb-1">Choir character</div>
                    <select
                      className="field text-xs"
                      value={vocal.choirStyle}
                      onChange={(e) => setVocal({ choirStyle: e.target.value as typeof vocal.choirStyle })}
                    >
                      {CHOIR_STYLES.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#15112B]">
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted/70">
                      {CHOIR_STYLES.find((s) => s.id === vocal.choirStyle)?.description} Broad musical
                      characteristics only — no real choir or artist is imitated.
                    </p>
                  </div>
                </>
              ) : null}
              <div>
                <div className="label mb-1">Performance style</div>
                <input
                  className="field text-xs"
                  value={vocal.performanceStyle}
                  onChange={(e) => setVocal({ performanceStyle: e.target.value })}
                  placeholder="Lively · Syncopated · Warm"
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <PromptEditor
              studio="vocal"
              prompt={vocal.prompt}
              onPromptChange={(value) => setVocal({ prompt: value })}
              improvedPrompt={vocal.improvedPrompt}
              onImproved={(result) =>
                setVocal({
                  improvedPrompt: result.text,
                  improvedBy: result.source === "gemini" ? "gemini" : "local-heuristic",
                })
              }
              seed={PROMPT_SEEDS.vocal}
              tool={activeTool.name}
            />
            {vocal.tool === "transform" ? (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3 text-[11px] leading-relaxed text-amber-100">
                <div className="mb-1 flex items-center gap-1.5 font-semibold">
                  <Icon name="lock" size={12} /> Voice transformation is not connected
                </div>
                This workspace will not fake a converted voice. Register consent-gated profiles now, and
                connect a licensed neural provider in Settings when available.
                <Link href="/voice-profiles" className="mt-2 inline-flex items-center gap-1 font-semibold text-amber-200 underline underline-offset-2">
                  Manage voice profiles <Icon name="arrowRight" size={11} />
                </Link>
              </div>
            ) : null}
            <button
              className="btn-primary mt-3 w-full"
              disabled={job?.status === "running" || !sourceAsset || !toolReady}
              onClick={() => void generate()}
            >
              <Icon name="sparkles" size={15} />
              {job?.status === "running" ? "Rendering…" : `Generate ${activeTool.name.replace("AI ", "")}`}
            </button>
            {job ? (
              <div className="mt-3">
                <JobStatusCard job={job} />
                {job.status === "running" ? (
                  <div className="mt-2">
                    <ProgressBar value={job.progress} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </GlassCard>
        </div>

        {/* Timeline column */}
        <div className="space-y-4">
          <GlassCard>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="label">Vocal timeline</div>
                <h2 className="text-base font-semibold text-softwhite">
                  {vocalTracks.length} editable lane{vocalTracks.length === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="sm"
                  value={exportFormat}
                  onChange={(v) => setExportFormat(v)}
                  options={[
                    { value: "wav24", label: "WAV 24" },
                    { value: "mp3_320", label: "MP3 320" },
                  ]}
                />
                <button className="btn-ghost text-[11px]" onClick={() => void exportVocalMix()} disabled={!vocalTracks.length}>
                  <Icon name="download" size={13} /> Bounce vocals
                </button>
              </div>
            </div>

            {vocalTracks.length === 0 ? (
              <EmptyState
                icon="mic"
                title="No vocal layers yet"
                description="Choose a tool, set the intensity and section, then generate. Each result appears here as its own lane with mute, solo, volume, pan and re-render controls."
              />
            ) : (
              <div className="space-y-3">
                {[...vocalTracks]
                  .sort((a, b) => a.order - b.order)
                  .map((track) => {
                    const asset = assets.find((a) => a.id === track.assetId);
                    if (!asset) return null;
                    const isCurrent = player.assetId === asset.id;
                    const progress = isCurrent && player.duration ? player.currentTime / player.duration : 0;
                    return (
                      <div
                        key={track.id}
                        className={cn(
                          "rounded-xl border p-3 transition-colors",
                          isCurrent ? "border-violet/40 bg-violet/[0.06]" : "border-white/10 bg-black/20",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => playAsset({ id: asset.id, name: asset.name }, project.id)}
                            aria-label={`Play ${track.name}`}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-magenta text-white shadow hover:scale-105"
                          >
                            <Icon
                              name={isCurrent && player.playing ? "pause" : "play"}
                              size={12}
                              filled
                            />
                          </button>
                          <div className="min-w-0 flex-1">
                            <input
                              value={track.name}
                              onChange={(e) =>
                                updateProject((p) => ({
                                  ...p,
                                  tracks: p.tracks.map((t) =>
                                    t.id === track.id ? { ...t, name: e.target.value } : t,
                                  ),
                                }))
                              }
                              className="w-full truncate border-none bg-transparent p-0 text-xs font-semibold text-softwhite focus:outline-none"
                              aria-label="Lane name"
                            />
                            <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-muted">
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-full"
                                style={{ background: track.color }}
                              />
                              {STEM_ROLE_LABEL[track.role]} · {formatTime(asset.durationSec)} ·{" "}
                              {(asset.sampleRate / 1000).toFixed(1)} kHz
                              {asset.engine ? (
                                <Tooltip label={asset.engine}>
                                  <span className="cursor-help underline decoration-dotted underline-offset-2">
                                    engine
                                  </span>
                                </Tooltip>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <IconButton
                              icon={track.muted ? "volumeMute" : "volume"}
                              label={track.muted ? "Unmute" : "Mute"}
                              active={track.muted}
                              onClick={() =>
                                updateProject((p) => ({
                                  ...p,
                                  tracks: p.tracks.map((t) =>
                                    t.id === track.id ? { ...t, muted: !t.muted } : t,
                                  ),
                                }))
                              }
                            />
                            <IconButton
                              icon="headphones"
                              label={track.soloed ? "Unsolo" : "Solo"}
                              tone="gold"
                              active={track.soloed}
                              onClick={() =>
                                updateProject((p) => ({
                                  ...p,
                                  tracks: p.tracks.map((t) =>
                                    t.id === track.id ? { ...t, soloed: !t.soloed } : t,
                                  ),
                                }))
                              }
                            />
                            <IconButton icon="chevronDown" label="Move down" onClick={() => moveTrack(track.id, 1)} />
                            <IconButton icon="chevron" label="Move up" onClick={() => moveTrack(track.id, -1)} />
                            <IconButton
                              icon="refresh"
                              label="Re-render this lane with current settings"
                              onClick={() => void regenerate(track)}
                              disabled={job?.status === "running"}
                            />
                            <IconButton icon="download" label="Export this lane" onClick={() => setExportingTrack(track)} />
                            <IconButton
                              icon="trash"
                              label="Remove lane and its audio"
                              tone="danger"
                              onClick={() => setDeletingTrack(track)}
                            />
                          </div>
                        </div>

                        <div className="mt-2">
                          <Waveform
                            peaks={asset.peaks}
                            progress={progress}
                            height={44}
                            colors={[track.color, "#22d3ee"]}
                            onSeek={(ratio) =>
                              isCurrent
                                ? seek(ratio * (player.duration || asset.durationSec))
                                : playAsset(
                                    { id: asset.id, name: asset.name },
                                    project.id,
                                    { startAt: ratio * asset.durationSec },
                                  )
                            }
                            ariaLabel={`${track.name} waveform`}
                          />
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Slider
                            label="Volume"
                            min={-24}
                            max={6}
                            step={0.5}
                            value={track.volumeDb}
                            onChange={(v) =>
                              updateProject((p) => ({
                                ...p,
                                tracks: p.tracks.map((t) =>
                                  t.id === track.id ? { ...t, volumeDb: v } : t,
                                ),
                              }))
                            }
                            format={(v) => formatDb(v)}
                          />
                          <Slider
                            label="Pan"
                            min={-1}
                            max={1}
                            step={0.01}
                            value={track.pan}
                            tone="cyan"
                            onChange={(v) =>
                              updateProject((p) => ({
                                ...p,
                                tracks: p.tracks.map((t) =>
                                  t.id === track.id ? { ...t, pan: v } : t,
                                ),
                              }))
                            }
                            format={(v) =>
                              Math.abs(v) < 0.02 ? "C" : v < 0 ? `L${Math.round(-v * 50)}` : `R${Math.round(v * 50)}`
                            }
                          />
                          <Slider
                            label="Reverb send"
                            min={0}
                            max={1}
                            step={0.01}
                            value={track.reverbSend}
                            tone="gold"
                            onChange={(v) =>
                              updateProject((p) => ({
                                ...p,
                                tracks: p.tracks.map((t) =>
                                  t.id === track.id ? { ...t, reverbSend: v } : t,
                                ),
                              }))
                            }
                            format={(v) => `${Math.round(v * 100)}%`}
                          />
                          <Slider
                            label="Stereo width"
                            min={0}
                            max={2}
                            step={0.01}
                            value={track.width}
                            tone="orange"
                            onChange={(v) =>
                              updateProject((p) => ({
                                ...p,
                                tracks: p.tracks.map((t) =>
                                  t.id === track.id ? { ...t, width: v } : t,
                                ),
                              }))
                            }
                            format={(v) => `${Math.round(v * 100)}%`}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </GlassCard>

          {lastRender ? (
            <GlassCard>
              <AnalysisPanel
                analysis={lastRender.analysis}
                title={`Measured: ${lastRender.name}`}
                subtitle="Measured after the layer was rendered in this session. Loudness of a backing layer is intentionally lower than the lead."
              />
            </GlassCard>
          ) : null}

          <GlassCard>
            <SectionHeading
              eyebrow="Session state"
              title="Version & safety"
              description="Saving a version snapshots every vocal lane, mixer setting and mastering target. Restores are reversible."
            />
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-ghost text-xs" onClick={() => void saveVersion("Vocal checkpoint", "vocal")}>
                <Icon name="save" size={13} /> Save version now
              </button>
              <Link href="/mix" className="btn-subtle text-xs">
                <Icon name="sliders" size={13} /> Take these vocals to Sam Mix Studio
              </Link>
            </div>
            <ul className="mt-3 space-y-1.5 text-[10px] leading-relaxed text-muted">
              <li className="flex gap-1.5">
                <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
                Source audio is read-only; every generated layer is a new private audio object.
              </li>
              <li className="flex gap-1.5">
                <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
                Rendering happens locally in your browser, then the layer is stored on your studio server.
              </li>
              <li className="flex gap-1.5">
                <Icon name="info" size={12} className="mt-0.5 shrink-0 text-cyan-300" />
                This DSP engine creates harmony/double/choir layers from your recording. It does not
                synthesise new lyrics or clone a voice.
              </li>
            </ul>
          </GlassCard>
        </div>
      </div>

      {/* Arrangement modal */}
      <Modal
        open={showPlan}
        onClose={() => setShowPlan(false)}
        title="Vocal Arrangement Assistant"
        description="A written plan derived from your instruction and tempo. Apply it to the generator when it matches your intent."
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShowPlan(false)}>
              Close
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!plan) return;
                setVocal({
                  tool: plan.settings.tool,
                  layerCount: plan.settings.layerCount,
                  intensity: plan.settings.intensity,
                  density: plan.settings.density,
                  choirSize: plan.settings.choirSize,
                  choirStyle: plan.settings.choirStyle,
                });
                setShowPlan(false);
                notify("success", "Arrangement applied", "Layer settings now match the plan.");
              }}
            >
              Apply to generator
            </button>
          </>
        }
      >
        {plan ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-violet/25 bg-violet/[0.08] p-3 text-xs leading-relaxed text-softwhite/90">
              {plan.summary}
            </p>
            {plan.sections.map((section) => (
              <div key={section.section} className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-softwhite">{section.section}</span>
                  <div className="flex items-center gap-1.5">
                    <StatusPill tone="neutral">{section.bars}</StatusPill>
                    <StatusPill
                      tone={section.density === "full" ? "success" : section.density === "medium" ? "info" : "neutral"}
                    >
                      {section.density} density
                    </StatusPill>
                  </div>
                </div>
                <ul className="mt-2 space-y-0.5 text-[11px] text-muted">
                  {section.layers.map((layer) => (
                    <li key={layer} className="flex gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet" />
                      {layer}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] leading-relaxed text-cyan-100/70">{section.placement}</p>
              </div>
            ))}
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3 text-[11px] leading-relaxed text-cyan-100/80">
              Applying the plan changes generator settings only. No audio is created until you press
              Generate.
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete lane confirmation */}
      <Modal
        open={Boolean(deletingTrack)}
        onClose={() => setDeletingTrack(null)}
        title="Remove this vocal lane?"
        description="The generated audio file is deleted from the studio server. Your source recording is not affected."
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDeletingTrack(null)}>
              Keep lane
            </button>
            <button
              className="btn-danger"
              onClick={async () => {
                if (deletingTrack?.assetId) await deleteAsset(deletingTrack.assetId);
                setDeletingTrack(null);
              }}
            >
              <Icon name="trash" size={13} /> Delete lane
            </button>
          </>
        }
      >
        <p className="text-xs text-muted">{deletingTrack?.name}</p>
      </Modal>

      {/* Export modal */}
      <Modal
        open={Boolean(exportingTrack)}
        onClose={() => setExportingTrack(null)}
        title="Export vocal layer"
        description="The original audio is untouched. This encodes the lane exactly as it is stored."
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setExportingTrack(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => exportingTrack && void exportLayer(exportingTrack)}
              disabled={job?.status === "running"}
            >
              <Icon name="download" size={14} /> Export {exportingTrack ? `(${exportFormat.replace("_", " ")})` : ""}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-xs text-muted">
          <p className="font-medium text-softwhite">{exportingTrack?.name}</p>
          <Segmented
            value={exportFormat}
            onChange={(v) => setExportFormat(v)}
            options={[
              { value: "wav24", label: "WAV 24-bit" },
              { value: "wav32", label: "WAV 32-bit float" },
              { value: "mp3_320", label: "MP3 320 kbps" },
            ]}
          />
          <p className="text-[10px] leading-relaxed">
            Exports are stored privately and appear in Export History with their measured loudness.
          </p>
        </div>
      </Modal>
    </div>
  );
}
