"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/components/ui/primitives";
import { Waveform } from "@/components/audio/Waveform";
import { useStudio } from "@/lib/client/studio";
import { assetAudioUrl } from "@/lib/client/api";
import { formatDb, formatTime } from "@/lib/format";

export function GlobalPlayer() {
  const {
    player,
    project,
    togglePlayback,
    seek,
    setVolume,
    setLoop,
    stopPlayback,
    setPlayerGainDb,
  } = useStudio();

  const asset = project?.assets.find((a) => a.id === player.assetId);
  const peaks = asset?.peaks ?? [];
  const progress = player.duration > 0 ? player.currentTime / player.duration : 0;
  const active = Boolean(player.assetId);
  const gainActive = Math.abs(player.gainDb) > 0.05;

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-2 sm:px-4">
      <div className="player-shell glass-strong mx-auto flex w-full max-w-[1400px] flex-col gap-2 rounded-xl px-3 py-2.5 3xl:max-w-[1680px]">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={!active}
            aria-label={player.playing ? "Pause" : "Play"}
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-all disabled:opacity-35",
              "bg-gradient-to-br from-violet via-magenta to-cyan shadow-glow hover:scale-105",
            )}
          >
            <Icon name={player.playing ? "pause" : "play"} size={17} filled={!player.playing} />
          </button>
          <button
            type="button"
            onClick={stopPlayback}
            disabled={!active}
            aria-label="Stop"
            className="hidden h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-muted transition-colors hover:text-white disabled:opacity-30 sm:grid"
          >
            <Icon name="stop" size={12} filled />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-semibold text-softwhite">
                  {active ? player.name : "No audio loaded"}
                </span>
                {asset ? (
                  <span className="chip hidden shrink-0 py-0.5 text-[9px] uppercase sm:inline-flex">
                    {asset.kind}
                  </span>
                ) : null}
                {gainActive ? (
                  <span className="hidden shrink-0 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold text-cyan-200 md:inline">
                    A/B {formatDb(player.gainDb, 1)}
                  </span>
                ) : null}
              </div>
              <span className="mono shrink-0 text-[10px] text-muted">
                {formatTime(player.currentTime)} / {formatTime(player.duration)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {active && peaks.length ? (
                  <Waveform
                    peaks={peaks}
                    progress={progress}
                    height={22}
                    bars={false}
                    colors={["#a855f7", "#22d3ee"]}
                    onSeek={(ratio) => seek(ratio * (player.duration || 0))}
                    ariaLabel={`Seek within ${player.name}`}
                  />
                ) : (
                  <div className="h-[22px] rounded bg-white/[0.04]" aria-hidden />
                )}
              </div>
              <label className="hidden items-center gap-1.5 lg:flex">
                <Icon name="headphones" size={12} className="text-muted" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={player.volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Monitor volume"
                  className="w-20"
                />
              </label>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {gainActive ? (
              <button
                type="button"
                onClick={() => setPlayerGainDb(0)}
                className="hidden rounded-md border border-white/10 px-1.5 py-1 text-[9px] text-muted hover:text-white lg:block"
                aria-label="Reset comparison gain"
              >
                reset A/B
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setLoop(!player.loop)}
              aria-pressed={player.loop}
              aria-label="Loop playback"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg border transition-colors",
                player.loop
                  ? "border-cyan/40 bg-cyan/15 text-cyan-200"
                  : "border-white/10 text-muted hover:text-white",
              )}
            >
              <Icon name="repeat" size={14} />
            </button>
            {asset && project ? (
              <a
                href={assetAudioUrl(project.id, asset.id, true)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-muted transition-colors hover:text-white"
                aria-label={`Download ${player.name}`}
                download
              >
                <Icon name="download" size={14} />
              </a>
            ) : null}
          </div>
        </div>
        <div className="player-meta hidden items-center justify-between px-1 text-[9px] uppercase tracking-[0.16em] text-muted/60 sm:flex">
          <span>Elder Mi Music AI Studio · Web Audio engine</span>
          <span className="mono">
            {(project?.assets.find((a) => a.id === player.assetId)?.sampleRate ?? 48000) / 1000} kHz ·{" "}
            {project?.assets.find((a) => a.id === player.assetId)?.channels ?? 2} ch
          </span>
        </div>
      </div>
    </div>
  );
}
