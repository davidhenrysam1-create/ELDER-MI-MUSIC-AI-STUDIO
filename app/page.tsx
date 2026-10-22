"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  EmptyState,
  GlassCard,
  GradientText,
  Metric,
  SectionHeading,
  StatusPill,
  cn,
} from "@/components/ui/primitives";
import { StudioCard } from "@/components/dashboard/StudioCard";
import { NewProjectButton } from "@/components/shell/NewProjectDialog";
import { useStudio } from "@/lib/client/studio";
import { formatBytes, formatDateTime, formatLufs, relativeTime } from "@/lib/format";
import { STUDIO_META } from "@/lib/types";

export default function DashboardPage() {
  const { project, projects, exports, system, ready, loadError, selectProject, player, playAsset } =
    useStudio();

  const stats = useMemo(() => {
    const audioBytes = projects.reduce(
      (sum, p) => sum + p.assets.reduce((s, a) => s + a.sizeBytes, 0),
      0,
    );
    const assets = projects.reduce((sum, p) => sum + p.assets.length, 0);
    const masters = projects.flatMap((p) => p.assets.filter((a) => a.kind === "master"));
    const latestMaster = masters.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { audioBytes, assets, masters, latestMaster };
  }, [projects]);

  const recentProjects = projects.slice(0, 5);
  const vocalAssets = project?.assets.filter((a) => a.kind === "vocal").slice(0, 3) ?? [];
  const mixAssets = project?.assets.filter((a) => a.kind === "mix").slice(0, 3) ?? [];
  const masterAssets = project?.assets.filter((a) => a.kind === "master").slice(0, 3) ?? [];
  const jobs = project?.jobs.slice(0, 5) ?? [];
  const lastMasterAnalysis = project?.mastering.lastAnalysis ?? null;

  if (!ready) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-violet" />
        <p className="text-sm text-muted">Opening your studio…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {loadError ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          <Icon name="alert" size={16} className="mt-0.5" />
          <div>
            <div className="font-semibold">The studio could not load its data</div>
            <p className="mt-0.5 text-xs text-rose-100/80">{loadError}</p>
          </div>
        </div>
      ) : null}

      {/* Hero */}
      <section className="glass relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-magenta/20 blur-[80px]" />
          <div className="absolute -bottom-24 left-1/3 h-56 w-72 rounded-full bg-cyan/10 blur-[90px]" />
          <svg
            className="absolute inset-x-0 bottom-0 h-24 w-full opacity-30"
            viewBox="0 0 800 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="heroWave" x1="0" x2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
                <stop offset="30%" stopColor="#a855f7" />
                <stop offset="65%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 60 C 40 20, 80 90, 120 55 S 200 25, 240 60 S 320 95, 360 50 S 440 20, 480 62 S 560 92, 600 48 S 680 22, 720 58 S 780 86, 800 52"
              fill="none"
              stroke="url(#heroWave)"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="info" icon="sparkles">
              AFROBEATS PRODUCTION PLATFORM
            </StatusPill>
            <StatusPill tone={system?.providers.gemini.configured ? "success" : "warning"} icon="bolt">
              {system?.providers.gemini.configured
                ? `Gemini ${system.providers.gemini.model} connected`
                : "Gemini not configured — local prompt engine active"}
            </StatusPill>
          </div>

          <h1 className="mt-4 max-w-3xl font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-[40px]">
            <GradientText>Welcome to Elder Mi Music AI Studio</GradientText>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Create powerful vocal arrangements, refine your mix, and master your sound with
            AI-assisted music production tools designed for Afrobeats.
          </p>
          <p className="mt-2 text-xs font-medium italic text-gold/90">
            “Your Sound. Your Culture. Your Studio.”
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <NewProjectButton label="Create New Project" />
            <Link href="/mix" className="btn-ghost text-xs">
              <Icon name="upload" size={14} />
              Upload stems to Sam Mix Studio
            </Link>
            {project ? (
              <Link href="/vocal" className="btn-subtle text-xs">
                <Icon name="mic" size={14} />
                Continue {project.name.split(" ").slice(0, 2).join(" ")}
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Metric label="Projects" value={projects.length} hint="Saved on this studio server" />
            <Metric label="Audio objects" value={stats.assets} hint={formatBytes(stats.audioBytes)} />
            <Metric label="Exports" value={exports.length} hint="Verified renders" />
            <Metric
              label="Latest master"
              value={lastMasterAnalysis ? formatLufs(lastMasterAnalysis.integratedLufs) : "—"}
              hint={
                lastMasterAnalysis
                  ? `${lastMasterAnalysis.truePeakDb.toFixed(2)} dBTP measured`
                  : "No master measured yet"
              }
              tone={lastMasterAnalysis ? "good" : "neutral"}
            />
          </div>
        </div>
      </section>

      {/* Studios */}
      <section>
        <SectionHeading
          eyebrow="Three workspaces, one project"
          title="Choose your studio"
          description="Vocal arrangement, mixing and mastering share the same project context — move between them without re-uploading a thing."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <StudioCard
            studio="vocal"
            title="Sam Vocal Studio"
            description="Create AI-assisted choruses, harmonies, ad-libs, vocal doubles, and powerful backing-vocal arrangements."
            action="Open Vocal Studio"
            href="/vocal"
            meta={
              project
                ? `${project.assets.filter((a) => a.kind === "vocal").length} generated layers`
                : "No project yet"
            }
          />
          <StudioCard
            studio="mix"
            title="Sam Mix Studio"
            description="Analyse your tracks, improve the balance of your song, and refine your mix with AI-assisted production tools."
            action="Open Mix Studio"
            href="/mix"
            meta={project ? `${project.tracks.length} mixer channels` : "No project yet"}
          />
          <StudioCard
            studio="mastering"
            title="Sam Mastering Studio"
            description="Polish your final mix with tonal balancing, dynamics control, loudness analysis, and mastering tools."
            action="Open Mastering Studio"
            href="/mastering"
            meta={
              lastMasterAnalysis
                ? `${formatLufs(lastMasterAnalysis.integratedLufs)} last render`
                : "Ready for a finished mix"
            }
          />
        </div>
      </section>

      {/* Recent work */}
      <section className="grid gap-4 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2">
          <SectionHeading
            eyebrow="Session library"
            title="Recent projects"
            action={
              <Link href="/projects" className="text-[11px] font-semibold text-violet-200 hover:text-white">
                View all →
              </Link>
            }
          />
          {recentProjects.length === 0 ? (
            <EmptyState
              icon="folder"
              title="No projects yet"
              description="Create your first project to upload audio, generate vocal layers, mix stems and deliver a master. Nothing is pre-filled with fake data."
              action={<NewProjectButton label="Create your first project" />}
            />
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {recentProjects.map((p) => {
                const isCurrent = p.id === project?.id;
                const duration = p.assets.reduce((m, a) => Math.max(m, a.durationSec), 0);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                        isCurrent
                          ? "border-violet/40 bg-violet/20 text-violet-100"
                          : "border-white/10 bg-white/[0.04] text-muted",
                      )}
                    >
                      <Icon name="music" size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => selectProject(p.id)}
                        className="block truncate text-left text-sm font-medium text-softwhite hover:text-violet-200"
                      >
                        {p.name}
                        {isCurrent ? (
                          <span className="ml-2 rounded bg-violet/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-200">
                            current
                          </span>
                        ) : null}
                      </button>
                      <div className="truncate text-[10px] text-muted">
                        {p.genre} · {p.bpm} BPM · {p.musicalKey} · {p.assets.length} audio ·{" "}
                        {p.tracks.length} channels{duration ? ` · ${Math.round(duration)}s` : ""}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted/70">{relativeTime(p.updatedAt)}</span>
                    <Link
                      href="/vocal"
                      className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-muted transition-colors hover:border-white/25 hover:text-white"
                      onClick={() => selectProject(p.id)}
                    >
                      Open
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <SectionHeading
            eyebrow="Engine telemetry"
            title="Processing jobs"
            description="Statuses come from the renders that actually ran in this session."
          />
          {jobs.length === 0 ? (
            <EmptyState
              compact
              icon="clock"
              title="Nothing processing"
              description="Vocal layers, mix bounces and masters are logged here with real progress and errors."
            />
          ) : (
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li key={job.id} className="rounded-lg border border-white/10 bg-black/25 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-softwhite">{job.title}</span>
                    <StatusPill
                      tone={
                        job.status === "completed"
                          ? "success"
                          : job.status === "failed"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {job.status}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-muted">{job.message}</p>
                  <div className="mt-1 text-[9px] uppercase tracking-wider text-muted/60">
                    {STUDIO_META[job.studio].name} · {formatDateTime(job.startedAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </section>

      {/* Assets + exports */}
      <section className="grid gap-4 xl:grid-cols-2">
        <GlassCard>
          <SectionHeading
            eyebrow={project ? project.name : "Current project"}
            title="Recently generated audio"
            description="Each result is a separate, editable audio object — your original recording is never replaced."
          />
          {!project ? (
            <EmptyState
              compact
              icon="folder"
              title="Open a project"
              description="Select or create a project to see its generated vocals, mixes and masters."
            />
          ) : vocalAssets.length + mixAssets.length + masterAssets.length === 0 ? (
            <EmptyState
              compact
              icon="waveform"
              title="No renders yet"
              description="Generate a vocal layer in Sam Vocal Studio or bounce a mix to see finished audio here."
              action={
                <Link href="/vocal" className="btn-primary text-xs">
                  <Icon name="mic" size={13} /> Open Vocal Studio
                </Link>
              }
            />
          ) : (
            <ul className="space-y-1.5">
              {[...vocalAssets, ...mixAssets, ...masterAssets].map((asset) => (
                <li
                  key={asset.id}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2"
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
                      {asset.kind} · {asset.durationSec.toFixed(1)}s · {formatBytes(asset.sizeBytes)}
                    </div>
                  </div>
                  <span className="text-[9px] text-muted/60">{relativeTime(asset.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <SectionHeading
            eyebrow="Deliveries"
            title="Recent exports"
            action={
              <Link href="/exports" className="text-[11px] font-semibold text-violet-200 hover:text-white">
                Export history →
              </Link>
            }
          />
          {exports.length === 0 ? (
            <EmptyState
              compact
              icon="download"
              title="No exports yet"
              description="Exports are written only after a render completes, and include the measured loudness of the file you download."
            />
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {exports.slice(0, 4).map((exp) => (
                <li key={exp.id} className="flex items-center gap-2 py-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-[9px] font-bold text-cyan-200">
                    {exp.format}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] text-softwhite">{exp.fileName}</div>
                    <div className="text-[9px] text-muted">
                      {exp.format} · {formatBytes(exp.sizeBytes)} ·{" "}
                      {exp.integratedLufs != null ? formatLufs(exp.integratedLufs) : "not measured"}
                    </div>
                  </div>
                  <a
                    href={`/api/exports/${exp.id}`}
                    className="text-[10px] text-violet-200 hover:text-white"
                    download
                  >
                    <Icon name="download" size={13} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </section>

      <section className="glass p-4">
        <div className="flex flex-wrap items-start gap-3 text-xs leading-relaxed text-muted">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-200">
            <Icon name="check" size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-softwhite">What is real here: </span>
            loudness and true-peak measurement, gain/pan/EQ/compression, vocal layering from your own
            takes, WAV/MP3 encoding and private storage all run for real.
            <span className="mx-1 text-muted/40">|</span>
            <button
              onClick={() =>
                window.open("/settings#capabilities", "_self")
              }
              className="font-semibold text-violet-200 underline decoration-violet/30 underline-offset-2 hover:text-white"
            >
              See the capability matrix
            </button>{" "}
            for what needs an external provider (neural voice conversion) and what is planned.
          </div>
        </div>
      </section>
    </div>
  );
}
