/**
 * Driver selection and honest reporting.
 *
 * The rule: **credentials decide**. Paste `SUPABASE_URL` and a secret key and the
 * studio starts using durable storage on the next restart — no code change, no
 * migration command. Both key generations are accepted:
 *
 *  - legacy `service_role` JWTs (`eyJhbGciOi…`) as `SUPABASE_SERVICE_ROLE_KEY`;
 *  - the newer secret keys (`sb_secret_…`) as `SUPABASE_SECRET_KEY`.
 *
 * The publishable/anon key is deliberately **not** accepted for server writes:
 * it is governed by row-level security, so every write would fail with a 401 in
 * production while looking configured. Without them everything stays on this machine's
 * disk, and every screen that mentions storage says so rather than implying the
 * work is backed up.
 *
 * `STORAGE_DRIVER` / `DATABASE_DRIVER` override the automatic choice (`local`
 * forces the filesystem).
 *
 * **Asking for Supabase without the credentials is a loud fallback, not a crash
 * and not a silent lie.** Someone who copies a config file half-filled must still
 * have a working studio, so the drivers stay on this machine's disk — but every
 * screen that mentions storage says, in red, that Supabase was requested and the
 * key was missing (`driverHealth()`), and Settings names the exact variable. A
 * studio that refuses to open is a worse failure than one that tells you what to
 * paste.
 */
import os from "node:os";
import path from "node:path";
import type { BlobStore, DriverStatus, SnapshotStore } from "./types";
import { localBlobStore, localSnapshotStore } from "./local";
import { supabaseBlobStore, supabaseSnapshotStore, type SupabaseConfig } from "./supabase";
import { resilientBlobStore, resilientSnapshotStore, runtimeStatus } from "./resilient";

export { resetRuntimeStatus, runtimeStatus } from "./resilient";

export type { BlobStore, DriverStatus, SnapshotStore } from "./types";

/**
 * True on a platform whose filesystem is temporary (Vercel, Lambda, Cloud Run
 * without a volume). The studio still runs there — it just cannot keep anything
 * on disk, which is exactly what the storage banner has to say.
 */
export function ephemeralFilesystem(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.K_SERVICE || // Cloud Run
      process.env.RENDER, // Render without a disk
  );
}

/**
 * Where the JSON database and audio live when the filesystem driver is used.
 *
 * `DATA_DIR` always wins. Otherwise: a writable temporary directory on a
 * serverless host (writing next to the app there fails with EROFS), and `.data/`
 * beside the app on a laptop, a container or any normal server.
 */
export function dataDir(): string {
  if (process.env.DATA_DIR?.trim()) return path.resolve(process.env.DATA_DIR);
  if (ephemeralFilesystem()) return path.join(os.tmpdir(), "elder-mi-studio");
  return path.join(process.cwd(), ".data");
}

/**
 * A value that is obviously a placeholder, not a credential.
 *
 * Copying a config template and forgetting one line is the commonest setup
 * mistake; treating `paste_your_key_here` as configured would turn it into a
 * confusing 401 on every upload instead of a readable "this is not set yet".
 */
function isPlaceholder(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  return (
    v.includes("paste_") ||
    v.includes("your_") ||
    v === "changeme" ||
    v === "todo" ||
    v === "xxx" ||
    v.startsWith("<")
  );
}

/**
 * The server-side secret, whichever generation of key was supplied.
 *
 * `sb_secret_…` (new) and `service_role` JWTs (legacy) are used identically:
 * in the `apikey` header and as a bearer token. The publishable key is never
 * returned here, on purpose.
 */
function secretKey(): string {
  const candidates = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim() ?? "";
    if (value && !isPlaceholder(value)) return value;
  }
  return "";
}

/** True when a publishable/anon key was supplied where a secret one belongs. */
function onlyPublishableKey(): boolean {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || "";
  return Boolean(publishable && !isPlaceholder(publishable) && !secretKey());
}

/** The Supabase settings, or null when they are not all present. */
export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = secretKey();
  // A URL left as a template value counts as missing too.
  if (!url || isPlaceholder(url) || !key) return null;
  return {
    url,
    key,
    bucket: process.env.SUPABASE_BUCKET?.trim() || "studio-audio",
    table: process.env.SUPABASE_TABLE?.trim() || "studio_docs",
  };
}

/** Why Supabase is not in use, in words the owner can act on. */
function missingReason(): string {
  const hasUrl = Boolean(process.env.SUPABASE_URL?.trim()) && !isPlaceholder(process.env.SUPABASE_URL ?? "");
  if (!hasUrl && !secretKey()) {
    return "Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to keep audio and the database off this machine.";
  }
  if (!hasUrl) return "SUPABASE_URL is missing or still a placeholder.";
  if (onlyPublishableKey()) {
    return "Only the publishable key was supplied; the server needs the secret key (sb_secret_…) to write audio and the database.";
  }
  return "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing or still a placeholder.";
}

export type DriverChoice = "local" | "supabase";

function choose(envValue: string | undefined): DriverChoice {
  const explicit = (envValue ?? "").trim().toLowerCase();
  if (explicit === "local") return "local";
  if (explicit === "supabase") return "supabase";
  // Default ("auto"): use durable storage as soon as it is configured.
  return supabaseConfig() ? "supabase" : "local";
}

export function storageDriverChoice(): DriverChoice {
  return choose(process.env.STORAGE_DRIVER);
}

export function databaseDriverChoice(): DriverChoice {
  return choose(process.env.DATABASE_DRIVER);
}

/**
 * What the configuration asked for vs what can actually run.
 *
 * `requested` is the env choice, `effective` is the driver in use. They differ
 * only when Supabase was requested without credentials, which is exactly the
 * situation a red banner has to explain.
 */
export interface DriverHealth {
  ok: boolean;
  requested: DriverChoice;
  effective: DriverChoice;
  /** Set when the request could not be honoured; the sentence to show a human. */
  warning: string | null;
}

function healthFor(envName: string): DriverHealth {
  const requested = choose(process.env[envName]);
  const configured = supabaseConfig() !== null;
  if (requested === "supabase" && !configured) {
    return {
      ok: false,
      requested,
      effective: "local",
      warning: `${envName}=supabase was requested, but ${missingReason()} Until it is set, audio and projects are saved on this machine's disk — not in Supabase.`,
    };
  }
  return { ok: true, requested, effective: requested, warning: null };
}

export function storageDriverHealth(): DriverHealth {
  return healthFor("STORAGE_DRIVER");
}

export function databaseDriverHealth(): DriverHealth {
  return healthFor("DATABASE_DRIVER");
}

/** Health of both seams — what `/api/system` and Settings show. */
export function driverHealth(): { blobs: DriverHealth; database: DriverHealth; ok: boolean } {
  const blobs = storageDriverHealth();
  const database = databaseDriverHealth();
  return { blobs, database, ok: blobs.ok && database.ok };
}

let blobCache: BlobStore | null = null;
let snapshotCache: SnapshotStore | null = null;

/** The blob store every audio/export read and write goes through. */
export function blobStore(): BlobStore {
  if (blobCache) return blobCache;
  // `effective`, not `requested`: a half-filled config keeps the studio usable
  // and reports the problem through `driverHealth()`.
  const choice = storageDriverHealth().effective;
  const config = supabaseConfig();
  const local = localBlobStore(dataDir());
  if (choice === "supabase" && config) {
    // Remote first, this machine's copy when the network or the key fails: an
    // unreachable bucket must not stop someone recording.
    blobCache = resilientBlobStore(supabaseBlobStore(config), local);
  } else {
    blobCache = local;
  }
  return blobCache;
}

/** The database the studio reads and writes. */
export function snapshotStore(): SnapshotStore {
  if (snapshotCache) return snapshotCache;
  const choice = databaseDriverHealth().effective;
  const config = supabaseConfig();
  const local = localSnapshotStore(path.join(dataDir(), "db.json"));
  if (choice === "supabase" && config) {
    snapshotCache = resilientSnapshotStore(supabaseSnapshotStore(config), local);
  } else {
    snapshotCache = local;
  }
  return snapshotCache;
}

/**
 * The raw remote drivers, without the resilience wrapper.
 *
 * Used by the connection test and by the migration: both must report the truth
 * about Supabase. A migration that "succeeded" by quietly writing to this
 * machine's disk would be worse than one that fails, and a connection test that
 * passed on a fallback would be a lie.
 */
export function rawBlobStore(): BlobStore | null {
  const config = supabaseConfig();
  return config ? supabaseBlobStore(config) : null;
}

export function rawSnapshotStore(): SnapshotStore | null {
  const config = supabaseConfig();
  return config ? supabaseSnapshotStore(config) : null;
}

/** Forget memoised drivers (tests change the environment between cases). */
export function resetDrivers(): void {
  blobCache = null;
  snapshotCache = null;
}

function statusFor(kind: DriverChoice, label: string, envName: string): DriverStatus {
  if (kind === "supabase") {
    return {
      kind,
      label,
      durable: true,
      reason: "Stored by Supabase, so it survives a redeploy, a reset container or a new laptop.",
    };
  }
  if (ephemeralFilesystem()) {
    return {
      kind,
      label,
      durable: false,
      // A hosting platform's filesystem is temporary: saying "this machine" would
      // hide the fact that the data is gone on the next restart.
      reason: `${missingReason()} This host's filesystem is temporary, so anything saved here disappears on the next deploy or restart. Configure Supabase before adding real music.`,
    };
  }
  return {
    kind,
    label,
    durable: false,
    reason: `${missingReason()} Until then this stays on the machine running the studio — back it up before moving hosts. Force it with ${envName}=local.`,
  };
}

/**
 * What the Settings page and the API report about durability.
 *
 * `warning` is the part that must never be dropped on the floor: it says that a
 * Supabase driver was asked for and could not be started, so nobody reads
 * "local" and assumes the choice was honoured.
 */
export function storageStatus(): {
  blobs: DriverStatus & { warning: string | null };
  database: DriverStatus & { warning: string | null };
  warning: string | null;
} {
  const blobHealth = storageDriverHealth();
  const dbHealth = databaseDriverHealth();
  const blobs = statusFor(blobHealth.effective, blobStore().label, "STORAGE_DRIVER");
  const database = statusFor(dbHealth.effective, snapshotStore().label, "DATABASE_DRIVER");
  const runtime = runtimeStatus();
  return {
    blobs: { ...blobs, warning: blobHealth.warning },
    database: { ...database, warning: dbHealth.warning },
    // A configured remote store that cannot be reached is *also* a warning, and
    // a louder one: data is being written somewhere other than asked.
    warning: runtime.message ?? blobHealth.warning ?? dbHealth.warning,
  };
}

/** True when audio and the database both actually leave this machine. */
export function durableStorage(): boolean {
  // Configured *and* currently reachable: a degraded fallback is not durable.
  return (
    storageDriverHealth().effective === "supabase" &&
    databaseDriverHealth().effective === "supabase" &&
    !runtimeStatus().degraded
  );
}
