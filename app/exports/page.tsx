"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  ConfirmButton,
  EmptyState,
  GlassCard,
  GradientText,
  Metric,
  SectionHeading,
  Segmented,
  StatusPill,
} from "@/components/ui/primitives";
import { useStudio } from "@/lib/client/studio";
import { api } from "@/lib/client/api";
import { formatBytes, formatDateTime, formatLufs } from "@/lib/format";
import { STUDIO_META, type StudioId } from "@/lib/types";

type Filter = "all" | StudioId;

export default function ExportsPage() {
  const { exports, refreshExports, notify, system } = useStudio();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () => (filter === "all" ? exports : exports.filter((e) => e.studio === filter)),
    [exports, filter],
  );

  const totals = useMemo(() => {
    const bytes = exports.reduce((sum, e) => sum + e.sizeBytes, 0);
    const measured = exports.filter((e) => e.integratedLufs != null);
    return { bytes, measured: measured.length };
  }, [exports]);

  const remove = async (id: string) => {
    try {
      await api.deleteExport(id);
      await refreshExports();
      notify("info", "Export deleted", "The stored file was removed from the studio server.");
    } catch (err) {
      notify("error", "Delete failed", (err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-fluid-title font-display font-bold tracking-tight">
            <GradientText>Export History</GradientText>
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            Every file listed here was encoded from a real render and stored privately. Loudness
            values come from measurement, not estimation.
          </p>
        </div>
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v)}
          options={[
            { value: "all", label: "All" },
            { value: "vocal", label: "Vocal" },
            { value: "mix", label: "Mix" },
            { value: "mastering", label: "Mastering" },
          ]}
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-4">
        <Metric label="Exports stored" value={exports.length} />
        <Metric label="Total size" value={formatBytes(totals.bytes)} />
        <Metric label="With loudness data" value={totals.measured} hint="Measured before export" />
        <Metric
          label="Server storage"
          value={formatBytes((system?.storage.audioBytes ?? 0) + (system?.storage.exportBytes ?? 0))}
          hint={`${system?.settings.maxUploadMb ?? 80} MB per file`}
        />
      </div>

      <GlassCard>
        <SectionHeading
          eyebrow="Deliverables"
          title={filter === "all" ? "All exports" : `${STUDIO_META[filter].name} exports`}
          description="Downloads are attachment-only and require the export id; files are never exposed as static URLs."
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon="download"
            title="No exports yet"
            description="Bounce a mix, export a vocal layer or deliver a master. Files appear here once the render genuinely completes."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/vocal" className="btn-primary text-xs">
                  <Icon name="mic" size={13} /> Vocal Studio
                </Link>
                <Link href="/mix" className="btn-ghost text-xs">
                  <Icon name="sliders" size={13} /> Mix Studio
                </Link>
                <Link href="/mastering" className="btn-ghost text-xs">
                  <Icon name="disc" size={13} /> Mastering Studio
                </Link>
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-muted">
                  <th className="py-2 pr-2 font-semibold">File</th>
                  <th className="py-2 pr-2 font-semibold">Studio</th>
                  <th className="py-2 pr-2 font-semibold">Format</th>
                  <th className="py-2 pr-2 font-semibold">Loudness</th>
                  <th className="py-2 pr-2 font-semibold">Size</th>
                  <th className="py-2 pr-2 font-semibold">Created</th>
                  <th className="py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                    <td className="max-w-[240px] py-2 pr-2">
                      <div className="truncate font-medium text-softwhite">{record.fileName}</div>
                      <div className="truncate text-[10px] text-muted">{record.projectName}</div>
                    </td>
                    <td className="py-2 pr-2">
                      <StatusPill tone={record.studio === "mastering" ? "warning" : record.studio === "mix" ? "info" : "neutral"}>
                        {STUDIO_META[record.studio]?.short ?? record.studio}
                      </StatusPill>
                    </td>
                    <td className="py-2 pr-2 text-[11px] text-muted">
                      {record.format}
                      {record.bitDepth ? ` ${record.bitDepth}-bit` : ""} ·{" "}
                      {(record.sampleRate / 1000).toFixed(1)} kHz
                    </td>
                    <td className="mono py-2 pr-2 text-[11px] text-softwhite/90">
                      {record.integratedLufs != null ? (
                        <>
                          {formatLufs(record.integratedLufs)}
                          <div className="text-[9px] text-muted">
                            {record.truePeakDb != null ? `${record.truePeakDb.toFixed(2)} dBTP` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted/70">not measured</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-[11px] text-muted">{formatBytes(record.sizeBytes)}</td>
                    <td className="py-2 pr-2 text-[10px] text-muted">{formatDateTime(record.createdAt)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/api/exports/${record.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-softwhite hover:border-white/30"
                          download
                        >
                          <Icon name="download" size={11} /> Download
                        </a>
                        <ConfirmButton
                          label="Delete"
                          title="Delete this export?"
                          description="The stored file is removed. Your project and its source audio stay untouched."
                          confirmLabel="Delete file"
                          onConfirm={() => remove(record.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <SectionHeading eyebrow="Formats" title="What each export contains" />
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { title: "WAV 24-bit", detail: "Delivery-quality PCM. No dithering — the noise floor stays below the master's." },
            { title: "WAV 16-bit", detail: "TPDF-dithered PCM when dithering is enabled in Settings, for CD-style delivery." },
            { title: "MP3 320 kbps", detail: "Constant-bitrate encode via lamejs at 32/44.1/48 kHz. Suitable for references." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-semibold text-softwhite">{item.title}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
