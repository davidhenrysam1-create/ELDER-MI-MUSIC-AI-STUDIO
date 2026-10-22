"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/components/ui/primitives";
import type { AssetKind, AssetMeta } from "@/lib/types";
import { formatBytes, formatTime } from "@/lib/format";

export function AudioAssetSelect({
  label,
  assets,
  value,
  onChange,
  kinds,
  hint,
  emptyHint,
  allowNone = false,
  noneLabel = "None selected",
}: {
  label: string;
  assets: AssetMeta[];
  value: string | null;
  onChange: (id: string | null) => void;
  kinds?: AssetKind[];
  hint?: string;
  emptyHint?: string;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const filtered = kinds ? assets.filter((a) => kinds.includes(a.kind)) : assets;
  const selected = filtered.find((a) => a.id === value) ?? null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="label" htmlFor={`asset-select-${label.replace(/\s+/g, "-")}`}>
          {label}
        </label>
        {selected ? (
          <span className="mono text-[10px] text-muted">
            {formatTime(selected.durationSec)} · {(selected.sampleRate / 1000).toFixed(1)} kHz ·{" "}
            {formatBytes(selected.sizeBytes)}
          </span>
        ) : null}
      </div>
      {filtered.length === 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
          <Icon name="info" size={13} className="mt-0.5 shrink-0" />
          {emptyHint ?? "Upload audio in this project first — nothing is preloaded."}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <select
              id={`asset-select-${label.replace(/\s+/g, "-")}`}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value || null)}
              className="field appearance-none truncate pr-8 text-xs"
            >
              {allowNone ? <option value="">{noneLabel}</option> : null}
              {filtered.map((asset) => (
                <option key={asset.id} value={asset.id} className="bg-[#15112B]">
                  {asset.name} · {formatTime(asset.durationSec)} · {asset.kind}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
        </div>
      )}
      {hint ? <p className="mt-1.5 text-[10px] leading-relaxed text-muted/70">{hint}</p> : null}
    </div>
  );
}

export function AssetChip({ asset, className }: { asset: AssetMeta; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-muted",
        className,
      )}
    >
      <Icon name="music" size={11} />
      <span className="truncate">{asset.name}</span>
    </span>
  );
}
