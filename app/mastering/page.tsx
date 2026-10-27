"use client";

import { useState } from "react";
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
  Toggle,
  Tooltip,
  cn,
} from "@/components/ui/primitives";
import { ProjectGate, SessionStrip, StudioHeader } from "@/components/studio/ProjectGate";
import { PromptEditor } from "@/components/studio/PromptEditor";
import { AnalysisPanel, BandBalance } from "@/components/studio/AnalysisPanel";
import { JobStatusCard, useJobRunner } from "@/components/studio/useJobRunner";
import { AudioAssetSelect } from "@/components/studio/AudioAssetSelect";
import { UploadZone } from "@/components/audio/UploadZone";
import { Waveform } from "@/components/audio/Waveform";
import { useStudio } from "@/lib/client/studio";
import { assetChannels, loadAssetBuffer } from "@/lib/client/audio";
import { analyzeBuffer } from "@/lib/audio/analysis";
import { renderMaster } from "@/lib/audio/render";
import { exportChannels } from "@/lib/client/exporting";
import { MASTER_PROFILES, PROMPT_SEEDS, type MasterProfileId, type MasterState } from "@/lib/types";
import { formatDb, formatLufs } from "@/lib/format";

export default function MasteringPage() {
  return (
    <ProjectGate
      studio="mastering"
      title="Sam Mastering Studio"
      tagline="AI-assisted professional mastering: loudness analysis, tonal balancing, dynamics control, A/B comparison and verified exports."
      icon="disc"
    >
      <MasteringStudio />
    </ProjectGate>
  );
}

function MasteringStudio() {
  const {
    project,
    updateProject,
    upload,
    uploadChannels,
    playAsset,
    player,
    seek,
    saveVersion,
    notify,
    saveExport,
    settings,
  } = useStudio();
  const { job, run } = useJobRunner("mastering");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [exportFormat, setExportFormat] = useState<"wav24" | "wav16" | "wav32" | "mp3_320">(
    settings?.defaultExportFormat ?? "wav24",
  );

  if (!project) return null;
  const master = project.mastering;
  const controls = master.controls;
  const assets = project.assets;
  const mixCandidates = assets.filter((a) => a.kind === "mix" || a.kind === "master");
  const sourceAsset = assets.find((a) => a.id === master.sourceAssetId) ?? mixCandidates[0] ?? null;
  const masterAsset = assets.find((a) => a.id === master.lastMasterAssetId) ?? null;
  const sourceAnalysis = master.sourceAnalysis;
  const masterAnalysis = master.lastAnalysis;

  const setMaster = (patch: Partial<MasterState>) =>
    updateProject((p) => ({ ...p, mastering: { ...p.mastering, ...patch } }));

  const applyProfile = (profileId: MasterProfileId) => {
    const profile = MASTER_PROFILES.find((p) => p.id === profileId);
    if (!profile) return;
    setMaster({ profileId, controls: { ...profile.controls } });
    notify("info", `${profile.label} loaded`, "Starting point applied to the controls — review before rendering.");
  };

  const analyseSource = async () => {
    if (!sourceAsset) {
      notify("error", "Select a source", "Choose the finished mix you want to master.");
      return;
    }
    await run("Analyse source", "mastering-analysis", async (report) => {
      report(15, "Loading source mix");
      const buffer = await loadAssetBuffer(project.id, sourceAsset.id);
      report(55, "Measuring loudness and tone");
      const analysis = analyzeBuffer(assetChannels(buffer), buffer.sampleRate, {
        bitDepth: sourceAsset.bitDepth,
        durationSec: sourceAsset.durationSec,
      });
      setMaster({ sourceAnalysis: analysis, sourceAssetId: sourceAsset.id });
      report(100, `${analysis.integratedLufs.toFixed(1)} LUFS · ${analysis.truePeakDb.toFixed(2)} dBTP measured`);
    });
  };

  const render = async () => {
    if (!sourceAsset) {
      notify("error", "Select a source", "Choose the finished mix you want to master.");
      return;
    }
    await run("Render master", "mastering", async (report) => {
      report(4, "Loading the source mix");
      const buffer = await loadAssetBuffer(project.id, sourceAsset.id);
      const sourceChannels = assetChannels(buffer);
      report(10, "Measuring the source for before/after reference");
      const srcAnalysis = analyzeBuffer(sourceChannels, buffer.sampleRate, {
        bitDepth: sourceAsset.bitDepth,
      });
      report(16, "Building the mastering chain");
      const result = await renderMaster(sourceChannels, buffer.sampleRate, {
        controls,
        sampleRate: master.outputSampleRate,
        onProgress: (pct, message) => report(16 + pct * 0.58, message),
      });
      report(80, "Measuring the finished master");
      report(86, "Storing the master privately");
      const asset = await uploadChannels(result.channels, result.sampleRate, {
        name: `${project.name} — Master ${project.assets.filter((a) => a.kind === "master").length + 1}`,
        kind: "master",
        engine: result.applied.join(" · "),
        createTrack: false,
        bitDepth: 24,
      });
      setMaster({
        sourceAssetId: sourceAsset.id,
        sourceAnalysis: srcAnalysis,
        lastAnalysis: result.measured,
        lastMasterAssetId: asset.id,
        lastRenderNotes: result.notes,
        lastAppliedStages: result.applied,
      });
      report(
        100,
        `Master stored · ${result.measured.integratedLufs.toFixed(1)} LUFS · ${result.measured.truePeakDb.toFixed(2)} dBTP`,
      );
      notify(
        "success",
        "Master rendered",
        `${result.measured.integratedLufs.toFixed(1)} LUFS · ${result.measured.truePeakDb.toFixed(2)} dBTP · measured after limiting.`,
      );
    });
  };

  const loudnessDelta = (() => {
    if (!sourceAnalysis || !masterAnalysis) return null;
    return masterAnalysis.integratedLufs - sourceAnalysis.integratedLufs;
  })();

  const playComparison = (which: "original" | "mastered") => {
    const asset = which === "original" ? sourceAsset : masterAsset;
    if (!asset) {
      notify("error", "Nothing to compare yet", which === "mastered" ? "Render a master first." : "Select a source mix.");
      return;
    }
    let gainDb = 0;
    if (master.loudnessMatched && sourceAnalysis && masterAnalysis) {
      // Attenuate the louder version so the comparison is fair.
      gainDb =
        which === "mastered"
          ? Math.min(0, sourceAnalysis.integratedLufs - masterAnalysis.integratedLufs)
          : Math.min(0, masterAnalysis.integratedLufs - sourceAnalysis.integratedLufs);
    }
    void playAsset({ id: asset.id, name: asset.name }, project.id, {
      gainDb,
      startAt: player.currentTime,
    });
  };

  const exportMasterFile = async () => {
    if (!masterAsset) {
      notify("error", "Render a master first", "Exports write the stored master file.");
      return;
    }
    setShowExport(false);
    await run("Export master", "master-export", async (report) => {
      report(8, "Loading stored master");
      const buffer = await loadAssetBuffer(project.id, masterAsset.id);
      let channels = assetChannels(buffer);
      if (buffer.sampleRate !== master.outputSampleRate) {
        notify(
          "info",
          "Using the rendered sample rate",
          `The stored master is ${(buffer.sampleRate / 1000).toFixed(1)} kHz. Re-render to change the rate.`,
        );
      }
      // Trim/pad the bit depth specific export via the encoder.
      report(45, "Encoding");
      const record = await exportChannels({
        channels,
        sampleRate: buffer.sampleRate,
        format: exportFormat,
        project,
        studio: "mastering",
        assetId: masterAsset.id,
        label: `${project.name}_Master`,
        analysis: masterAnalysis,
        saveExport,
        dither: settings?.dither16Bit,
        onProgress: (pct, stage) => report(45 + pct * 0.5, stage),
      });
      report(100, `${record.fileName} exported`);
    });
  };

  const handleUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const asset = await upload(file, {
      kind: "source",
      createTrack: false,
      trackName: file.name.replace(/\.[^.]+$/, ""),
    });
    setMaster({ sourceAssetId: asset.id, sourceAnalysis: null, lastAnalysis: null });
    notify("success", "Mastering source set", "Run Analyse source to measure it.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StudioHeader
          studio="mastering"
          title="Sam Mastering Studio"
          tagline="Prepare a finished Afrobeats mix for release with measured loudness, tonal control and verified true-peak delivery."
          icon="disc"
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-xs" onClick={() => void saveVersion("Mastering checkpoint", "mastering")}>
            <Icon name="save" size={13} /> Save version
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => setShowReport(true)}
            disabled={!masterAnalysis}
          >
            <Icon name="file" size={13} /> Technical report
          </button>
          <button className="btn-primary text-xs" onClick={() => void render()} disabled={!sourceAsset || job?.status === "running"}>
            <Icon name="disc" size={13} /> {job?.status === "running" ? "Rendering…" : "Render master"}
          </button>
          <button className="btn-subtle text-xs" onClick={() => setShowExport(true)} disabled={!masterAsset}>
            <Icon name="download" size={13} /> Export
          </button>
        </div>
      </div>
      <SessionStrip />
      {job ? <JobStatusCard job={job} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* Source + comparison */}
        <div className="space-y-4">
          <GlassCard accent="master">
            <SectionHeading
              eyebrow="Source"
              title="Finished mix"
              description="Choose a bounced mix from Sam Mix Studio, or upload a stereo mix to master. The source is never altered."
              action={
                <button className="btn-ghost px-2.5 py-1.5 text-[10px]" onClick={() => void analyseSource()}>
                  <Icon name="target" size={12} /> Analyse source
                </button>
              }
            />
            <AudioAssetSelect
              label="Source mix"
              assets={assets}
              value={sourceAsset?.id ?? null}
              onChange={(id) => setMaster({ sourceAssetId: id, sourceAnalysis: null })}
              emptyHint="No audio yet — bounce a mix in Sam Mix Studio or upload a stereo file below."
              hint="For the best result master a 24-bit bounce with 3–6 dB of headroom and no limiter."
            />
            <div className="mt-3">
              <UploadZone
                compact
                onFiles={handleUpload}
                title="Upload a finished mix"
                subtitle="WAV · AIFF · FLAC · MP3 · max 80 MB"
                busy={job?.status === "running"}
              />
            </div>
            {sourceAsset ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
                <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
                  <span>Source waveform</span>
                  <span className="mono">
                    {(sourceAsset.sampleRate / 1000).toFixed(1)} kHz · {sourceAsset.channels} ch
                    {sourceAsset.bitDepth ? ` · ${sourceAsset.bitDepth}-bit` : ""}
                  </span>
                </div>
                <Waveform
                  peaks={sourceAsset.peaks}
                  height={52}
                  progress={
                    player.assetId === sourceAsset.id && player.duration
                      ? player.currentTime / player.duration
                      : 0
                  }
                  colors={["#fb923c", "#facc15"]}
                  onSeek={(ratio) => {
                    if (player.assetId === sourceAsset.id) seek(ratio * (player.duration || 0));
                    else void playAsset({ id: sourceAsset.id, name: sourceAsset.name }, project.id, { startAt: ratio * sourceAsset.durationSec });
                  }}
                />
              </div>
            ) : null}
          </GlassCard>

          <GlassCard>
            <SectionHeading
              eyebrow="A / B comparison"
              title="Original vs mastered"
              action={
                <Toggle
                  checked={master.loudnessMatched}
                  onChange={(v) => setMaster({ loudnessMatched: v })}
                  label="Loudness matching"
                />
              }
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                className="rounded-xl border border-white/10 bg-black/25 p-3 text-left transition-colors hover:border-orange/40"
                onClick={() => playComparison("original")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-softwhite">Original mix</span>
                  <Icon name="play" size={13} className="text-orange" filled />
                </div>
                <div className="mono mt-1 text-lg text-softwhite">
                  {sourceAnalysis ? formatLufs(sourceAnalysis.integratedLufs) : "—"}
                </div>
                <div className="text-[10px] text-muted">
                  {sourceAnalysis ? `${sourceAnalysis.truePeakDb.toFixed(2)} dBTP` : "not measured"}
                </div>
              </button>
              <button
                className="rounded-xl border border-white/10 bg-black/25 p-3 text-left transition-colors hover:border-gold/40"
                onClick={() => playComparison("mastered")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-softwhite">Mastered</span>
                  <Icon name="play" size={13} className="text-gold" filled />
                </div>
                <div className="mono mt-1 text-lg text-softwhite">
                  {masterAnalysis ? formatLufs(masterAnalysis.integratedLufs) : "—"}
                </div>
                <div className="text-[10px] text-muted">
                  {masterAnalysis ? `${masterAnalysis.truePeakDb.toFixed(2)} dBTP` : "not rendered"}
                </div>
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted/80">
              {master.loudnessMatched
                ? "The louder version is attenuated so louder does not simply sound better. Gain compensation is applied in the player."
                : "Loudness matching is off — expect the master to sound louder."}
              {loudnessDelta != null ? ` Measured difference: ${formatDb(loudnessDelta, 1)} integrated.` : ""}
            </p>

            {masterAsset ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
                <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
                  <span>Mastered waveform</span>
                  <span className="mono">{masterAsset.name}</span>
                </div>
                <Waveform
                  peaks={masterAsset.peaks}
                  height={52}
                  progress={
                    player.assetId === masterAsset.id && player.duration
                      ? player.currentTime / player.duration
                      : 0
                  }
                  colors={["#facc15", "#ec4899"]}
                  onSeek={(ratio) => {
                    if (player.assetId === masterAsset.id) seek(ratio * (player.duration || 0));
                    else
                      void playAsset({ id: masterAsset.id, name: masterAsset.name }, project.id, {
                        startAt: ratio * masterAsset.durationSec,
                        gainDb:
                          master.loudnessMatched && sourceAnalysis && masterAnalysis
                            ? Math.min(0, sourceAnalysis.integratedLufs - masterAnalysis.integratedLufs)
                            : 0,
                      });
                  }}
                />
              </div>
            ) : (
              <EmptyState
                compact
                icon="disc"
                title="No master yet"
                description="Choose a profile and press Render master. The result appears here with measured before/after values."
              />
            )}
          </GlassCard>

          <GlassCard>
            <SectionHeading
              eyebrow="Verification"
              title="Measured master"
              description="These values are read from the rendered file. A preset is a starting point, not a guarantee of a competitive master."
            />
            <AnalysisPanel analysis={masterAnalysis} title="Master measurement" />
            {master.lastRenderNotes.length ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-2.5">
                <div className="label mb-1">Loudness/loudness-loop log</div>
                <ul className="space-y-0.5 text-[10px] leading-relaxed text-muted">
                  {master.lastRenderNotes.map((note, i) => (
                    <li key={i} className="mono">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </GlassCard>
        </div>

        {/* Profiles + controls */}
        <div className="space-y-4">
          <GlassCard accent="master">
            <SectionHeading eyebrow="Profiles" title="Mastering starting points" />
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {MASTER_PROFILES.map((profile) => {
                const active = master.profileId === profile.id;
                return (
                  <button
                    key={profile.id}
                    onClick={() => applyProfile(profile.id)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-xl border p-2.5 text-left transition-all",
                      active
                        ? "border-gold/50 bg-gold/[0.08] shadow-glow-gold"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25",
                    )}
                  >
                    <div className="text-[11px] font-semibold text-softwhite">{profile.label}</div>
                    <div className="mono mt-0.5 text-[9px] text-muted">
                      {profile.controls.targetLufs} LUFS · {profile.controls.truePeakCeilingDb} dBTP
                    </div>
                    <div className="mt-1 line-clamp-2 text-[9px] leading-snug text-muted/80">
                      {profile.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeading
              eyebrow="Controls"
              title="Mastering targets"
              action={
                <Segmented
                  size="sm"
                  value={showAdvanced ? "advanced" : "basic"}
                  onChange={(v) => setShowAdvanced(v === "advanced")}
                  options={[
                    { value: "basic", label: "Basic" },
                    { value: "advanced", label: "Advanced" },
                  ]}
                />
              }
            />
            <div className="space-y-3">
              <Slider
                label="Loudness target"
                min={-18}
                max={-6}
                step={0.5}
                tone="gold"
                value={controls.targetLufs}
                onChange={(v) => setControls({ targetLufs: v })}
                format={(v) => formatLufs(v)}
                hint="Streaming platforms normalise to about −14 LUFS."
              />
              <Slider
                label="True-peak ceiling"
                min={-3}
                max={-0.1}
                step={0.1}
                tone="gold"
                value={controls.truePeakCeilingDb}
                onChange={(v) => setControls({ truePeakCeilingDb: v })}
                format={(v) => `${v.toFixed(1)} dBTP`}
                hint="Measured after rendering with 4× oversampling."
              />
              <Slider
                label="Low-end weight"
                min={-3}
                max={4}
                step={0.5}
                tone="orange"
                value={controls.lowShelfDb}
                onChange={(v) => setControls({ lowShelfDb: v })}
                format={(v) => formatDb(v)}
                hint="Low shelf at 90 Hz with a linked 320 Hz compensation cut."
              />
              <Slider
                label="Stereo width"
                min={70}
                max={130}
                step={1}
                tone="orange"
                value={controls.stereoWidthPct}
                onChange={(v) => setControls({ stereoWidthPct: v })}
                format={(v) => `${v}%`}
              />
              <Slider
                label="Saturation"
                min={0}
                max={1}
                step={0.01}
                tone="orange"
                value={controls.saturation}
                onChange={(v) => setControls({ saturation: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              {showAdvanced ? (
                <>
                  <Slider
                    label="High-end air (8.5 kHz shelf)"
                    min={-3}
                    max={4}
                    step={0.5}
                    tone="gold"
                    value={controls.highShelfDb}
                    onChange={(v) => setControls({ highShelfDb: v })}
                    format={(v) => formatDb(v)}
                  />
                  <Slider
                    label="Dynamic preservation"
                    min={0}
                    max={1}
                    step={0.01}
                    tone="gold"
                    value={controls.dynamicPreservation}
                    onChange={(v) => setControls({ dynamicPreservation: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                    hint="Higher values reduce glue compression and keep transients open."
                  />
                  <Slider
                    label="Limiter release"
                    min={40}
                    max={300}
                    step={5}
                    tone="gold"
                    value={controls.limiterReleaseMs}
                    onChange={(v) => setControls({ limiterReleaseMs: v })}
                    format={(v) => `${v} ms`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="label mb-1">Render sample rate</div>
                      <select
                        className="field text-[11px]"
                        value={master.outputSampleRate}
                        onChange={(e) => setMaster({ outputSampleRate: Number(e.target.value) })}
                      >
                        <option value={44100} className="bg-[#15112B]">44.1 kHz</option>
                        <option value={48000} className="bg-[#15112B]">48 kHz</option>
                        <option value={96000} className="bg-[#15112B]">96 kHz</option>
                      </select>
                    </div>
                    <div>
                      <div className="label mb-1">Render bit depth</div>
                      <select
                        className="field text-[11px]"
                        value={master.outputBitDepth}
                        onChange={(e) => setMaster({ outputBitDepth: Number(e.target.value) as 16 | 24 | 32 })}
                      >
                        <option value={16} className="bg-[#15112B]">16-bit (dithered)</option>
                        <option value={24} className="bg-[#15112B]">24-bit</option>
                        <option value={32} className="bg-[#15112B]">32-bit float</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[9px] leading-relaxed text-muted/70">
                    The master is rendered and stored as a 24-bit WAV at the selected rate; export
                    re-encodes from that stored file. Changing the rate requires a re-render.
                  </p>
                </>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard>
            <PromptEditor
              studio="mastering"
              prompt={master.prompt}
              onPromptChange={(value) => setMaster({ prompt: value })}
              improvedPrompt={master.improvedPrompt}
              onImproved={(result) =>
                setMaster({
                  improvedPrompt: result.text,
                  improvedBy: result.source === "gemini" ? "gemini" : "local-heuristic",
                })
              }
              seed={PROMPT_SEEDS.mastering}
              rows={4}
              title="Mastering instruction"
            />
            <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
              The brief records your intent alongside the measured result. Moving the sliders is what
              actually changes the audio.
            </p>
            <button className="btn-primary mt-3 w-full text-xs" onClick={() => void render()} disabled={!sourceAsset || job?.status === "running"}>
              <Icon name="disc" size={14} /> Render master
            </button>
          </GlassCard>
        </div>
      </div>

      {/* Report modal */}
      <Modal
        open={showReport}
        onClose={() => setShowReport(false)}
        title="Mastering technical report"
        description="Every number below was measured from the rendered file."
        size="lg"
        footer={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setShowReport(false)}>
              Close
            </button>
            <button className="btn-primary" onClick={() => setShowExport(true)}>
              <Icon name="download" size={13} /> Export
            </button>
          </div>
        }
      >
        {masterAnalysis ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="success" icon="check">
                Rendered {new Date(masterAnalysis.measuredAt).toLocaleString()}
              </StatusPill>
              <StatusPill tone="neutral">{masterAsset?.name}</StatusPill>
              <StatusPill tone="neutral">
                {master.outputBitDepth === 32 ? "32-bit float master" : `${master.outputBitDepth}-bit master`} ·{" "}
                {(master.outputSampleRate / 1000).toFixed(1)} kHz
              </StatusPill>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="label mb-1">Before</div>
                {sourceAnalysis ? (
                  <>
                    <div className="mono text-xl text-orange">{formatLufs(sourceAnalysis.integratedLufs)}</div>
                    <div className="text-[10px] text-muted">
                      {sourceAnalysis.truePeakDb.toFixed(2)} dBTP · width {sourceAnalysis.stereoWidthPct.toFixed(0)}%
                    </div>
                    <div className="mt-2">
                      <BandBalance analysis={sourceAnalysis} />
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-muted">Source was not measured for this render.</p>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="label mb-1">After</div>
                <div className="mono text-xl text-gold">{formatLufs(masterAnalysis.integratedLufs)}</div>
                <div className="text-[10px] text-muted">
                  {masterAnalysis.truePeakDb.toFixed(2)} dBTP · width {masterAnalysis.stereoWidthPct.toFixed(0)}%
                </div>
                <div className="mt-2">
                  <BandBalance analysis={masterAnalysis} />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="label mb-1">Chain applied</div>
              <ul className="grid gap-1 text-[11px] text-muted sm:grid-cols-2">
                {master.lastAppliedStages.map((stage) => (
                  <li key={stage} className="flex gap-1.5">
                    <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
                    {stage}
                  </li>
                ))}
              </ul>
            </div>
            {master.lastRenderNotes.length ? (
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="label mb-1">Measured passes</div>
                <ul className="space-y-0.5 text-[10px] text-muted">
                  {master.lastRenderNotes.map((note, i) => (
                    <li key={i} className="mono">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-[9px] leading-relaxed text-muted/60">{masterAnalysis.method}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">Render a master to generate the report.</p>
        )}
      </Modal>

      {/* Export modal */}
      <Modal
        open={showExport}
        onClose={() => setShowExport(false)}
        title="Export master"
        description="Encodes the stored master. The source mix and all previous versions remain untouched."
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShowExport(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void exportMasterFile()}>
              <Icon name="download" size={14} /> Export file
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Segmented
            value={exportFormat}
            onChange={(v) => setExportFormat(v)}
            options={[
              { value: "wav24", label: "WAV 24" },
              { value: "wav16", label: "WAV 16" },
              { value: "wav32", label: "WAV 32f" },
              { value: "mp3_320", label: "MP3 320" },
            ]}
          />
          <div className="rounded-lg border border-white/10 bg-black/25 p-2.5 text-[11px] leading-relaxed text-muted">
            {masterAnalysis ? (
              <>
                <div className="mono text-softwhite">
                  {formatLufs(masterAnalysis.integratedLufs)} · {masterAnalysis.truePeakDb.toFixed(2)} dBTP
                </div>
                {masterAsset ? (
                  <div>
                    Rendered at {(masterAsset.sampleRate / 1000).toFixed(1)} kHz ·{" "}
                    {(masterAsset.sizeBytes / 1048576).toFixed(1)} MB stored
                  </div>
                ) : null}
              </>
            ) : (
              "No master measurement available."
            )}
          </div>
          {exportFormat === "mp3_320" && masterAsset && ![44100, 48000, 32000].includes(masterAsset.sampleRate) ? (
            <p className="text-[10px] text-amber-200">
              MP3 encoding supports 32/44.1/48 kHz. Re-render at 44.1 or 48 kHz to export MP3.
            </p>
          ) : null}
          <p className="text-[10px] text-muted">
            The file is stored privately in Export History with its measured loudness, then downloaded
            to your device.
          </p>
        </div>
      </Modal>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <Icon name="lock" size={11} /> Mastered audio stays on your studio server until you export it.
        </span>
        <Link href="/exports" className="font-semibold text-violet-200 hover:text-white">
          View export history →
        </Link>
      </div>
    </div>
  );

  function setControls(patch: Partial<MasterState["controls"]>) {
    setMaster({ controls: { ...controls, ...patch }, profileId: master.profileId === "custom" ? "custom" : master.profileId });
  }
}
