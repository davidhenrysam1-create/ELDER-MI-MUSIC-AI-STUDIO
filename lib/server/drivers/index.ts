/**
 * Driver selection and honest reporting.
 *
 * The rule: **credentials decide**. Paste `SUPABASE_URL` and a service-role key
 * and the studio starts using durable storage on the next restart — no code
 * change, no migration command. Without them everything stays on this machine's
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
import path from "node:path";
import type { BlobStore, DriverStatus, SnapshotStore } from "./types";
import { localBlobStore, localSnapshotStore } from "./local";
import { supabaseBlobStore, supabaseSnapshotStore, type SupabaseConfig } from "./supabase";

export type { BlobStore, DriverStatus, SnapshotStore } from "./types";

/** Where the JSON database and audio live when the filesystem driver is used. */
export function dataDir(): string {
  return process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), ".data");
}

function serviceKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    ""
  );
}

/** The Supabase settings, or null when they are not all present. */
export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = serviceKey();
  if (!url || !key) return null;
  return {
    url,
    key,
    bucket: process.env.SUPABASE_BUCKET?.trim() || "studio-audio",
    table: process.env.SUPABASE_TABLE?.trim() || "studio_docs",
  };
}

/** Why Supabase is not in use, in words the owner can act on. */
function missingReason(): string {
  if (!process.env.SUPABASE_URL?.trim() && !serviceKey()) {
    return "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to keep audio and the database off this machine.";
  }
  if (!process.env.SUPABASE_URL?.trim()) return "SUPABASE_URL is missing.";
  return "SUPABASE_SERVICE_ROLE_KEY is missing.";
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
  if (choice === "supabase" && config) {
    blobCache = supabaseBlobStore(config);
  } else {
    blobCache = localBlobStore(dataDir());
  }
  return blobCache;
}

/** The database the studio reads and writes. */
export function snapshotStore(): SnapshotStore {
  if (snapshotCache) return snapshotCache;
  const choice = databaseDriverHealth().effective;
  const config = supabaseConfig();
  if (choice === "supabase" && config) {
    snapshotCache = supabaseSnapshotStore(config);
  } else {
    snapshotCache = localSnapshotStore(path.join(dataDir(), "db.json"));
  }
  return snapshotCache;
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
  return {
    blobs: { ...blobs, warning: blobHealth.warning },
    database: { ...database, warning: dbHealth.warning },
    warning: blobHealth.warning ?? dbHealth.warning,
  };
}

/** True when audio and the database both actually leave this machine. */
export function durableStorage(): boolean {
  return storageDriverHealth().effective === "supabase" && databaseDriverHealth().effective === "supabase";
}
