/**
 * Generation orchestrator.
 *
 * Turns "generate me a beat" into a stored audio asset with provenance, without
 * ever pretending a provider ran when it did not.
 *
 * Flow
 *  1. Validate the request and the studio's budget (`allowPaidGeneration`,
 *     `spendCapUsd`) before contacting anyone.
 *  2. Persist a job, then call the adapter. Synchronous providers finish here;
 *     asynchronous ones leave a `providerJobId` to poll.
 *  3. On completion: write the audio into private storage, decode real peaks for
 *     WAV, create the asset + mixer channel, attach provenance, charge the
 *     spend ledger.
 *  4. On failure: record the vendor's message on the job. Nothing is charged.
 */
import { extractPeaks } from "@/lib/audio/peaks";
import { decodeWavChannels, readWavInfo } from "@/lib/audio/wav";
import { makeTrack } from "@/lib/projects";
import { mutateDb, readDb } from "@/lib/server/db";
import { getProvider, estimateCost } from "@/lib/server/providers/registry";
import {
  ProviderError,
  type GenerationKind,
  type GenerationRequest,
  type ProviderResult,
  type ProviderStart,
} from "@/lib/server/providers/types";
import { getProject } from "@/lib/server/repo";
import { sha256, writeAudio } from "@/lib/server/storage";
import type {
  AssetKind,
  AssetMeta,
  GenerationJob,
  GenerationStatus,
  MusicProviderId,
  StemRole,
} from "@/lib/types";

/** Guard rails for a request, mirrored by the API route. */
export const GENERATION_LIMITS = {
  minPromptLength: 6,
  maxPromptLength: 600,
  minDurationSec: 2,
  maxDurationSec: 300,
} as const;

export interface CreateGenerationInput {
  providerId: MusicProviderId;
  kind: GenerationKind;
  prompt: string;
  negativePrompt?: string;
  durationSec: number;
  seed?: number;
}

/** Shape returned to the client: the job plus whatever asset it produced. */
export interface GenerationOutcome {
  job: GenerationJob;
  asset: AssetMeta | null;
}

const now = () => new Date().toISOString();

/** Validate free text from an untrusted body. */
function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Map a generation kind onto the studio's asset and channel vocabulary. */
function roleFor(kind: GenerationKind): { assetKind: AssetKind; role: StemRole; label: string } {
  switch (kind) {
    case "beat":
      return { assetKind: "stem", role: "drums", label: "Generated beat" };
    case "instrumental":
      return { assetKind: "stem", role: "instrumental", label: "Generated instrumental" };
    case "song":
      return { assetKind: "vocal", role: "lead_vocal", label: "Generated song" };
    case "vocals":
      return { assetKind: "vocal", role: "lead_vocal", label: "Generated vocals" };
  }
}

/** Newest-first insert, capped so the database cannot grow without bound. */
function upsertJob(jobs: GenerationJob[], job: GenerationJob): GenerationJob[] {
  const without = jobs.filter((entry) => entry.id !== job.id);
  return [job, ...without].slice(0, 60);
}

/** Persist a job mutation and return the stored record. */
async function saveJob(job: GenerationJob): Promise<GenerationJob> {
  return mutateDb((db) => {
    db.generations = upsertJob(db.generations, job);
    return job;
  });
}

/**
 * Create and (when possible) complete a generation job.
 *
 * Throws `ProviderError` for request-level problems (unknown provider, missing
 * key, budget exhausted). Provider *runtime* failures are recorded on the job and
 * returned, so the UI can show the vendor's message next to the failed job.
 */
export async function createGeneration(
  projectId: string,
  input: CreateGenerationInput,
): Promise<GenerationOutcome> {
  const project = await getProject(projectId);
  if (!project) {
    throw new ProviderError("Project not found", { status: 404 });
  }

  const provider = getProvider(input.providerId);
  const descriptor = provider.descriptor();

  if (!descriptor.configured) {
    throw new ProviderError(
      `${descriptor.name} is not configured. Set ${descriptor.keyEnv.join(" and ")} in .env.local, then restart the studio.`,
      { status: 400, providerId: descriptor.id },
    );
  }
  if (!descriptor.kinds.includes(input.kind)) {
    throw new ProviderError(
      `${descriptor.name} cannot generate "${input.kind}". Available: ${descriptor.kinds.join(", ")}.`,
      { status: 400, providerId: descriptor.id },
    );
  }

  const prompt = cleanText(input.prompt, GENERATION_LIMITS.maxPromptLength);
  if (prompt.length < GENERATION_LIMITS.minPromptLength) {
    throw new ProviderError(
      `Describe the music in at least ${GENERATION_LIMITS.minPromptLength} characters.`,
      { status: 400, providerId: descriptor.id },
    );
  }

  const durationSec = Math.min(
    descriptor.maxDurationSec,
    Math.max(
      GENERATION_LIMITS.minDurationSec,
      Math.round(Number(input.durationSec) || 30),
    ),
  );

  const db = await readDb();
  const settings = db.settings;
  const estimate = estimateCost(descriptor, durationSec);

  // Budget gate: a key alone must never be enough to spend money.
  if (!settings.allowPaidGeneration) {
    throw new ProviderError(
      "Paid generation is switched off. Enable it in Settings → AI providers after checking the cost estimate.",
      { status: 403, providerId: descriptor.id },
    );
  }
  if (db.spend.lifetimeUsd + estimate > settings.spendCapUsd) {
    throw new ProviderError(
      `This request would exceed the $${settings.spendCapUsd.toFixed(2)} spend cap (already used $${db.spend.lifetimeUsd.toFixed(2)}, this would add roughly $${estimate.toFixed(2)}). Raise the cap in Settings to continue.`,
      { status: 402, providerId: descriptor.id },
    );
  }

  const jobId = `gen_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let job: GenerationJob = {
    id: jobId,
    projectId,
    providerId: descriptor.id,
    modelId: descriptor.model,
    kind: input.kind,
    prompt,
    negativePrompt: cleanText(input.negativePrompt, GENERATION_LIMITS.maxPromptLength) || null,
    durationSec,
    status: "queued",
    progress: 5,
    message: `Sending the brief to ${descriptor.name}…`,
    providerJobId: null,
    assetId: null,
    costEstimateUsd: estimate,
    costChargedUsd: 0,
    licence: descriptor.licence,
    createdAt: now(),
    updatedAt: now(),
  };
  job = await saveJob(job);

  const request: GenerationRequest = {
    kind: input.kind,
    prompt,
    negativePrompt: job.negativePrompt ?? undefined,
    durationSec,
    seed: Number.isFinite(input.seed) ? Number(input.seed) : undefined,
  };

  try {
    const start = await provider.start(request);
    return await handleProviderStart(job, request, start);
  } catch (err) {
    return { job: await failJob(job, err), asset: null };
  }
}

/**
 * Advance a pending job by one step.
 *
 * Called by `GET /api/generate/[id]`; the client polls while it holds a job id.
 */
export async function advanceGeneration(jobId: string): Promise<GenerationOutcome | null> {
  const db = await readDb();
  const existing = db.generations.find((entry) => entry.id === jobId);
  if (!existing) return null;

  // Finished jobs are terminal: never re-poll and never re-charge.
  if (existing.status === "completed" || existing.status === "cancelled") {
    return { job: existing, asset: findAsset(db, existing) };
  }
  if (existing.status === "failed") {
    return { job: existing, asset: null };
  }
  if (!existing.providerJobId) {
    // Should not happen, but never leave a job spinning forever.
    return { job: await failJob(existing, new Error("This job has no provider handle to poll.")), asset: null };
  }

  const provider = getProvider(existing.providerId);
  const request: GenerationRequest = {
    kind: existing.kind,
    prompt: existing.prompt,
    negativePrompt: existing.negativePrompt ?? undefined,
    durationSec: existing.durationSec,
  };

  try {
    const next = await provider.poll(existing.providerJobId, request);
    return await handleProviderStart(existing, request, next);
  } catch (err) {
    if (err instanceof ProviderError && err.retryable) {
      // Transient: keep the job alive and let the next poll retry.
      const retrying: GenerationJob = {
        ...existing,
        status: "running",
        progress: Math.min(90, existing.progress + 2),
        message: `${err.message} — retrying…`,
        updatedAt: now(),
      };
      return { job: await saveJob(retrying), asset: null };
    }
    return { job: await failJob(existing, err), asset: null };
  }
}

/** Cancel a job; pending vendor operations are cancelled on a best-effort basis. */
export async function cancelGeneration(jobId: string): Promise<GenerationJob | null> {
  const db = await readDb();
  const job = db.generations.find((entry) => entry.id === jobId);
  if (!job) return null;
  if (job.status === "completed" || job.status === "failed") return job;

  if (job.providerJobId) {
    const provider = getProvider(job.providerId);
    await provider.cancel?.(job.providerJobId).catch(() => undefined);
  }

  const cancelled: GenerationJob = {
    ...job,
    status: "cancelled",
    message: "Cancelled before completion. Nothing was charged.",
    finishedAt: now(),
    updatedAt: now(),
  };
  return saveJob(cancelled);
}

/** List jobs for one project (newest first). */
export async function listGenerations(projectId?: string): Promise<GenerationJob[]> {
  const db = await readDb();
  const jobs = projectId
    ? db.generations.filter((entry) => entry.projectId === projectId)
    : db.generations;
  return [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Total estimated spend recorded by the studio. */
export async function spendSummary() {
  const db = await readDb();
  return {
    lifetimeUsd: Math.round(db.spend.lifetimeUsd * 100) / 100,
    capUsd: db.settings.spendCapUsd,
    allowPaidGeneration: db.settings.allowPaidGeneration,
    remainingUsd: Math.round(Math.max(0, db.settings.spendCapUsd - db.spend.lifetimeUsd) * 100) / 100,
  };
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

/** Find the asset referenced by a completed job. */
function findAsset(
  db: { projects: { id: string; assets: AssetMeta[] }[] },
  job: GenerationJob,
): AssetMeta | null {
  if (!job.assetId) return null;
  const project = db.projects.find((entry) => entry.id === job.projectId);
  return project?.assets.find((asset) => asset.id === job.assetId) ?? null;
}

/** Record a failure with the provider's own wording. */
async function failJob(job: GenerationJob, err: unknown): Promise<GenerationJob> {
  const message =
    err instanceof ProviderError
      ? err.message
      : err instanceof Error
        ? err.message
        : "The provider failed without a reason.";
  const failed: GenerationJob = {
    ...job,
    status: "failed",
    progress: 100,
    message,
    error: message.slice(0, 400),
    finishedAt: now(),
    updatedAt: now(),
  };
  return saveJob(failed);
}

/** Common path for "the provider gave us audio" and "still waiting". */
async function handleProviderStart(
  job: GenerationJob,
  request: GenerationRequest,
  start: ProviderStart,
): Promise<GenerationOutcome> {
  if (start.mode === "pending") {
    const running: GenerationJob = {
      ...job,
      status: "running",
      progress: Math.max(job.progress, 25),
      message: start.note ?? "The provider is rendering. This page will update as it finishes.",
      providerJobId: start.providerJobId,
      updatedAt: now(),
    };
    return { job: await saveJob(running), asset: null };
  }

  const { asset, job: completed } = await storeResult(job, request, start.result);
  return { job: completed, asset };
}

/**
 * Persist provider audio as a first-class studio asset.
 *
 * Exported for tests: it is the only place that converts bytes into an asset,
 * so provenance and measurement stay consistent.
 */
export async function storeResult(
  job: GenerationJob,
  request: GenerationRequest,
  result: ProviderResult,
): Promise<{ job: GenerationJob; asset: AssetMeta }> {
  const assetId = `ast_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await writeAudio(assetId, result.audio.extension, result.audio.bytes);

  // WAV can be decoded here, so peaks and duration are real. Compressed output
  // (MP3) has no server-side decoder: peaks stay empty and the browser fills the
  // waveform in when the file is played.
  const wav = decodeWavChannels(result.audio.bytes);
  const info = readWavInfo(result.audio.bytes);
  const peaks = wav ? extractPeaks(wav.channels) : [];
  const durationSec =
    wav && wav.sampleRate > 0
      ? Math.round((wav.frames / wav.sampleRate) * 1000) / 1000
      : result.durationSec ?? request.durationSec;

  const mapping = roleFor(job.kind);
  const slug = job.prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const asset: AssetMeta = {
    id: assetId,
    projectId: job.projectId,
    name: `${mapping.label}${slug ? ` — ${slug}` : ""}.${result.audio.extension}`,
    kind: mapping.assetKind,
    mimeType: result.audio.mimeType,
    extension: result.audio.extension,
    sizeBytes: result.audio.bytes.byteLength,
    durationSec,
    sampleRate: info?.sampleRate ?? 48000,
    channels: info?.channels ?? 2,
    bitDepth: info?.bitDepth ?? null,
    peaks,
    engine: `${job.providerId} · ${result.modelId}`,
    derivedFromId: null,
    provenance: {
      providerId: job.providerId,
      modelId: result.modelId,
      prompt: job.prompt,
      licence: result.licence,
      costUsd: result.costUsd,
      jobId: job.id,
    },
    createdAt: now(),
    sha256: sha256(result.audio.bytes),
  };

  const completed = await mutateDb(async (db) => {
    const project = db.projects.find((entry) => entry.id === job.projectId);
    if (!project) throw new ProviderError("Project disappeared before the audio was stored.", { status: 404 });

    project.assets.unshift(asset);
    project.tracks.push(
      makeTrack(asset.id, mapping.label, mapping.role, project.tracks.length),
    );
    // First lead vocal in a session becomes the vocal source, so generated vocals
    // are immediately usable by the layering tools.
    if (mapping.role === "lead_vocal" && !project.vocal.sourceAssetId) {
      project.vocal.sourceAssetId = asset.id;
    }

    const charged = Math.round(result.costUsd * 100) / 100;
    db.spend.lifetimeUsd = Math.round((db.spend.lifetimeUsd + charged) * 100) / 100;

    const finished: GenerationJob = {
      ...job,
      status: "completed" as GenerationStatus,
      progress: 100,
      message: `${asset.name} added to the project${result.note ? ` · ${result.note}` : ""}`,
      assetId: asset.id,
      providerJobId: result.providerJobId ?? job.providerJobId,
      modelId: result.modelId,
      costChargedUsd: charged,
      licence: result.licence,
      finishedAt: now(),
      updatedAt: now(),
    };
    db.generations = upsertJob(db.generations, finished);
    return finished;
  });

  return { job: completed, asset };
}
