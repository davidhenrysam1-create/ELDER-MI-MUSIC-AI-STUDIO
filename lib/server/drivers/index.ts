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
 * forces the filesystem, `supabase` refuses to fall back silently).
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

let blobCache: BlobStore | null = null;
let snapshotCache: SnapshotStore | null = null;

/** The blob store every audio/export read and write goes through. */
export function blobStore(): BlobStore {
  if (blobCache) return blobCache;
  const choice = storageDriverChoice();
  const config = supabaseConfig();
  if (choice === "supabase") {
    if (!config) {
      throw new Error(
        `STORAGE_DRIVER=supabase but Supabase is not configured. ${missingReason()}`,
      );
    }
    blobCache = supabaseBlobStore(config);
  } else {
    blobCache = localBlobStore(dataDir());
  }
  return blobCache;
}

/** The database the studio reads and writes. */
export function snapshotStore(): SnapshotStore {
  if (snapshotCache) return snapshotCache;
  const choice = databaseDriverChoice();
  const config = supabaseConfig();
  if (choice === "supabase") {
    if (!config) {
      throw new Error(
        `DATABASE_DRIVER=supabase but Supabase is not configured. ${missingReason()}`,
      );
    }
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

/** What the Settings page and the API report about durability. */
export function storageStatus(): { blobs: DriverStatus; database: DriverStatus } {
  const blobsChoice = storageDriverChoice();
  const dbChoice = databaseDriverChoice();
  const blobsLabel = blobsChoice === "supabase" ? blobStore().label : "This machine's disk (.data)";
  const dbLabel =
    dbChoice === "supabase" ? snapshotStore().label : "This machine's disk (.data/db.json)";
  return {
    blobs: statusFor(blobsChoice, blobsLabel, "STORAGE_DRIVER"),
    database: statusFor(dbChoice, dbLabel, "DATABASE_DRIVER"),
  };
}

/** True when audio and the database both leave this machine. */
export function durableStorage(): boolean {
  return storageDriverChoice() === "supabase" && databaseDriverChoice() === "supabase";
}
