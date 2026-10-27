"use client";

/**
 * `/discover` — every song published on this studio.
 *
 * Three views: **All songs** (public releases from every account), **Following**
 * (only the creators you follow, plus your own) and **My releases** (including
 * songs you have not announced yet).
 *
 * The counters under each song are the real ones from the database. If nothing
 * has been published, the page says so instead of showing sample tracks.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, SectionHeading, StatusPill, cn } from "@/components/ui/primitives";
import { ReleaseRow } from "@/components/social/ReleaseRow";
import { useStudio } from "@/lib/client/studio";
import { ApiError, api, type ReleaseCard } from "@/lib/client/api";
import { GENRES } from "@/lib/types";

type Scope = "all" | "following" | "mine";

const SCOPES: { id: Scope; label: string; icon: "music" | "user" | "library" }[] = [
  { id: "all", label: "All songs", icon: "music" },
  { id: "following", label: "Following", icon: "user" },
  { id: "mine", label: "My releases", icon: "library" },
];

export default function DiscoverPage() {
  const { user } = useStudio();
  const [scope, setScope] = useState<Scope>("all");
  const [genre, setGenre] = useState("");
  const [query, setQuery] = useState("");
  const [releases, setReleases] = useState<ReleaseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.releases({
        scope,
        genre: genre || undefined,
        q: query.trim() || undefined,
      });
      setReleases(result.releases);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [scope, genre, query]);

  // Debounce typing so a search does not fire on every keypress.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const replace = (next: ReleaseCard) =>
    setReleases((current) => current.map((entry) => (entry.id === next.id ? next : entry)));

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Published on this studio"
        title={<GradientText>Discover</GradientText>}
        description="Songs other creators have published. Listen without downloading anything, like what you rate, and follow the people whose sound you want more of."
        action={
          <Link href="/publish" className="btn-primary text-xs">
            <Icon name="upload" size={12} /> Publish a song
          </Link>
        }
      />

      {/* Views */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SCOPES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setScope(entry.id)}
            aria-pressed={scope === entry.id}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] transition-colors",
              scope === entry.id
                ? "border-violet/50 bg-violet/[0.14] text-softwhite"
                : "border-white/10 bg-black/25 text-muted hover:text-softwhite",
            )}
          >
            <Icon name={entry.icon} size={11} /> {entry.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted/70">
          {loading ? "Loading…" : `${releases.length} ${releases.length === 1 ? "song" : "songs"}`}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          className="field min-w-[180px] flex-1 text-xs"
          placeholder="Search titles, creators or genres…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search published songs"
        />
        <select
          className="field w-auto text-xs"
          value={genre}
          onChange={(event) => setGenre(event.target.value)}
          aria-label="Filter by genre"
        >
          <option value="">All genres</option>
          {GENRES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <GlassCard>
          <p className="text-[11px] leading-relaxed text-rose-200">{error}</p>
          {scope === "following" ? (
            <p className="mt-1 text-[10px] text-muted">
              Following needs a signed-in account.{" "}
              <Link href="/login" className="underline hover:text-white">
                Sign in
              </Link>
              .
            </p>
          ) : null}
        </GlassCard>
      ) : null}

      {!loading && releases.length === 0 && !error ? (
        <GlassCard>
          <div className="flex items-start gap-2">
            <Icon name="music" size={16} className="mt-0.5 shrink-0 text-violet-300" />
            <div>
              <h3 className="text-sm font-semibold text-softwhite">
                {scope === "mine"
                  ? "You have not published anything yet"
                  : scope === "following"
                    ? "Nothing from the creators you follow yet"
                    : "No songs published on this studio yet"}
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {scope === "mine"
                  ? "Pick a finished file from one of your projects and publish it — it appears here and on your public page, with a player, a like button and an optional download."
                  : scope === "following"
                    ? "Follow a creator from Discover or from their profile page, and their songs appear here."
                    : "Be the first: publish a finished song and it shows up here for everyone on the studio."}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link href="/publish" className="btn-primary text-[11px]">
                  <Icon name="upload" size={11} /> Publish a song
                </Link>
                {scope === "following" ? (
                  <button type="button" className="btn-ghost text-[11px]" onClick={() => setScope("all")}>
                    <Icon name="music" size={11} /> Browse all songs
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </GlassCard>
      ) : null}

      <div className="space-y-2">
        {releases.map((release) => (
          <ReleaseRow
            key={release.id}
            release={release}
            signedIn={Boolean(user)}
            onChanged={replace}
          />
        ))}
      </div>

      <GlassCard>
        <div className="flex items-start gap-2">
          <Icon name="info" size={13} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-[10px] leading-relaxed text-muted">
            A published song is a copy for listeners: the project behind it — mixer, mastering chain,
            stems and versions — stays private. Plays count when a listener presses play, not while
            seeking. Downloads need a signed-in account and the creator&apos;s permission.
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusPill tone="success" icon="check">
            publishing
          </StatusPill>
          <StatusPill tone="success" icon="check">
            likes &amp; follows
          </StatusPill>
          <StatusPill tone="warning">comments — planned</StatusPill>
          <StatusPill tone="warning">paid support — planned</StatusPill>
        </div>
      </GlassCard>
    </div>
  );
}
