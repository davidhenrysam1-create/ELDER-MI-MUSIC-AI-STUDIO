"use client";

/**
 * One published song.
 *
 * Rendering rules that matter:
 *  - the player uses `preload="none"`, so nothing is counted as a play until a
 *    listener actually presses play;
 *  - like and follow numbers come from the server response, never from a guess;
 *  - download is offered only when the creator allowed it, and links to sign-in
 *    rather than failing silently for a visitor without an account.
 */
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StatusPill, cn } from "@/components/ui/primitives";
import { ApiError, api, type ReleaseCard } from "@/lib/client/api";
import { formatCount } from "@/lib/format";

interface ReleaseRowProps {
  release: ReleaseCard;
  signedIn: boolean;
  /** Hide the creator line on that creator's own page. */
  hideCreator?: boolean;
  /** Called after a like/follow so a parent list can stay in sync. */
  onChanged?: (next: ReleaseCard) => void;
  /** Show owner-only tools (unpublish, visibility). */
  ownerTools?: React.ReactNode;
}

export function ReleaseRow({
  release,
  signedIn,
  hideCreator = false,
  onChanged,
  ownerTools,
}: ReleaseRowProps) {
  const [card, setCard] = useState<ReleaseCard>(release);
  const [busy, setBusy] = useState<null | "like" | "follow">(null);
  const [note, setNote] = useState<string | null>(null);

  const apply = (next: Partial<ReleaseCard>) => {
    const merged = { ...card, ...next };
    setCard(merged);
    onChanged?.(merged);
  };

  const like = async () => {
    if (!signedIn) {
      setNote("Sign in to like a song.");
      return;
    }
    setBusy("like");
    setNote(null);
    try {
      const result = await api.likeRelease(card.id);
      apply({ likedByViewer: result.liked, likeCount: result.likeCount });
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const follow = async () => {
    if (!signedIn) {
      setNote("Sign in to follow this creator.");
      return;
    }
    if (!card.creator.handle) {
      setNote("This creator has not set a public handle yet.");
      return;
    }
    setBusy("follow");
    setNote(null);
    try {
      const result = await api.followCreator(card.creator.handle);
      apply({ followingCreator: result.following });
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 transition-colors hover:border-white/20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-softwhite">{card.title}</h3>
            {card.visibility === "unlisted" ? (
              <StatusPill tone="warning" icon="eye">
                unlisted
              </StatusPill>
            ) : null}
            {card.isOwn ? <StatusPill tone="info">yours</StatusPill> : null}
          </div>

          {!hideCreator ? (
            <div className="mt-0.5 text-[10px] text-muted">
              by{" "}
              {card.creator.handle ? (
                <Link
                  href={`/u/${card.creator.handle}`}
                  className="text-cyan-200 hover:text-white hover:underline"
                >
                  {card.creator.name}
                </Link>
              ) : (
                <span className="text-softwhite/80">{card.creator.name}</span>
              )}{" "}
              · {card.genre} · {card.bpm} BPM · {card.musicalKey}
              {card.durationSec > 0 ? ` · ${formatDuration(card.durationSec)}` : ""}
            </div>
          ) : (
            <div className="mt-0.5 text-[10px] text-muted">
              {card.genre} · {card.bpm} BPM · {card.musicalKey}
              {card.durationSec > 0 ? ` · ${formatDuration(card.durationSec)}` : ""}
            </div>
          )}

          {card.description ? (
            <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted/85">
              {card.description}
            </p>
          ) : null}
        </div>

        {ownerTools}
      </div>

      {/* Native player: works on Android, iPhone and desktop with no extra JS,
          and only fetches audio when the listener presses play. */}
      <audio
        className="mt-2 w-full"
        controls
        preload="none"
        src={card.audioUrl}
        aria-label={`Play ${card.title}`}
      />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => void like()}
          disabled={busy === "like"}
          aria-pressed={card.likedByViewer}
          className={cn(
            "btn-ghost text-[10px]",
            card.likedByViewer && "border-rose-400/40 text-rose-200",
          )}
          title={signedIn ? "Like this song" : "Sign in to like"}
        >
          <Icon name="star" size={11} filled={card.likedByViewer} />
          {card.likedByViewer ? "Liked" : "Like"} · {formatCount(card.likeCount)}
        </button>

        {!card.isOwn ? (
          <button
            type="button"
            onClick={() => void follow()}
            disabled={busy === "follow"}
            aria-pressed={card.followingCreator}
            className="btn-ghost text-[10px]"
            title={signedIn ? "Follow this creator" : "Sign in to follow"}
          >
            <Icon name="user" size={11} />
            {card.followingCreator ? "Following" : "Follow"}
          </button>
        ) : null}

        {card.allowDownload ? (
          signedIn ? (
            <a className="btn-ghost text-[10px]" href={api.downloadUrl(card.id)} download>
              <Icon name="download" size={11} /> Download · {formatCount(card.downloads)}
            </a>
          ) : (
            <Link
              className="btn-ghost text-[10px]"
              href={`/login?next=${encodeURIComponent(`/u/${card.creator.handle ?? ""}`)}`}
            >
              <Icon name="lock" size={11} /> Sign in to download
            </Link>
          )
        ) : (
          <span className="flex items-center gap-1 px-1 text-[9px] text-muted/60">
            <Icon name="lock" size={9} /> listen only
          </span>
        )}

        <span className="ml-auto flex items-center gap-2 text-[9px] text-muted/60">
          <span className="flex items-center gap-0.5">
            <Icon name="headphones" size={10} /> {formatCount(card.plays)}
          </span>
          <span className="flex items-center gap-0.5">
            <Icon name="download" size={10} /> {formatCount(card.downloads)}
          </span>
          <span className="flex items-center gap-0.5">
            <Icon name="star" size={10} /> {formatCount(card.likeCount)}
          </span>
        </span>
      </div>

      {note ? (
        <p className="mt-1 text-[9px] leading-relaxed text-amber-200/85">{note}</p>
      ) : null}
    </div>
  );
}

/** `m:ss` / `h:mm:ss` for a duration in seconds. */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
