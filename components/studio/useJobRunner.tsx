"use client";

import { useCallback, useRef, useState } from "react";
import { useStudio } from "@/lib/client/studio";
import type { JobRecord, StudioId } from "@/lib/types";


export interface JobHandle {
  update: (progress: number, message: string) => void;
}

/**
 * Runs a real render job: local progress is surfaced immediately, and the final
 * status (completed or failed, with the actual error) is persisted with the
 * project so it survives a reload.
 */
export function useJobRunner(studio: StudioId) {
  const { project, notify, updateProject } = useStudio();
  const [job, setJob] = useState<JobRecord | null>(null);
  const abortRef = useRef(false);

  const run = useCallback(
    async <T,>(
      title: string,
      kind: string,
      task: (report: (progress: number, message: string) => void) => Promise<T>,
    ): Promise<T | null> => {
      if (!project) {
        notify("error", "No project is open", "Create or open a project first.");
        return null;
      }
      abortRef.current = false;
      const projectId = project.id;
      const record: JobRecord = {
        id: `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        projectId,
        studio,
        kind,
        title,
        status: "running",
        progress: 0,
        message: "Starting…",
        startedAt: new Date().toISOString(),
      };
      setJob({ ...record });

      const persist = async (next: JobRecord) => {
        try {
          const res = await fetch(`/api/projects/${projectId}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          });
          if (!res.ok) return;
          // Merge only the job list: replacing the whole project here could
          // clobber edits the user made while the render was running.
          updateProject((p) => {
            if (p.id !== projectId) return p;
            const exists = p.jobs.some((j) => j.id === next.id);
            return {
              ...p,
              jobs: exists
                ? p.jobs.map((j) => (j.id === next.id ? next : j))
                : [next, ...p.jobs],
            };
          });
        } catch {
          /* job telemetry must never break the render */
        }
      };

      void persist(record);

      const report = (progress: number, message: string) => {
        record.progress = Math.max(record.progress, Math.min(100, Math.round(progress)));
        record.message = message;
        setJob({ ...record });
      };

      try {
        const result = await task(report);
        const finished: JobRecord = {
          ...record,
          status: "completed",
          progress: 100,
          message: record.message || "Completed",
          finishedAt: new Date().toISOString(),
        };
        setJob(finished);
        await persist(finished);
        notify("success", title, finished.message);
        return result;
      } catch (err) {
        const failed: JobRecord = {
          ...record,
          status: "failed",
          message: (err as Error).message.slice(0, 300),
          error: (err as Error).message.slice(0, 400),
          finishedAt: new Date().toISOString(),
        };
        setJob(failed);
        await persist(failed);
        notify("error", `${title} failed`, (err as Error).message);
        return null;
      }
    },
    [project, notify, updateProject, studio],
  );

  return { job, run, clear: () => setJob(null) };
}

export function JobStatusCard({ job }: { job: JobRecord | null }) {
  if (!job) return null;
  const running = job.status === "running";
  return (
    <div
      className={`rounded-xl border p-3 ${
        job.status === "failed"
          ? "border-rose-400/30 bg-rose-500/10"
          : job.status === "completed"
            ? "border-emerald-400/25 bg-emerald-400/[0.07]"
            : "border-violet/30 bg-violet/[0.08]"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-softwhite">{job.title}</span>
        <span className="mono uppercase tracking-wider text-muted">
          {running ? `${job.progress}%` : job.status}
        </span>
      </div>
      <div className="mt-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${
              job.status === "failed"
                ? "bg-rose-400"
                : "bg-gradient-to-r from-violet via-magenta to-cyan"
            }`}
            style={{ width: `${job.status === "completed" ? 100 : job.progress}%` }}
          />
        </div>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{job.message}</p>
      {job.error ? (
        <p className="mt-1 rounded-md bg-black/30 px-2 py-1 text-[10px] text-rose-200">{job.error}</p>
      ) : null}
    </div>
  );
}
