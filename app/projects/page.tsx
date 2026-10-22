"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  ConfirmButton,
  EmptyState,
  GlassCard,
  GradientText,
  Modal,
  SectionHeading,
  StatusPill,
  cn,
} from "@/components/ui/primitives";
import { NewProjectButton } from "@/components/shell/NewProjectDialog";
import { useStudio } from "@/lib/client/studio";
import { api } from "@/lib/client/api";
import { formatBytes, relativeTime } from "@/lib/format";
import { GENRES, STUDIO_META, type Project, type ProjectVersion } from "@/lib/types";

export default function ProjectsPage() {
  const { projects, project, selectProject, deleteProject, duplicateProject, notify, refresh } =
    useStudio();
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [versionsOf, setVersionsOf] = useState<Project | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [versionsBusy, setVersionsBusy] = useState(false);

  const openVersions = async (p: Project) => {
    setVersionsOf(p);
    setVersionsBusy(true);
    try {
      const res = await fetch(`/api/projects/${p.id}/versions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVersions(data.versions);
    } catch (err) {
      notify("error", "Could not load versions", (err as Error).message);
    } finally {
      setVersionsBusy(false);
    }
  };

  const doRename = async () => {
    if (!renaming) return;
    try {
      await api.patchProject(renaming.id, { name: renameValue.trim() || renaming.name });
      await refresh();
      notify("success", "Project renamed");
      setRenaming(null);
    } catch (err) {
      notify("error", "Rename failed", (err as Error).message);
    }
  };

  const totalBytes = projects.reduce(
    (sum, p) => sum + p.assets.reduce((s, a) => s + a.sizeBytes, 0),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <GradientText>My Projects</GradientText>
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            Every session keeps its own audio, vocal layers, mixer settings, mastering targets and
            versions. Nothing is shared between projects unless you duplicate one.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="neutral" icon="folder">
            {projects.length} projects · {formatBytes(totalBytes)}
          </StatusPill>
          <NewProjectButton />
        </div>
      </div>

      {projects.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon="folder"
            title="No projects yet"
            description="Start a session to upload your song and move through vocals, mixing and mastering. Projects persist on your studio server between visits."
            action={<NewProjectButton label="Create New Project" />}
          />
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const vocals = p.assets.filter((a) => a.kind === "vocal").length;
            const mixes = p.assets.filter((a) => a.kind === "mix").length;
            const masters = p.assets.filter((a) => a.kind === "master").length;
            const current = p.id === project?.id;
            return (
              <GlassCard key={p.id} interactive className={cn(current && "border-violet/40")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-softwhite">{p.name}</h3>
                    <div className="mt-0.5 text-[10px] text-muted">
                      {p.genre} · {p.bpm} BPM · {p.musicalKey}
                    </div>
                  </div>
                  {current ? <StatusPill tone="info">Current</StatusPill> : null}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                  {[
                    { label: "Vocals", value: vocals },
                    { label: "Mixes", value: mixes },
                    { label: "Masters", value: masters },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/10 bg-black/25 py-1.5">
                      <div className="mono text-sm font-semibold text-softwhite">{item.value}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted">{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
                  <span>
                    {p.assets.length} audio · {p.tracks.length} channels
                  </span>
                  <span>{relativeTime(p.updatedAt)}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button
                    className="btn-primary px-2.5 py-1.5 text-[10px]"
                    onClick={() => selectProject(p.id)}
                  >
                    <Icon name="play" size={11} filled /> Select
                  </button>
                  <Link
                    href="/vocal"
                    className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-muted hover:text-white"
                  >
                    Open
                  </Link>
                  <button
                    className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-muted hover:text-white"
                    onClick={() => {
                      setRenaming(p);
                      setRenameValue(p.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-muted hover:text-white"
                    onClick={() => void openVersions(p)}
                  >
                    Versions ({p.versions.length})
                  </button>
                  <button
                    className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-muted hover:text-white"
                    onClick={async () => {
                      try {
                        const copy = await duplicateProject(p.id);
                        notify("success", "Project duplicated", copy.name);
                      } catch (err) {
                        notify("error", "Duplicate failed", (err as Error).message);
                      }
                    }}
                  >
                    Duplicate
                  </button>
                  <ConfirmButton
                    label="Delete"
                    icon="trash"
                    title={`Delete "${p.name}"?`}
                    description="All of this project's audio files, bounces, masters and versions are deleted from the studio server. This cannot be undone."
                    confirmLabel="Delete project"
                    onConfirm={async () => {
                      try {
                        await deleteProject(p.id);
                      } catch (err) {
                        notify("error", "Delete failed", (err as Error).message);
                      }
                    }}
                  />
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <GlassCard>
        <SectionHeading
          eyebrow="How sessions work"
          title="One project, three studios"
          description="Audio you import once is available to every studio. Moves between workspaces never re-encode the original."
        />
        <div className="grid gap-3 md:grid-cols-3">
          {(["vocal", "mix", "mastering"] as const).map((studio) => (
            <Link
              key={studio}
              href={STUDIO_META[studio].href}
              className="rounded-xl border border-white/10 bg-black/20 p-3 transition-colors hover:border-white/25"
            >
              <div className="text-xs font-semibold">
                {studio === "vocal" ? (
                  <GradientText variant="vocal">{STUDIO_META[studio].name}</GradientText>
                ) : studio === "mix" ? (
                  <GradientText variant="mix">{STUDIO_META[studio].name}</GradientText>
                ) : (
                  <GradientText variant="master">{STUDIO_META[studio].name}</GradientText>
                )}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{STUDIO_META[studio].tagline}</p>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Voice profiles are optional and consent-gated. Audio never leaves this studio server except
          when you explicitly configure an external AI provider.
        </p>
      </GlassCard>

      {/* Rename modal */}
      <Modal
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Rename project"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setRenaming(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void doRename()}>
              Save name
            </button>
          </>
        }
      >
        <label className="label mb-1.5 block" htmlFor="rename-project">
          Project name
        </label>
        <input
          id="rename-project"
          className="field"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* Versions modal */}
      <Modal
        open={Boolean(versionsOf)}
        onClose={() => setVersionsOf(null)}
        title={`Versions — ${versionsOf?.name ?? ""}`}
        description="Restoring a version first saves a checkpoint of your current work, so the action is reversible."
        size="lg"
      >
        {versionsBusy ? (
          <p className="text-xs text-muted">Loading versions…</p>
        ) : versions.length === 0 ? (
          <EmptyState
            compact
            icon="save"
            title="No saved versions"
            description="Use Save version inside a studio to snapshot vocal lanes, mixer settings and mastering targets."
          />
        ) : (
          <ul className="space-y-2">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 p-2.5"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-softwhite">
                    {version.label}
                    <span className="ml-2 text-[9px] font-normal uppercase tracking-wider text-muted">
                      {STUDIO_META[version.studio]?.short ?? version.studio}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted">
                    {new Date(version.createdAt).toLocaleString()} · {version.tracks.length} tracks
                  </div>
                  {version.note ? <div className="mt-0.5 text-[10px] text-muted/80">{version.note}</div> : null}
                </div>
                <button
                  className="rounded-lg border border-violet/40 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet/10"
                  onClick={async () => {
                    try {
                      await api.restoreVersion(versionsOf!.id, version.id);
                      await refresh();
                      notify("success", "Version restored", "A pre-restore checkpoint was saved.");
                      setVersionsOf(null);
                    } catch (err) {
                      notify("error", "Restore failed", (err as Error).message);
                    }
                  }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
