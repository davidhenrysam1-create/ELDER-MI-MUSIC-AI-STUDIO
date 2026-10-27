"use client";

/**
 * `/publish` — put a finished song on the public side of the studio.
 *
 * Pick a project, pick one audio file from it, give it a title, and decide:
 *  - **Public** (in Discover) or **unlisted** (only on your page, for a song that
 *    is finished but not announced);
 *  - whether listeners may **download** it;
 *
 * Publishing needs a public handle first, because every song links back to a
 * creator page. Re-publishing the same project updates the same release instead
 * of creating duplicates.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  ConfirmButton,
  GlassCard,
  GradientText,
  SectionHeading,
  StatusPill,
  cn,
} from "@/components/ui/primitives";
import { ReleaseRow } from "@/components/social/ReleaseRow";
import { useStudio } from "@/lib/client/studio";
import { ApiError, api, type ReleaseCard } from "@/lib/client/api";
import { formatBytes } from "@/lib/format";
import { canPublish } from "@/lib/roles";

export default function PublishPage() {
  const { projects, user, notify } = useStudio();

  const [projectId, setProjectId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [allowDownload, setAllowDownload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mine, setMine] = useState<ReleaseCard[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMine = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.releases({ scope: "mine" });
      setMine(result.releases);
    } catch {
      /* The page still works for publishing; the list simply stays empty. */
      setMine([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  const project = projects.find((entry) => entry.id === projectId) ?? null;
  const assets = project?.assets ?? [];
  const chosen = assets.find((entry) => entry.id === assetId) ?? null;
  const allowed = canPublish(user?.roles ?? [], user?.isAdmin === true);
  const hasHandle = Boolean(user?.handle);

  // Default the title to the project name and the file to the newest audio.
  useEffect(() => {
    if (!project) return;
    if (!title.trim()) setTitle(project.name);
    if (!assetId && project.assets.length > 0) {
      setAssetId(project.assets[project.assets.length - 1].id);
    }
  }, [project, title, assetId]);

  const publish = async () => {
    if (!project || !chosen) {
      setError("Choose a project and one of its audio files.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.publishRelease({
        projectId: project.id,
        assetId: chosen.id,
        title,
        description,
        visibility,
        allowDownload,
      });
      await loadMine();
      notify(
        "success",
        "Published",
        visibility === "public"
          ? `“${result.release.title}” is now in Discover.`
          : `“${result.release.title}” is unlisted — reachable from your page only.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = async (id: string, patch: Parameters<typeof api.updateRelease>[1]) => {
    try {
      const result = await api.updateRelease(id, patch);
      setMine((current) => current.map((entry) => (entry.id === id ? result.release : entry)));
    } catch (err) {
      notify("error", "Could not update the release", (err as Error).message);
    }
  };

  const unpublish = async (id: string) => {
    try {
      await api.unpublishRelease(id);
      setMine((current) => current.filter((entry) => entry.id !== id));
      notify("success", "Unpublished", "The song is off the public site; the project is untouched.");
    } catch (err) {
      notify("error", "Could not unpublish", (err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Put your music out"
        title={<GradientText>Publish a song</GradientText>}
        description="A release is a finished file from one of your projects, offered to listeners with a player. The mix, mastering chain and stems behind it stay private."
        action={
          <Link href="/discover" className="btn-ghost text-xs">
            <Icon name="music" size={12} /> Discover
          </Link>
        }
      />

      {!allowed ? (
        <GlassCard>
          <div className="flex items-start gap-2">
            <Icon name="lock" size={15} className="mt-0.5 shrink-0 text-amber-300" />
            <div>
              <h3 className="text-sm font-semibold text-softwhite">Publishing is not on your dashboard</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Artists, producers and promoters publish; engineers get the studio tools instead. If
                that does not match what you do, change your roles — or ask the studio admin.
              </p>
              <Link href="/account" className="btn-primary mt-2 text-[11px]">
                <Icon name="user" size={11} /> Change my roles
              </Link>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {allowed && !hasHandle ? (
        <GlassCard>
          <div className="flex items-start gap-2">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-amber-300" />
            <div>
              <h3 className="text-sm font-semibold text-softwhite">Add a public handle first</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Every published song links to a creator page, so publishing needs a handle (for
                example <span className="mono">/u/eldermi</span>). It takes a few seconds in My
                account.
              </p>
              <Link href="/account" className="btn-primary mt-2 text-[11px]">
                <Icon name="user" size={11} /> Set my handle
              </Link>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {allowed && hasHandle ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <GlassCard accent="vocal">
            <SectionHeading eyebrow="Step 1" title="Pick the file" description="Only audio already inside one of your projects can be published." />

            <div className="space-y-2">
              <div>
                <label className="label mb-1 block" htmlFor="publish-project">
                  Project
                </label>
                <select
                  id="publish-project"
                  className="field text-xs"
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setAssetId("");
                    setTitle("");
                  }}
                >
                  <option value="">Choose a project…</option>
                  {projects.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {entry.assets.length} file{entry.assets.length === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </div>

              {project ? (
                assets.length === 0 ? (
                  <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100/85">
                    This project has no audio yet. Upload a file (or render a master) in the studio
                    first, then come back.
                  </p>
                ) : (
                  <div>
                    <div className="label mb-1">Audio file</div>
                    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                      {assets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => setAssetId(asset.id)}
                          aria-pressed={assetId === asset.id}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left text-[10px]",
                            assetId === asset.id
                              ? "border-violet/50 bg-violet/[0.14] text-softwhite"
                              : "border-white/10 bg-black/25 text-muted hover:text-softwhite",
                          )}
                        >
                          <span className="min-w-0 truncate">
                            {asset.kind === "master" ? "★ " : ""}
                            {asset.name}
                          </span>
                          <span className="shrink-0 text-[9px] text-muted/70">
                            {formatBytes(asset.sizeBytes)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ) : null}

              {chosen ? (
                <audio className="w-full" controls preload="none" src={`/api/assets/${chosen.id}/audio?projectId=${project?.id ?? ""}`} />
              ) : null}
            </div>
          </GlassCard>

          <GlassCard accent="mix">
            <SectionHeading eyebrow="Step 2" title="How it is listed" description="You can change all of this later without touching the project." />

            <div className="space-y-2.5">
              <div>
                <label className="label mb-1 block" htmlFor="publish-title">
                  Song title
                </label>
                <input
                  id="publish-title"
                  className="field text-xs"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  placeholder="Name listeners will see"
                />
              </div>

              <div>
                <label className="label mb-1 block" htmlFor="publish-description">
                  Notes (optional)
                </label>
                <textarea
                  id="publish-description"
                  className="field min-h-[56px] text-xs"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={400}
                  placeholder="Who played on it, where it was recorded, what it is about."
                />
              </div>

              <div className="grid gap-1.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  aria-pressed={visibility === "public"}
                  className={cn(
                    "rounded-xl border p-2 text-left",
                    visibility === "public"
                      ? "border-violet/50 bg-violet/[0.12]"
                      : "border-white/10 bg-black/20",
                  )}
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-softwhite">
                    <Icon name="music" size={10} /> Public
                  </div>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
                    Appears in Discover and on your page.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("unlisted")}
                  aria-pressed={visibility === "unlisted"}
                  className={cn(
                    "rounded-xl border p-2 text-left",
                    visibility === "unlisted"
                      ? "border-violet/50 bg-violet/[0.12]"
                      : "border-white/10 bg-black/20",
                  )}
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-softwhite">
                    <Icon name="eye" size={10} /> Unlisted
                  </div>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
                    Only on your page — for a song not announced yet.
                  </p>
                </button>
              </div>

              <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={allowDownload}
                  onChange={(event) => setAllowDownload(event.target.checked)}
                />
                <span className="text-[10px] leading-relaxed text-muted">
                  <span className="font-semibold text-softwhite">Allow downloads.</span> Listeners
                  with an account can save the file; every download is counted. Leave it off to keep
                  the song listen-only.
                </span>
              </label>

              {error ? (
                <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-rose-100">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                className="btn-primary w-full text-xs"
                onClick={() => void publish()}
                disabled={busy || !project || !chosen || title.trim().length < 2}
              >
                <Icon name="upload" size={12} />
                {busy ? "Publishing…" : "Publish"}
              </button>
              <p className="text-[9px] leading-relaxed text-muted/60">
                Re-publishing a project updates its existing release instead of adding a duplicate.
              </p>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {/* My releases */}
      <GlassCard>
        <SectionHeading
          eyebrow="What you have out"
          title="My releases"
          description="Edit the listing, switch downloads on or off, or take a song down. Taking it down never deletes the project."
          action={
            <StatusPill tone="info" icon="music">
              {mine.length} published
            </StatusPill>
          }
        />

        {loading ? (
          <p className="text-[11px] text-muted">Loading your releases…</p>
        ) : mine.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-muted">
            Nothing published yet. Choose a project above and give it a title — it appears in Discover
            and on your public page as soon as you press Publish.
          </p>
        ) : (
          <div className="space-y-2">
            {mine.map((release) => (
              <ReleaseRow
                key={release.id}
                release={release}
                signedIn
                ownerTools={
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      className="btn-ghost text-[10px]"
                      onClick={() =>
                        void update(release.id, {
                          visibility: release.visibility === "public" ? "unlisted" : "public",
                        })
                      }
                    >
                      <Icon name="eye" size={10} />
                      {release.visibility === "public" ? "Make unlisted" : "Make public"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-[10px]"
                      onClick={() => void update(release.id, { allowDownload: !release.allowDownload })}
                    >
                      <Icon name="download" size={10} />
                      {release.allowDownload ? "Stop downloads" : "Allow downloads"}
                    </button>
                    <ConfirmButton
                      label="Unpublish"
                      confirmLabel="Yes, take it down"
                      title={`Unpublish “${release.title}”?`}
                      description="It disappears from Discover and your public page. The project, the audio and every other version stay exactly where they are."
                      danger
                      icon="trash"
                      onConfirm={() => void unpublish(release.id)}
                    />
                  </div>
                }
              />
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
