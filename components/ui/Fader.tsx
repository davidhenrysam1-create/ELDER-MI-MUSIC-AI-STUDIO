"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/components/ui/primitives";

/** Vertical DAW-style fader with pointer drag + full keyboard support. */
export function Fader({
  value,
  min,
  max,
  step = 0.5,
  onChange,
  label,
  format,
  height = 120,
  muted,
  tone = "violet",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
  height?: number;
  muted?: boolean;
  tone?: "violet" | "cyan" | "gold";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const filled = tone === "cyan" ? "from-cyan to-sky-400" : tone === "gold" ? "from-gold to-orange" : "from-violet to-magenta";

  const commit = useCallback(
    (clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const r = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const raw = min + r * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, Number(snapped.toFixed(2)))));
    },
    [min, max, step, onChange],
  );

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format ? format(value) : String(value)}
        aria-orientation="vertical"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          commit(e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) commit(e.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(Math.min(max, Number((value + step).toFixed(2))));
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(Math.max(min, Number((value - step).toFixed(2))));
          }
          if (e.key === "Home") onChange(min);
          if (e.key === "End") onChange(max);
        }}
        className={cn(
          "relative w-8 cursor-ns-resize touch-none select-none rounded-md border border-white/10 bg-black/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet/70",
          muted && "opacity-45",
        )}
        style={{ height }}
      >
        <div className="absolute inset-x-1 inset-y-1 overflow-hidden rounded">
          <div className="absolute left-1/2 top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-white/10" />
          <div
            className={cn("absolute bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-gradient-to-t", filled)}
            style={{ height: `${ratio * 100}%` }}
          />
          {[0.25, 0.5, 0.75].map((tick) => (
            <div
              key={tick}
              className="absolute left-1/2 h-px w-4 -translate-x-1/2 bg-white/15"
              style={{ bottom: `${tick * 100}%` }}
            />
          ))}
        </div>
        <div
          className="absolute left-1/2 h-3 w-6 -translate-x-1/2 rounded-sm border border-white/40 bg-gradient-to-b from-softwhite to-white/70 shadow"
          style={{ bottom: `calc(${ratio * 100}% - 6px)` }}
        />
      </div>
      <span className="mono text-[9px] text-muted">{format ? format(value) : value}</span>
    </div>
  );
}
