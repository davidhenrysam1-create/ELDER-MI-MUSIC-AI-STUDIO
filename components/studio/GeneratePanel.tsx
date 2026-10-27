"use client";

/**
 * Music-generation panel.
 *
 * This is the only place in the UI that can create *new* audio with a hosted
 * model (a beat, an instrumental, a sung song or a vocal hook). Everything it
 * shows comes from the server:
 *
 *  - which providers exist and whether each has a key (`GET /api/providers`),
 *  - whether paid generation is switched on and how much of the cap is left,
 *  - the real job state while a provider renders, polled by id.
 *
 * If nothing is configured it says exactly which environment variable to add and
 * renders no generate button — the panel never fakes a result.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  GlassCard,
  ProgressBar,
  SectionHeading,
  Segmented,
  Slider,
  StatusPill,
  cn,
} from "@/components/ui/primitives";
import { api, type ProviderCatalogue } from "@/lib/client/api";
import { useStudio } from "@/lib/client/studio";
import { formatTime } from "@/lib/format";
import {
  GENERATION_KIND_LABEL,
  GENERATION_KIND_NOTE,
  type GenerationJob,
  type GenerationKind,
  type MusicProviderId,
} from "@/lib/types";

/** How often to ask the server to advance a pending provider job. */
const POLL_MS = 4000;
/** Give up polling after this long and leave the job recorded as running. */
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

export function GeneratePanel({
  studio,
  defaultKind = "beat",
}: {
  studio: "vocal" | "mix";
  defaultKind?: GenerationKind;
}) {
  const { project, replaceProject, notify } = useStudio();
  const [catalogue, setCatalogue] = useState<ProviderCatalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<MusicProviderId | null>(null);
  const [kind, setKind] = useState<GenerationKind>(defaultKind);
  const [prompt, setPrompt] = useState("");
  const [durationSec, setDurationSec] = useState(30);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [pollNote, setPollNote] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  /** Load the catalogue once, and expose a manual refresh after settings change. */
  const load = useCallback(async () => {
    try {
      const data = await api.providers();
      setCatalogue(data);
      setLoadError(null);
      // Preselect the first provider that can do the requested kind and has a key.
      const usable = data.providers.find(
        (entry) => entry.configured && entry.kinds.includes(defaultKind),
      );
      setProviderId((current) => current ?? usable?.id ?? null);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, [defaultKind]);

  useEffect(() => {
    void load();
  }, [load]);

  const providers = catalogue?.providers ?? [];
  const selected = providers.find((entry) => entry.id === providerId) ?? null;
  const configured = providers.filter((entry) => entry.configured);
  const paidAllowed = catalogue?.spend.allowPaidGeneration ?? false;
  const kindsForSelected: GenerationKind[] = selected
    ? selected.kinds
    : (["beat", "instrumental", "song", "vocals"] as GenerationKind[]);
  const maxDuration = selected?.maxDurationSec ?? 60;
  const estimate = selected
    ? Math.round(selected.estimateUsdPerSecond * durationSec * 100) / 100
    : 0;
  const remaining = catalogue?.spend.remainingUsd ?? 0;

  /** Keep the requested kind valid whenever the provider changes. */
  const chooseProvider = (id: MusicProviderId) => {
    setProviderId(id);
    const next = providers.find((entry) => entry.id === id);
    if (next && !next.kinds.includes(kind)) setKind(next.kinds[0]);
    if (next && durationSec > next.maxDurationSec) setDurationSec(next.maxDurationSec);
  };

  /** Poll the job until it reaches a terminal state (or the caller cancels). */
  const pollUntilDone = async (initial: GenerationJob) => {
    let current = initial;
    const startedAt = Date.now();
    while (
      !cancelledRef.current &&
      (current.status === "running" || current.status === "queued") &&
      Date.now() - startedAt < POLL_TIMEOUT_MS
    ) {
      setPollNote(
        `Waiting for ${current.modelId} — checked ${Math.round((Date.now() - startedAt) / 1000)}s ago.`,
      );
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      try {
        const outcome = await api.generation(current.id);
        current = outcome.job;
        setJob(current);
        if (outcome.asset && project) {
          // Pull the full project so the new channel and asset appear everywhere.
          const { project: fresh } = await api.project(project.id);
          replaceProject(fresh);
        }
      } catch (err) {
        setPollNote(`Polling failed: ${(err as Error).message}`);
        break;
      }
    }
    setPollNote(null);
    return current;
  };

  const generate = async () => {
    if (!project || !selected) return;
    if (prompt.trim().length < 6) {
      notify("error", "Describe the music first", "Write at least a few words about the beat or vocal you want.");
      return;
    }
    setBusy(true);
    cancelledRef.current = false;
    setJob(null);
    try {
      const outcome = await api.createGeneration({
        projectId: project.id,
        providerId: selected.id,
        kind,
        prompt: prompt.trim(),
        durationSec,
      });
      setJob(outcome.job);

      if (outcome.job.status === "failed") {
        notify("error", "The provider could not render that", outcome.job.message);
        return;
      }

      if (outcome.job.status === "completed") {
        if (outcome.asset) {
          const { project: fresh } = await api.project(project.id);
          replaceProject(fresh);
        }
        notify("success", "Audio generated", outcome.job.message);
        return;
      }

      // Provider is still working: poll for the real result.
      const finished = await pollUntilDone(outcome.job);
      if (finished.status === "completed") {
        notify("success", "Audio generated", finished.message);
      } else if (finished.status === "failed") {
        notify("error", "Generation failed", finished.message);
      }
    } catch (err) {
      notify("error", "Generation was refused", (err as Error).message);
      setJob(null);
    } finally {
      setBusy(false);
      void load();
    }
  };

  const cancel = async () => {
    if (!job) return;
    cancelledRef.current = true;
    try {
      const { job: cancelled } = await api.cancelGeneration(job.id);
      setJob(cancelled);
      notify("info", "Generation cancelled", "No charge was recorded.");
    } catch (err) {
      notify("error", "Could not cancel", (err as Error).message);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Nothing configured: explain, do not pretend                       */
  /* ---------------------------------------------------------------- */

  if (configured.length === 0) {
    return (
      <GlassCard accent={studio === "mix" ? "mix" : "vocal"}>
        <SectionHeading
          eyebrow="AI music generation"
          title="Generate a beat or vocal"
          description="Beats, instrumentals, songs and vocal hooks are generated by a hosted model. No model is bundled with the studio, so this stays off until you connect one."
          action={<StatusPill tone="warning">Awaiting configuration</StatusPill>}
        />
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3">
          <div className="flex items-start gap-2">
            <Icon name="lock" size={13} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="text-[10px] leading-relaxed text-amber-100/85">
              <p className="font-semibold text-amber-100">No generation provider is configured.</p>
              <p className="mt-1">
                Add one of these to <span className="mono">.env.local</span> (keys come from your own
                provider account and are billed by that provider), then restart the studio:
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {providers.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-1.5">
                    <span className="mono text-cyan-200">{entry.keyEnv.join(" + ")}</span>
                    <span className="text-muted">— {entry.name}</span>
                  </li>
                ))}
                {loadError ? <li className="text-rose-200">{loadError}</li> : null}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/docs" className="btn-ghost text-xs">
            <Icon name="file" size={13} /> Provider setup guide
          </Link>
          <Link href="/settings" className="btn-subtle text-xs">
            <Icon name="settings" size={13} /> Open settings
          </Link>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
          Everything else in this studio works without a key: vocal layering, mixing, mastering,
          analysis and export all run locally on your own audio.
        </p>
      </GlassCard>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Configured providers                                              */
  /* ---------------------------------------------------------------- */

  return (
    <GlassCard accent={studio === "mix" ? "mix" : "vocal"}>
      <SectionHeading
        eyebrow="AI music generation"
        title="Generate new audio"
        description="The provider renders on its own servers, then the file is copied into this project as a normal, editable audio object with its prompt and licence recorded."
        action={
          <StatusPill tone={paidAllowed ? "success" : "warning"} icon="bolt">
            {paidAllowed ? "Paid generation on" : "Paid generation off"}
          </StatusPill>
        }
      />

      {/* Budget line: always visible before any money is spent. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px] text-muted">
        <span>
          Spend cap <span className="mono text-softwhite">${(catalogue?.spend.capUsd ?? 0).toFixed(2)}</span>
        </span>
        <span className="text-white/20">·</span>
        <span>
          Used <span className="mono text-softwhite">${(catalogue?.spend.lifetimeUsd ?? 0).toFixed(2)}</span>
        </span>
        <span className="text-white/20">·</span>
        <span>
          Left <span className="mono text-softwhite">${remaining.toFixed(2)}</span>
        </span>
        <Link href="/settings" className="ml-auto text-cyan-200 hover:text-white">
          Change
        </Link>
      </div>

      {!paidAllowed ? (
        <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-[10px] leading-relaxed text-amber-100/85">
          Paid generation is switched off, so no request will be sent. Enable it in{" "}
          <Link href="/settings" className="underline">
            Settings → AI providers
          </Link>{" "}
          once you have checked the cost estimate below.
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <div className="label mb-1">Provider</div>
          <div className="flex flex-wrap gap-1.5">
            {providers.map((entry) => {
              const disabled = !entry.configured;
              const active = entry.id === providerId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => chooseProvider(entry.id)}
                  disabled={disabled}
                  aria-pressed={active}
                  title={disabled ? `Needs ${entry.keyEnv.join(" + ")}` : entry.note}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-left text-[10px] transition-colors",
                    active
                      ? "border-white/25 bg-white/10 text-softwhite"
                      : "border-white/10 bg-white/[0.03] text-muted hover:text-softwhite",
                    disabled && "cursor-not-allowed opacity-45",
                  )}
                >
                  <span className="block font-semibold">{entry.name}</span>
                  <span className="block text-[9px] text-muted">
                    {disabled ? `needs ${entry.keyEnv[0]}` : `${entry.vendor} · ~$${entry.estimateUsdPerSecond.toFixed(3)}/s`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="label mb-1">What should it make?</div>
          <Segmented
            label="Generation type"
            size="sm"
            value={kind}
            onChange={(value) => setKind(value)}
            options={kindsForSelected.map((value) => ({
              value,
              label: GENERATION_KIND_LABEL[value],
            }))}
          />
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            {GENERATION_KIND_NOTE[kind]}
          </p>
        </div>

        <div>
          <label className="label mb-1 block" htmlFor="generate-prompt">
            Brief
          </label>
          <textarea
            id="generate-prompt"
            className="field min-h-[92px] text-xs"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={600}
            placeholder={
              kind === "beat"
                ? "Amapiano log-drum groove at 108 BPM, deep sub, shakers, sparse piano stabs, no vocals"
                : kind === "song"
                  ? "Afrobeats love song at 102 BPM, male tenor lead, call-and-response backing, warm keys"
                  : "Airy female hook, double-tracked, sits over an Afrobeats beat"
            }
          />
          <div className="mt-1 flex items-center justify-between text-[9px] text-muted/70">
            <span>Describe genre, tempo, instruments and mood. Nothing is invented from an empty brief.</span>
            <span className="mono">{prompt.length}/600</span>
          </div>
        </div>

        <Slider
          label="Length"
          min={5}
          max={maxDuration}
          step={5}
          value={Math.min(durationSec, maxDuration)}
          onChange={(value) => setDurationSec(value)}
          format={(value) => formatTime(value)}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px]">
          <span className="text-muted">
            Estimated cost{" "}
            <span className="mono text-softwhite">${estimate.toFixed(2)}</span>
            <span className="ml-1 text-muted/60">(the provider bills you directly)</span>
          </span>
          {selected ? (
            <span className="mono text-[9px] text-muted/70">
              {selected.model} · max {formatTime(selected.maxDurationSec)}
            </span>
          ) : null}
        </div>

        {job ? <GenerationStatus job={job} pollNote={pollNote} onCancel={() => void cancel()} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={() => void generate()}
            disabled={busy || !paidAllowed || !selected || estimate > remaining}
            title={estimate > remaining ? "This request would exceed the spend cap" : undefined}
          >
            <Icon name="sparkles" size={13} />
            {busy ? "Generating…" : "Generate audio"}
          </button>
          {job && (job.status === "running" || job.status === "queued") ? (
            <button type="button" className="btn-ghost text-xs" onClick={() => void cancel()}>
              <Icon name="x" size={13} /> Cancel
            </button>
          ) : null}
          {estimate > remaining ? (
            <span className="text-[10px] text-amber-200">
              Exceeds the remaining ${remaining.toFixed(2)} cap.
            </span>
          ) : null}
        </div>

        <p className="text-[9px] leading-relaxed text-muted/60">
          Licence: {selected?.licence ?? "see the provider's terms"} ·{" "}
          <a
            href={selected?.docsUrl ?? "/docs"}
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-white"
          >
            Provider documentation
          </a>
        </p>
      </div>
    </GlassCard>
  );
}

/** Live status for a generation job, including the provider's own error text. */
function GenerationStatus({
  job,
  pollNote,
  onCancel,
}: {
  job: GenerationJob;
  pollNote: string | null;
  onCancel: () => void;
}) {
  const running = job.status === "running" || job.status === "queued";
  const tone =
    job.status === "completed"
      ? "border-emerald-400/25 bg-emerald-400/[0.07]"
      : job.status === "failed"
        ? "border-rose-400/30 bg-rose-500/10"
        : job.status === "cancelled"
          ? "border-white/10 bg-white/[0.03]"
          : "border-violet/30 bg-violet/[0.08]";

  return (
    <div className={cn("rounded-xl border p-3", tone)} role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-softwhite">
          {GENERATION_KIND_LABEL[job.kind]} · {job.providerId}
        </span>
        <StatusPill
          tone={
            job.status === "completed"
              ? "success"
              : job.status === "failed"
                ? "danger"
                : job.status === "cancelled"
                  ? "neutral"
                  : "warning"
          }
        >
          {job.status}
        </StatusPill>
      </div>
      <div className="mt-1.5">
        <ProgressBar value={job.progress} label="Generation progress" />
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{job.message}</p>
      {pollNote ? <p className="mt-1 text-[9px] text-muted/60">{pollNote}</p> : null}
      {job.status === "completed" ? (
        <p className="mt-1 text-[9px] text-emerald-200/80">
          Charged to the studio tracker: ${job.costChargedUsd.toFixed(2)} (estimate). The provider&apos;s
          own invoice is authoritative.
        </p>
      ) : null}
      {running ? (
        <button type="button" className="mt-1.5 text-[10px] text-muted underline hover:text-white" onClick={onCancel}>
          Cancel this job
        </button>
      ) : null}
    </div>
  );
}
