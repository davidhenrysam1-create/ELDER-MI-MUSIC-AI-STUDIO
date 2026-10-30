"use client";

/**
 * Two buttons that answer the only questions worth asking about remote storage:
 * "does it work?" and "is my old music up there yet?".
 *
 *  - **Test connection** runs the same read the studio performs for real (list
 *    the bucket, read one row), so a green result means the path works — not
 *    merely that the URL parses. It never writes.
 *  - **Copy existing files** always starts with a dry run and then asks for a
 *    confirmation that names the file count, so nobody moves a library by
 *    accident. The source directory is only read, never touched.
 */
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, SectionHeading, StatusPill, cn } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";
import { formatBytes } from "@/lib/format";

type Connection = Awaited<ReturnType<typeof api.storage>>["connection"];
type Report = Awaited<ReturnType<typeof api.migrateStorage>>;

export function StorageTools() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const test = async () => {
    setTesting(true);
    setError(null);
    try {
      setConnection((await api.storage()).connection);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const copy = async (confirm: boolean) => {
    setCopying(true);
    setError(null);
    try {
      setReport(await api.migrateStorage(confirm));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setCopying(false);
    }
  };

  const failures = report?.files.filter((file) => !file.ok) ?? [];

  return (
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SectionHeading eyebrow="Durable storage" title="Supabase connection" />
        {connection ? (
          <StatusPill tone={connection.ok ? "success" : "warning"} icon={connection.ok ? "check" : "alert"}>
            {connection.ok ? "Connected" : "Not working yet"}
          </StatusPill>
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        These tests use the same calls the studio makes when it saves audio, so a pass means the real path
        works. Nothing is written by the test.
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => void test()} disabled={testing} className="btn-ghost text-xs">
          <Icon name={testing ? "clock" : "bolt"} size={12} />
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button
          type="button"
          onClick={() => void copy(false)}
          disabled={copying}
          className="btn-subtle text-xs"
        >
          <Icon name="upload" size={12} />
          {copying ? "Checking…" : "Copy existing files (dry run)"}
        </button>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-100">
          {error}
        </p>
      ) : null}

      {connection ? (
        <ul className="mt-2.5 space-y-1.5">
          {connection.checks.map((check) => (
            <li
              key={check.name}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-[10px] leading-relaxed",
                check.ok
                  ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-100"
                  : "border-rose-400/30 bg-rose-500/[0.08] text-rose-100",
              )}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <Icon name={check.ok ? "check" : "x"} size={11} />
                {check.name}
              </div>
              <p className="mt-0.5 opacity-90">{check.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {report ? (
        <div className="mt-2.5 rounded-xl border border-white/10 bg-black/25 p-2.5 text-[10px] leading-relaxed text-muted">
          {report.blocked ? (
            <p className="text-amber-100">{report.blocked}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-semibold text-softwhite">
                  {report.dryRun ? "Dry run — nothing was written" : "Copy finished"}
                </span>
                <span className="mono text-softwhite/80">
                  {report.files.length} file{report.files.length === 1 ? "" : "s"} ·{" "}
                  {formatBytes(report.totalBytes)}
                </span>
              </div>
              <p className="mt-1">
                Database: {report.database.detail}
                {failures.length > 0 ? ` · ${failures.length} file(s) failed` : ""}
              </p>
              {failures.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-rose-200">
                  {failures.slice(0, 5).map((file) => (
                    <li key={file.key} className="mono truncate">
                      {file.key}: {file.error}
                    </li>
                  ))}
                </ul>
              ) : null}
              {report.dryRun && report.files.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void copy(true)}
                  disabled={copying}
                  className="btn-primary mt-2 text-[10px]"
                >
                  <Icon name="upload" size={11} />
                  Copy {report.files.length} file{report.files.length === 1 ? "" : "s"} (
                  {formatBytes(report.totalBytes)}) to Supabase
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </GlassCard>
  );
}
