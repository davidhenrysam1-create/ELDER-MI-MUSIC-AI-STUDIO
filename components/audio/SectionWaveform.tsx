"use client";

import { Waveform } from "@/components/audio/Waveform";

/** Source waveform with a draggable-free visual marker of the render section. */
export function SectionWaveform({
  peaks,
  durationSec,
  startSec,
  endSec,
  height = 64,
}: {
  peaks: number[];
  durationSec: number;
  startSec: number;
  endSec: number;
  height?: number;
}) {
  const safeDuration = Math.max(0.001, durationSec);
  const start = Math.max(0, Math.min(1, startSec / safeDuration));
  const end = Math.max(start + 0.002, Math.min(1, endSec / safeDuration));
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/30">
      <Waveform peaks={peaks} progress={end} height={height} bars colors={["#a855f7", "#22d3ee"]} />
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-y-0 border-x border-cyan/70 bg-cyan/10"
          style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}
        />
        <div className="absolute inset-y-0 w-px bg-cyan/80" style={{ left: `${end * 100}%` }} />
      </div>
      <div className="pointer-events-none absolute bottom-1 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-cyan-100">
        render section
      </div>
    </div>
  );
}
