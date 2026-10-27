"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { GradientText, StatusPill, cn } from "@/components/ui/primitives";

type StudioKey = "vocal" | "mix" | "mastering";

const VISUALS: Record<
  StudioKey,
  { bars: number[]; icon: IconName; accent: string; tint: string }
> = {
  vocal: {
    bars: [0.25, 0.55, 0.85, 0.45, 0.7, 0.95, 0.5, 0.3, 0.6, 0.9, 0.4, 0.2],
    icon: "mic",
    accent: "from-violet via-magenta to-cyan",
    tint: "rgba(168,85,247,0.16)",
  },
  mix: {
    bars: [0.7, 0.35, 0.9, 0.5, 0.8, 0.4, 0.95, 0.55, 0.75, 0.3, 0.85, 0.45],
    icon: "sliders",
    accent: "from-cyan via-sky-400 to-violet",
    tint: "rgba(34,211,238,0.14)",
  },
  mastering: {
    bars: [0.9, 0.75, 0.95, 0.6, 0.85, 0.7, 0.92, 0.55, 0.8, 0.65, 0.9, 0.5],
    icon: "disc",
    accent: "from-orange via-gold to-magenta",
    tint: "rgba(250,204,21,0.12)",
  },
};

export function StudioCard({
  studio,
  title,
  description,
  action,
  href,
  meta,
}: {
  studio: StudioKey;
  title: string;
  description: string;
  action: string;
  href: string;
  meta?: string;
}) {
  const visual = VISUALS[studio];
  const variant = studio === "vocal" ? "vocal" : studio === "mix" ? "mix" : "master";

  return (
    <Link
      href={href}
      className="glass glow-border group relative flex flex-col overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.055]"
      style={{ boxShadow: `0 24px 60px -40px ${visual.tint}` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(120% 90% at 0% 0%, ${visual.tint}, transparent 60%)`,
        }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn(
                "grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-gradient-to-br text-white",
                visual.accent,
              )}
            >
              <Icon name={visual.icon} size={17} />
            </span>
            <StatusPill tone="ready" icon="bolt">
              Engine ready
            </StatusPill>
          </div>
          <h3 className="font-display text-lg font-bold tracking-tight">
            <GradientText variant={variant}>{title}</GradientText>
          </h3>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">{description}</p>
        </div>
      </div>

      <div className="relative my-4 h-14 overflow-hidden rounded-lg border border-white/10 bg-black/30 px-3">
        <div className="flex h-full items-center gap-[3px]" aria-hidden>
          {visual.bars.map((h, i) => (
            <span
              key={i}
              className={cn(
                "flex-1 rounded-full bg-gradient-to-t opacity-80",
                visual.accent,
              )}
              style={{
                height: `${h * 100}%`,
                animation: `wavebar ${1.1 + (i % 5) * 0.18}s ease-in-out ${i * 0.06}s infinite`,
                transformOrigin: "center",
              }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0b091a]" />
      </div>

      <div className="relative mt-auto flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted/70">
          {meta ?? "Open workspace"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-softwhite transition-colors group-hover:border-white/30 group-hover:bg-white/10">
          {action}
          <Icon name="arrowRight" size={12} />
        </span>
      </div>
    </Link>
  );
}
