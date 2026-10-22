"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { EmptyState, GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { NewProjectButton } from "@/components/shell/NewProjectDialog";
import { useStudio } from "@/lib/client/studio";

export function StudioHeader({
  studio,
  title,
  tagline,
  icon,
  actions,
}: {
  studio: "vocal" | "mix" | "mastering";
  title: string;
  tagline: string;
  icon: "mic" | "sliders" | "disc";
  actions?: React.ReactNode;
}) {
  const variant = studio === "vocal" ? "vocal" : studio === "mix" ? "mix" : "master";
  const accent =
    studio === "vocal"
      ? "from-violet via-magenta to-cyan"
      : studio === "mix"
        ? "from-cyan via-sky-400 to-violet"
        : "from-orange via-gold to-magenta";
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br ${accent} text-white shadow-glow`}
        >
          <Icon name={icon} size={20} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <GradientText variant={variant}>{title}</GradientText>
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">{tagline}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function ProjectGate({
  studio,
  title,
  tagline,
  icon,
  children,
}: {
  studio: "vocal" | "mix" | "mastering";
  title: string;
  tagline: string;
  icon: "mic" | "sliders" | "disc";
  children: React.ReactNode;
}) {
  const { project, ready, loading } = useStudio();

  if (!ready || loading) {
    return (
      <div className="space-y-4">
        <StudioHeader studio={studio} title={title} tagline={tagline} icon={icon} />
        <div className="grid place-items-center py-24">
          <div className="mb-3 h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-violet" />
          <p className="text-xs text-muted">Loading your session…</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <StudioHeader studio={studio} title={title} tagline={tagline} icon={icon} />
        <GlassCard accent={studio === "mastering" ? "master" : studio === "mix" ? "mix" : "vocal"}>
          <EmptyState
            icon="folder"
            title="Open a project to start"
            description="The three studios share one project context: audio, vocal layers, mixer settings and mastering targets all live together. Create your first project and upload your song."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <NewProjectButton label="Create New Project" />
                <Link href="/projects" className="btn-ghost text-xs">
                  <Icon name="folder" size={13} /> Browse projects
                </Link>
              </div>
            }
          />
        </GlassCard>
      </div>
    );
  }

  return <>{children}</>;
}

export function SessionStrip() {
  const { project } = useStudio();
  if (!project) return null;
  const assets = project.assets.length;
  const duration = project.assets.reduce((m, a) => Math.max(m, a.durationSec), 0);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusPill tone="neutral" icon="folder">
        {project.name}
      </StatusPill>
      <StatusPill tone="neutral" icon="music">
        {project.genre} · {project.bpm} BPM
      </StatusPill>
      <StatusPill tone="neutral" icon="waveform">
        {assets} audio · {duration ? `${Math.round(duration)}s` : "empty"}
      </StatusPill>
      <StatusPill tone="neutral" icon="layers">
        {project.tracks.length} channels
      </StatusPill>
    </div>
  );
}
