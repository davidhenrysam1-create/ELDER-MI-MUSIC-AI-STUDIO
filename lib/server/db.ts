import { promises as fs } from "node:fs";
import path from "node:path";
import type { Database, StudioSettings } from "@/lib/types";
import { DEFAULT_LIMITS } from "@/lib/types";
import { defaultMixState, defaultVocalState, DEFAULT_MASTER_CONTROLS } from "@/lib/projects";
import { PROMPT_SEEDS } from "@/lib/types";
import { blobStore, dataDir, snapshotStore } from "@/lib/server/drivers";

const defaultMasterPrompt = PROMPT_SEEDS.mastering;

/**
 * Minimal, dependency-free JSON store for the studio.
 *
 * - Writes are atomic (temp file + rename) so a crash cannot corrupt the DB.
 * - Mutations are serialised through a promise chain.
 * - Audio binaries live in `.data/audio`, exports in `.data/exports` — or in a
 *   private Supabase bucket when that is configured.
 *
 * **Where the data lives is a driver, not a rewrite.** The local file store is
 * the default; set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and the same
 * `readDb()` / `mutateDb()` calls read and write one row in Postgres instead
 * (see `lib/server/drivers`). No route handler knows the difference.
 */

const DATA_DIR = dataDir();

const DB_PATH = path.join(DATA_DIR, "db.json");
const AUDIO_DIR = path.join(DATA_DIR, "audio");
const EXPORT_DIR = path.join(DATA_DIR, "exports");

export const defaultSettings: StudioSettings = {
  // Paid generation is opt-in: with a key present but this off, no billable
  // call is ever made.
  allowPaidGeneration: false,
  // Conservative default ceiling for the studio's own spend tracker.
  spendCapUsd: Number(process.env.SPEND_CAP_USD ?? 5),
  defaultExportFormat: "wav24",
  dither16Bit: true,
  autoSave: true,
  processingQuality: "balanced",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_LIMITS.maxUploadMb),
  maxDurationSec: Number(process.env.MAX_DURATION_SEC ?? DEFAULT_LIMITS.maxDurationSec),
};

const emptyDb = (): Database => ({
  version: 3,
  users: [],
  sessions: [],
  shares: [],
  releases: [],
  follows: [],
  likes: [],
  projects: [],
  exports: [],
  voiceProfiles: [],
  generations: [],
  spend: { lifetimeUsd: 0 },
  settings: { ...defaultSettings },
});

let cache: Database | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function ensureDirs() {
  // Only meaningful for the filesystem driver; a remote bucket needs no folders.
  if (snapshotStore().kind === "supabase" && blobStore().kind === "supabase") return;
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.mkdir(EXPORT_DIR, { recursive: true });
}

export async function storagePaths() {
  await ensureDirs();
  return { DATA_DIR, AUDIO_DIR, EXPORT_DIR, DB_PATH };
}

export async function readDb(): Promise<Database> {
  if (cache) return cache;
  await ensureDirs();
  const stored = await snapshotStore().load();
  if (stored && typeof stored === "object") {
    const parsed = stored as Database;
    parsed.settings = { ...defaultSettings, ...parsed.settings };
    migrate(parsed);
    cache = parsed;
    return cache;
  }
  // Nothing stored yet (a new laptop, an empty bucket, or a corrupt file the
  // driver has already set aside): start from an empty studio and write it.
  cache = emptyDb();
  await persist(cache);
  return cache;
}

/** Fill in fields introduced after a project was first saved. */
function migrate(db: Database) {
  db.projects = (db.projects ?? []).map((p) => {
    const mix = defaultMixState();
    const vocal = defaultVocalState();
    return {
      ...p,
      assets: p.assets ?? [],
      tracks: (p.tracks ?? []).map((t) => ({
        ...t,
        compRatio: t.compRatio ?? 2.5,
        width: t.width ?? 1,
        groupId: t.groupId ?? "music",
        color: t.color ?? "#A1A1B5",
      })),
      versions: p.versions ?? [],
      jobs: p.jobs ?? [],
      mix: {
        ...mix,
        ...p.mix,
        groups:
          Array.isArray(p.mix?.groups) && p.mix.groups.length ? p.mix.groups : mix.groups,
        recommendations: p.mix?.recommendations ?? [],
        lastMixEngineNotes: p.mix?.lastMixEngineNotes ?? [],
      },
      vocal: { ...vocal, ...p.vocal },
      mastering: {
        prompt: p.mastering?.prompt ?? defaultMasterPrompt,
        improvedPrompt: p.mastering?.improvedPrompt ?? null,
        improvedBy: p.mastering?.improvedBy ?? null,
        sourceAssetId: p.mastering?.sourceAssetId ?? null,
        profileId: p.mastering?.profileId ?? "streaming",
        controls: { ...DEFAULT_MASTER_CONTROLS, ...p.mastering?.controls },
        sourceAnalysis: p.mastering?.sourceAnalysis ?? null,
        lastAnalysis: p.mastering?.lastAnalysis ?? null,
        lastMasterAssetId: p.mastering?.lastMasterAssetId ?? null,
        loudnessMatched: p.mastering?.loudnessMatched ?? true,
        outputSampleRate: p.mastering?.outputSampleRate ?? 48000,
        outputBitDepth: p.mastering?.outputBitDepth ?? 24,
        lastRenderNotes: p.mastering?.lastRenderNotes ?? [],
        lastAppliedStages: p.mastering?.lastAppliedStages ?? [],
      },
    };
  });
  db.exports = db.exports ?? [];
  db.voiceProfiles = db.voiceProfiles ?? [];
  // Accounts, sessions and share links were added in version 2. Existing
  // projects keep `ownerId: null` and are claimed by the first account.
  db.users = db.users ?? [];
  db.sessions = (db.sessions ?? []).filter((session) => Boolean(session?.userId));
  db.shares = db.shares ?? [];
  db.projects = db.projects.map((p) => ({ ...p, ownerId: p.ownerId ?? null }));
  db.exports = db.exports.map((e) => ({ ...e, ownerId: e.ownerId ?? null }));
  db.voiceProfiles = db.voiceProfiles.map((v) => ({ ...v, ownerId: v.ownerId ?? null }));
  // Generation jobs and the spend ledger were added later; backfill them so an
  // older database keeps working without a manual migration.
  db.generations = (db.generations ?? []).map((job) => ({
    ...job,
    negativePrompt: job.negativePrompt ?? null,
    providerJobId: job.providerJobId ?? null,
    assetId: job.assetId ?? null,
    costEstimateUsd: job.costEstimateUsd ?? 0,
    costChargedUsd: job.costChargedUsd ?? 0,
    progress: job.progress ?? 0,
    message: job.message ?? "",
    licence: job.licence ?? "",
  }));
  db.spend = { lifetimeUsd: db.spend?.lifetimeUsd ?? 0 };
  // Publishing was added in version 3. An older database simply starts with
  // nothing published, which is the safe default: no release, no public page.
  db.releases = (db.releases ?? []).map((release) => ({
    ...release,
    description: release.description ?? "",
    allowDownload: release.allowDownload === true,
    visibility: release.visibility === "unlisted" ? "unlisted" : "public",
    plays: release.plays ?? 0,
    downloads: release.downloads ?? 0,
  }));
  db.follows = (db.follows ?? []).filter(
    (follow) => follow?.followerId && follow?.followingId && follow.followerId !== follow.followingId,
  );
  db.likes = (db.likes ?? []).filter((like) => like?.userId && like?.releaseId);
}

async function persist(db: Database) {
  await ensureDirs();
  await snapshotStore().save(db);
}

/** Run a serialised mutation. The callback may mutate the draft in place. */
export function mutateDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await persist(db);
    return result;
  });
  // Keep the chain alive even if this mutation rejects.
  queue = run.catch(() => {});
  return run;
}

export function invalidateCache() {
  cache = null;
}

export async function storageUsage() {
  // The driver knows where the bytes are; the meter follows it instead of
  // assuming a directory exists.
  return blobStore().usage();
}

export { AUDIO_DIR, EXPORT_DIR, DATA_DIR };
