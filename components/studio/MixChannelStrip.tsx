"use client";

import { Icon } from "@/components/ui/Icon";
import { Tooltip, cn } from "@/components/ui/primitives";
import { Fader } from "@/components/ui/Fader";
import type { AssetMeta, Track } from "@/lib/types";
import { STEM_ROLE_LABEL } from "@/lib/types";
import { formatDb } from "@/lib/format";

export function MixChannelStrip({
  track,
  asset,
  selected,
  playing,
  groupLabel,
  groupColour,
  onSelect,
  onPlay,
  onUpdate,
}: {
  track: Track;
  asset: AssetMeta | null;
  selected: boolean;
  playing: boolean;
  groupLabel: string;
  groupColour: string;
  onSelect: () => void;
  onPlay: () => void;
  onUpdate: (patch: Partial<Track>) => void;
}) {
  const peak = asset?.peaks?.length ? Math.max(...asset.peaks) : 0;
  const level = Math.min(1, peak);

  return (
    <div
      className={cn(
        "relative flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-xl border p-2 transition-colors",
        selected
          ? "border-violet/50 bg-violet/[0.08]"
          : "border-white/10 bg-black/25 hover:border-white/20",
        track.muted && "opacity-70",
      )}
    >
      <button
        onClick={onSelect}
        className="w-full text-left"
        aria-pressed={selected}
        aria-label={`Select ${track.name} channel`}
      >
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: track.color }} />
          <span className="truncate text-[10px] font-semibold text-softwhite">{track.name}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-[9px] text-muted">
          <span
            className="shrink-0 rounded px-1 text-[8px] uppercase tracking-wide"
            style={{ background: `${groupColour}22`, color: groupColour }}
          >
            {groupLabel}
          </span>
          <span className="truncate">{STEM_ROLE_LABEL[track.role]}</span>
        </div>
      </button>

      <div className="flex items-end gap-2">
        <Fader
          value={track.volumeDb}
          min={-24}
          max={6}
          step={0.5}
          height={112}
          label={`${track.name} volume`}
          onChange={(v) => onUpdate({ volumeDb: v })}
          format={(v) => formatDb(v, 0)}
          muted={track.muted}
          tone={selected ? "violet" : "cyan"}
        />
        <div
          className="relative h-[112px] w-2 overflow-hidden rounded-full bg-black/50"
          title={`Stored peak envelope: ${(level * 100).toFixed(0)}%`}
          aria-hidden
        >
          <div className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-emerald-400/70 via-gold/60 to-rose-400/70"
            style={{ height: `${level * 100}%` }} />
        </div>
      </div>

      <div className="flex w-full items-center gap-1">
        <Tooltip label={track.muted ? "Unmute channel" : "Mute channel"}>
          <button
            onClick={() => onUpdate({ muted: !track.muted })}
            aria-pressed={track.muted}
            aria-label={`Mute ${track.name}`}
            className={cn(
              "grid h-5 flex-1 place-items-center rounded text-[9px] font-bold transition-colors",
              track.muted ? "bg-rose-500/30 text-rose-100" : "bg-white/10 text-muted hover:text-white",
            )}
          >
            M
          </button>
        </Tooltip>
        <Tooltip label={track.soloed ? "Unsolo channel" : "Solo channel"}>
          <button
            onClick={() => onUpdate({ soloed: !track.soloed })}
            aria-pressed={track.soloed}
            aria-label={`Solo ${track.name}`}
            className={cn(
              "grid h-5 flex-1 place-items-center rounded text-[9px] font-bold transition-colors",
              track.soloed ? "bg-gold/30 text-gold" : "bg-white/10 text-muted hover:text-white",
            )}
          >
            S
          </button>
        </Tooltip>
        <Tooltip label={playing ? "Pause this channel" : "Preview this channel"}>
          <button
            onClick={onPlay}
            aria-label={`Preview ${track.name}`}
            className="grid h-5 w-6 place-items-center rounded bg-white/10 text-muted hover:text-white"
          >
            <Icon name={playing ? "pause" : "play"} size={9} filled />
          </button>
        </Tooltip>
      </div>

      <div className="flex w-full items-center justify-between text-[8px] text-muted">
        <span className="mono">{track.pan === 0 ? "C" : track.pan < 0 ? `L${Math.round(-track.pan * 50)}` : `R${Math.round(track.pan * 50)}`}</span>
        <span className="mono">{track.compRatio.toFixed(1)}:1</span>
      </div>
    </div>
  );
}
