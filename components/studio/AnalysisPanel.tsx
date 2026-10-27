"use client";

import { Icon } from "@/components/ui/Icon";
import { Metric, StatusPill, cn } from "@/components/ui/primitives";
import type { Analysis } from "@/lib/types";
import { formatLufs } from "@/lib/format";

export function BandBalance({ analysis }: { analysis: Analysis }) {
  const bands: { key: keyof Analysis["bandBalance"]; label: string; colour: string }[] = [
    { key: "low", label: "Sub / low", colour: "from-rose-500 to-orange" },
    { key: "lowMid", label: "Low-mid", colour: "from-orange to-gold" },
    { key: "mid", label: "Mid", colour: "from-gold to-lime" },
    { key: "highMid", label: "High-mid", colour: "from-lime to-cyan" },
    { key: "high", label: "Air", colour: "from-cyan to-violet" },
  ];
  return (
    <div className="space-y-1.5">
      {bands.map((band) => {
        const value = analysis.bandBalance[band.key];
        return (
          <div key={band.key} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[10px] text-muted">{band.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r", band.colour)}
                style={{ width: `${Math.min(100, value * 2.4)}%` }}
              />
            </div>
            <span className="mono w-10 shrink-0 text-right text-[10px] text-softwhite/80">
              {value.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AnalysisPanel({
  analysis,
  title = "Measured analysis",
  subtitle,
  compact = false,
}: {
  analysis: Analysis | null;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  if (!analysis) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-softwhite">
          <Icon name="target" size={14} className="text-cyan-300" />
          {title}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          No measurement yet. Values appear after real audio has been analysed — nothing is
          estimated or prefilled.
        </p>
      </div>
    );
  }

  const loudnessTone =
    analysis.integratedLufs > -6 ? "warn" : analysis.integratedLufs < -24 ? "bad" : "good";
  const tpTone = analysis.truePeakDb > -0.1 ? "bad" : analysis.truePeakDb > -1 ? "warn" : "good";

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-softwhite">
          <Icon name="target" size={14} className="text-cyan-300" />
          {title}
        </div>
        <StatusPill tone="neutral" icon="clock">
          Measured {new Date(analysis.measuredAt).toLocaleTimeString()}
        </StatusPill>
      </div>
      {subtitle ? <p className="mb-2 text-[10px] leading-relaxed text-muted">{subtitle}</p> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Metric
          label="Integrated"
          value={formatLufs(analysis.integratedLufs)}
          tone={loudnessTone}
          hint="BS.1770 gated"
        />
        <Metric
          label="True peak"
          value={`${analysis.truePeakDb.toFixed(2)}`}
          unit="dBTP"
          tone={tpTone}
          hint="4× oversampled"
        />
        <Metric label="Sample peak" value={`${analysis.peakDb.toFixed(2)}`} unit="dBFS" />
        <Metric label="Short-term max" value={formatLufs(analysis.shortTermMaxLufs)} />
        <Metric label="Loudness range" value={`${analysis.loudnessRangeLu.toFixed(1)}`} unit="LU" />
        <Metric label="Crest factor" value={`${analysis.crestFactorDb.toFixed(1)}`} unit="dB" />
        <Metric
          label="Stereo width"
          value={`${analysis.stereoWidthPct.toFixed(0)}`}
          unit="%"
          hint={`corr ${analysis.correlation.toFixed(2)}`}
        />
        <Metric
          label="Clipping"
          value={analysis.clippingSamples}
          unit="smp"
          tone={analysis.clippingSamples > 0 ? "warn" : "good"}
        />
        {!compact ? (
          <>
            <Metric label="Sample rate" value={`${(analysis.sampleRate / 1000).toFixed(1)}`} unit="kHz" />
            <Metric
              label="Bit depth"
              value={analysis.bitDepth ? `${analysis.bitDepth}-bit` : "decoded"}
              hint={analysis.bitDepth ? undefined : "Source depth unknown"}
            />
            <Metric label="Channels" value={analysis.channels} />
            <Metric label="Duration" value={`${analysis.durationSec.toFixed(1)}`} unit="s" />
          </>
        ) : null}
      </div>

      {!compact ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Tonal balance (measured energy)
          </div>
          <BandBalance analysis={analysis} />
        </div>
      ) : null}

      <p className="mt-2 flex items-start gap-1.5 text-[9px] leading-relaxed text-muted/60">
        <Icon name="info" size={11} className="mt-0.5 shrink-0" />
        {analysis.method}
      </p>
    </div>
  );
}
