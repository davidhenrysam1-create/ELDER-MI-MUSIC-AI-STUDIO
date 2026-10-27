"use client";

/**
 * `/u/<handle>` — a creator's public page.
 *
 * Works without signing in: name, roles, bio and the AudioMack / Instagram /
 * Facebook links the creator chose to publish. Contact details are never shown.
 *
 * Published songs and follower counts are **planned**, not shipped: the page says
 * so instead of showing an empty shelf that looks broken. Share links are still
 * the way to let somebody hear a finished song today.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { PLATFORM_LABEL, describeRoles } from "@/lib/roles";
import type { AccountRole, ProfileLinks } from "@/lib/types";

interface PublicProfilePayload {
  profile: {
    id: string;
    name: string;
    handle: string;
    bio: string;
    roles: AccountRole[];
    links: ProfileLinks;
    isAdmin: boolean;
    joinedAt: string;
  };
  published: unknown[];
  publishingAvailable: boolean;
  note: string;
}

const PLATFORM_ICON: Record<keyof ProfileLinks, IconName> = {
  audiomack: "music",
  instagram: "star",
  facebook: "user",
};

export default function PublicProfilePage() {
  const params = useParams<{ handle: string }>();
  const handle = decodeURIComponent(String(params?.handle ?? ""));
  const [data, setData] = useState<PublicProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/profile/${encodeURIComponent(handle)}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "This profile could not be loaded.");
      setData(body as PublicProfilePayload);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const links = (Object.keys(PLATFORM_LABEL) as (keyof ProfileLinks)[]).filter(
    (key) => /^https?:\/\//i.test(data?.profile.links?.[key] ?? ""),
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-5 flex items-center justify-between">
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
            Handles are only created when a creator sets one on their account, and suspended accounts
            are hidden from public view.
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

          <GlassCard className="mt-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-softwhite">Published music</h2>
              <StatusPill tone="warning">planned</StatusPill>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{data.note}</p>
            <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
              Today a finished song travels as a{" "}
              <span className="text-softwhite/80">share link</span>: the creator picks listen-only or
              download, adds an optional passcode and expiry, and sends it directly. Follow, like and
              download counters arrive with the publishing phase — they are not faked here.
            </p>
          </GlassCard>
        </>
      )}
    </div>
  );
}
