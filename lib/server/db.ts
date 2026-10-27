import { promises as fs } from "node:fs";
import path from "node:path";
import type { Database, StudioSettings } from "@/lib/types";
import { DEFAULT_LIMITS } from "@/lib/types";
import { defaultMixState, defaultVocalState, DEFAULT_MASTER_CONTROLS } from "@/lib/projects";
import { PROMPT_SEEDS } from "@/lib/types";

const defaultMasterPrompt = PROMPT_SEEDS.mastering;

/**
 * Minimal, dependency-free JSON store for the studio.
 *
 * - Writes are atomic (temp file + rename) so a crash cannot corrupt the DB.
 * - Mutations are serialised through a promise chain.
 * - Audio binaries live in `.data/audio`, exports in `.data/exports`.
 *
 * For a multi-user deployment swap this module for Postgres/Supabase; every
 * caller talks to the same repository functions.
 */

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), ".data");

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
  version: 2,
  users: [],
  sessions: [],
  shares: [],
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
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as Database;
    parsed.settings = { ...defaultSettings, ...parsed.settings };
    migrate(parsed);
    cache = parsed;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      // Corrupt file: keep it for forensics rather than silently overwriting.
      if (err instanceof SyntaxError) {
        await fs.rename(DB_PATH, `${DB_PATH}.corrupt-${Date.now()}`).catch(() => {});
      }
    }
    cache = emptyDb();
    await persist(cache);
  }
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
}

async function persist(db: Database) {
  await ensureDirs();
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_PATH);
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
  const { AUDIO_DIR: a, EXPORT_DIR: e } = await storagePaths();
  const sum = async (dir: string) => {
    try {
      const files = await fs.readdir(dir, { withFileTypes: true });
      let bytes = 0;
      for (const f of files) {
        if (!f.isFile()) continue;
        const st = await fs.stat(path.join(dir, f.name));
        bytes += st.size;
      }
      return bytes;
    } catch {
      return 0;
    }
  };
  return { audioBytes: await sum(a), exportBytes: await sum(e) };
}

export { AUDIO_DIR, EXPORT_DIR, DATA_DIR };
