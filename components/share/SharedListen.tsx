"use client";

/**
 * The player on a friend's shared listening page.
 *
 * Deliberately a plain `<audio>` element with our own controls: it works on
 * iOS Safari, Android Chrome and desktop without the studio's Web Audio graph,
 * and it streams with Range requests from `/api/share/[token]/audio/[assetId]`.
 *
 * Nothing here can reveal the owner's project: the token only authorises the
 * channel audio rendered on this page.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/components/ui/primitives";
import { formatTime } from "@/lib/format";

export interface SharedTrack {
  id: string;
  name: string;
  role: string;
  assetId: string;
  mimeType: string;
  durationSec: number;
  sizeBytes: number;
}

export function SharedListen({
  token,
  tracks,
  allowDownload,
}: {
  token: string;
  tracks: SharedTrack[];
  allowDownload: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useState(tracks[0]?.assetId ?? null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const active = tracks.find((track) => track.assetId === activeId) ?? null;
  const src = active ? `/api/share/${token}/audio/${active.assetId}` : "";

  // Reset transport state whenever a different channel is chosen.
  useEffect(() => {
    setCurrent(0);
    setDuration(active?.durationSec ?? 0);
    setError(null);
    const el = audioRef.current;
    if (el) {
      el.load();
      setPlaying(false);
    }
  }, [activeId, active?.durationSec]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      if (el.paused) {
        await el.play();
        setPlaying(true);
      } else {
        el.pause();
        setPlaying(false);
      }
    } catch {
      setError("Your browser blocked playback. Tap play again, or check the link has not expired.");
    }
  };

  const seek = (value: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = value;
    setCurrent(value);
  };

  if (tracks.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-center text-[11px] text-muted">
        This session has no audio on the mixer yet, so there is nothing to listen to.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setDuration(value);
        }}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() =>
          setError("This audio could not be loaded — the link may have expired or been revoked.")
        }
      />

      {/* Transport */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void toggle()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-magenta text-white shadow-glow"
            aria-label={playing ? "Pause" : "Play"}
          >
            <Icon name={playing ? "pause" : "play"} size={18} filled />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-softwhite">
              {active?.name ?? "Choose a channel"}
            </div>
            <div className="mono mt-0.5 text-[9px] text-muted">
              {formatTime(current)} / {formatTime(duration || active?.durationSec || 0)}
            </div>
          </div>
          {allowDownload && active ? (
            <a
              href={`/api/share/${token}/download/${active.assetId}`}
              className="rounded-lg border border-white/10 p-2 text-muted transition-colors hover:text-softwhite"
              aria-label={`Download ${active.name}`}
              download
            >
              <Icon name="download" size={15} />
            </a>
          ) : null}
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(1, duration || active?.durationSec || 1)}
          step={0.1}
          value={Math.min(current, duration || active?.durationSec || 1)}
          onChange={(event) => seek(Number(event.target.value))}
          className="mt-3 w-full accent-violet-400"
          aria-label="Seek"
        />

        {error ? (
          <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-100">
            {error}
          </p>
        ) : null}
      </div>

      {/* Channel list */}
      <ul className="space-y-1.5">
        {tracks.map((track) => {
          const isActive = track.assetId === activeId;
          return (
            <li key={track.id}>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
                  isActive
                    ? "border-violet/40 bg-violet/[0.08]"
                    : "border-white/10 bg-black/20 hover:border-white/20",
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(track.assetId)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <Icon
                    name={isActive && playing ? "waveform" : "music"}
                    size={13}
                    className={isActive ? "text-violet-300" : "text-muted"}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] text-softwhite">{track.name}</span>
                    <span className="block text-[9px] text-muted">
                      {track.role.replace(/_/g, " ")} · {formatTime(track.durationSec)}
                    </span>
                  </span>
                </button>
                {allowDownload ? (
                  <a
                    href={`/api/share/${token}/download/${track.assetId}`}
                    className="shrink-0 rounded-md p-1.5 text-muted hover:text-softwhite"
                    aria-label={`Download ${track.name}`}
                    download
                  >
                    <Icon name="download" size={13} />
                  </a>
                ) : (
                  <Icon name="lock" size={12} className="shrink-0 text-muted/50" />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!allowDownload ? (
        <p className="text-[9px] leading-relaxed text-muted/70">
          The producer shared this session for listening only, so downloads are switched off.
        </p>
      ) : null}
    </div>
  );
}
