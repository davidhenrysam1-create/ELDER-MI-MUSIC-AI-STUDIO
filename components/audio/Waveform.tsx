"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Canvas waveform. Draws the real extracted peak envelope; the played portion
 * is highlighted. Click / drag seeks.
 */
export function Waveform({
  peaks,
  progress = 0,
  height = 64,
  onSeek,
  colors = ["#a855f7", "#22d3ee"],
  dim = false,
  bars = true,
  className,
  ariaLabel = "Audio waveform",
}: {
  peaks: number[];
  progress?: number;
  height?: number;
  onSeek?: (ratio: number) => void;
  colors?: [string, string] | string[];
  dim?: boolean;
  bars?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = wrap.clientWidth;
    const h = height;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, h);

    const data = peaks.length ? peaks : new Array(200).fill(0.08);
    const mid = h / 2;
    const barWidth = Math.max(1.4, width / data.length - 1);
    const gap = Math.max(0.6, barWidth * 0.35);
    const playedX = progress * width;

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1] ?? colors[0]);
    const dimGrad = ctx.createLinearGradient(0, 0, width, 0);
    dimGrad.addColorStop(0, "rgba(255,255,255,0.16)");
    dimGrad.addColorStop(1, "rgba(255,255,255,0.10)");

    data.forEach((value, i) => {
      const x = (i / data.length) * width;
      const amplitude = Math.max(0.03, Math.min(1, value)) * (h * 0.44);
      const played = x <= playedX;
      ctx.fillStyle = played ? grad : dim ? dimGrad : "rgba(255,255,255,0.22)";
      if (bars) {
        const barH = Math.max(2, amplitude * 2);
        const y = mid - barH / 2;
        ctx.beginPath();
        const r = Math.min(barWidth / 2, 2);
        ctx.roundRect(x, y, barWidth - gap * 0.2, barH, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, mid - amplitude, Math.max(1, barWidth - gap * 0.2), amplitude * 2);
      }
    });

    if (progress > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(playedX, 2, 1.4, h - 4);
    }
  }, [peaks, progress, height, colors, dim, bars]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  const seekFromEvent = (clientX: number) => {
    const wrap = wrapRef.current;
    if (!wrap || !onSeek) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio);
  };

  return (
    <div
      ref={wrapRef}
      className={`relative w-full ${onSeek ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{ height, touchAction: onSeek ? "none" : undefined }}
      role={onSeek ? "slider" : "img"}
      aria-label={ariaLabel}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      tabIndex={onSeek ? 0 : -1}
      onKeyDown={(e) => {
        if (!onSeek) return;
        if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.02));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.02));
      }}
      onPointerDown={(e) => {
        if (!onSeek) return;
        draggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        seekFromEvent(e.clientX);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) seekFromEvent(e.clientX);
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
