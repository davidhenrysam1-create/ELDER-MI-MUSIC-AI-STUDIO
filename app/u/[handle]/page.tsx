"use client";

/**
 * `/u/<handle>` — a creator's public page.
 *
 * Works without signing in: name, roles, bio, the AudioMack / Instagram /
 * Facebook links the creator chose to publish, their follower counts and every
 * song they have released. Email addresses are never part of this payload.
 *
 * A visitor can listen immediately. Liking, following and downloading need an
 * account, and the buttons say so instead of failing quietly.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill, cn } from "@/components/ui/primitives";
import { ReleaseRow } from "@/components/social/ReleaseRow";
import { api, type CreatorPageData } from "@/lib/client/api";
import { PLATFORM_LABEL, describeRoles } from "@/lib/roles";
import { formatCount } from "@/lib/format";
import type { ProfileLinks } from "@/lib/types";

const PLATFORM_ICON: Record<keyof ProfileLinks, IconName> = {
  audiomack: "music",
  instagram: "star",
  facebook: "user",
};

export default function PublicProfilePage() {
  const params = useParams<{ handle: string }>();
  const handle = decodeURIComponent(String(params?.handle ?? ""));

  const [data, setData] = useState<CreatorPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.creatorPage(handle);
      setData(result);
      setFollowing(result.followingViewer);
      setFollowers(result.followers);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  const follow = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await api.followCreator(handle);
      setFollowing(result.following);
      setFollowers(result.followers);
    } catch (err) {
      // 401 means "no account yet" — say that instead of showing a raw error.
      setNote(
        /sign in/i.test((err as Error).message)
          ? "Create an account or sign in to follow this creator."
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const links = (Object.keys(PLATFORM_LABEL) as (keyof ProfileLinks)[]).filter((key) =>
    /^https?:\/\//i.test(data?.profile.links?.[key] ?? ""),
  );

  const replace = (next: CreatorPageData["releases"][number]) =>
    setData((current) =>
      current
        ? {
            ...current,
            releases: current.releases.map((entry) => (entry.id === next.id ? next : entry)),
          }
        : current,
    );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-[11px] text-muted hover:text-softwhite">
          ← Elder Mi Music AI Studio
        </Link>
        <button type="button" className="btn-ghost text-[11px]" onClick={() => void copyLink()}>
          <Icon name={copied ? "check" : "link"} size={11} /> {copied ? "Link copied" : "Copy link"}
        </button>
      </div>

      {error ? (
        <GlassCard>
          <div className="flex items-center gap-2">
            <Icon name="alert" size={14} className="text-amber-300" />
            <h1 className="text-sm font-semibold text-softwhite">Profile not found</h1>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{error}</p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
            Handles are created when a creator sets one on their account, and suspended accounts are
            hidden from public view.
          </p>
          <Link href="/login" className="btn-ghost mt-3 text-[11px]">
            <Icon name="user" size={11} /> Sign in
          </Link>
        </GlassCard>
      ) : !data ? (
        <GlassCard>
          <p className="text-[11px] text-muted">Loading profile…</p>
        </GlassCard>
      ) : (
        <>
          <GlassCard>
            <div className="flex items-start gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet/70 via-magenta/60 to-cyan/60 text-lg font-bold text-white shadow-glow">
                {data.profile.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-display font-bold tracking-tight">
                  <GradientText>{data.profile.name}</GradientText>
                </h1>
                <div className="mono text-[11px] text-muted">/u/{data.profile.handle}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusPill tone="info" icon="user">
                    {describeRoles(data.profile.roles)}
                  </StatusPill>
                  {data.profile.isAdmin ? (
                    <StatusPill tone="warning" icon="lock">
                      studio admin
                    </StatusPill>
                  ) : null}
                  <span className="text-[9px] text-muted/60">
                    joined {new Date(data.profile.joinedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                  <span>
                    <span className="font-semibold text-softwhite">{formatCount(followers)}</span>{" "}
                    followers
                  </span>
                  <span>
                    <span className="font-semibold text-softwhite">{formatCount(data.following)}</span>{" "}
                    following
                  </span>
                  <span>
                    <span className="font-semibold text-softwhite">
                      {data.releases.length}
                    </span>{" "}
                    song{data.releases.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void follow()}
                    disabled={busy}
                    aria-pressed={following}
                    className={cn("btn-ghost ml-1 text-[10px]", following && "border-emerald-400/40 text-emerald-200")}
                  >
                    <Icon name="user" size={10} />
                    {following ? "Following" : "Follow"}
                  </button>
                </div>
                {note ? (
                  <p className="mt-1 text-[9px] leading-relaxed text-amber-200/85">{note}</p>
                ) : null}
              </div>
            </div>

            {data.profile.bio ? (
              <p className="mt-3 whitespace-pre-line text-[11px] leading-relaxed text-softwhite/85">
                {data.profile.bio}
              </p>
            ) : (
              <p className="mt-3 text-[11px] italic text-muted/70">No bio yet.</p>
            )}

            {links.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {links.map((key) => (
                  <a
                    key={key}
                    href={data.profile.links[key]}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="btn-ghost text-[11px]"
                  >
                    <Icon name={PLATFORM_ICON[key]} size={11} /> {PLATFORM_LABEL[key]}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[10px] text-muted/70">
                This creator has not added AudioMack, Instagram or Facebook links yet.
              </p>
            )}
          </GlassCard>

          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-softwhite">Released songs</h2>
              <span className="text-[9px] text-muted/60">
                plays and downloads are real counts
              </span>
            </div>

            {data.releases.length === 0 ? (
              <GlassCard>
                <p className="text-[11px] leading-relaxed text-muted">
                  Nothing published yet. When {data.profile.name} releases a song it appears here with
                  a player — follow to see it in your feed.
                </p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {data.releases.map((release) => (
                  <ReleaseRow
                    key={release.id}
                    release={release}
                    signedIn={data.signedIn}
                    hideCreator
                    onChanged={replace}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="mt-3 px-1 text-[9px] leading-relaxed text-muted/60">
            This page is public. Only the songs a creator published appear here; their projects, mixer
            settings and unpublished audio never do. Your Sound. Your Culture. Your Studio.
          </p>
        </>
      )}
    </div>
  );
}
