/**
 * Copy this machine's studio up to the remote store.
 *
 * Everything recorded before Supabase was configured is in `.data/`. Switching
 * the driver does not move those files — the studio would simply start empty and
 * the old music would sit unread on the disk. This walks the local directory and
 * writes each object through the *configured* driver, so the same code path that
 * serves audio afterwards is the one that moved it.
 *
 * Three rules, because this touches someone's only copy of a song:
 *
 *  1. **Dry run by default at the API level.** The caller must ask for the real
 *     copy explicitly; the first call always reports what *would* happen.
 *  2. **Read-only on the source.** Nothing under `.data/` is moved or deleted —
 *     if the copy half-fails, the originals are still there.
 *  3. **Per-file failures are reported, not fatal.** One unreadable stem must not
 *     stop the other forty from being copied.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  dataDir,
  databaseDriverHealth,
  rawBlobStore,
  rawSnapshotStore,
  storageDriverHealth,
} from "./drivers";
import { localBlobStore, localSnapshotStore } from "./drivers/local";
import { mimeForExtension } from "./storage";

export interface FileResult {
  key: string;
  bytes: number;
  ok: boolean;
  error?: string;
}

export interface MigrationReport {
  /** True when nothing was written; the counts describe what would be copied. */
  dryRun: boolean;
  /** Set when the copy cannot run at all (target is already the local disk). */
  blocked: string | null;
  files: FileResult[];
  totalBytes: number;
  database: { copied: boolean; detail: string };
}

/** `audio/<name>` and `exports/<name>` from this machine's data directory. */
async function localKeys(): Promise<{ key: string; bytes: number }[]> {
  const root = dataDir();
  const out: { key: string; bytes: number }[] = [];
  for (const folder of ["audio", "exports"]) {
    const dir = path.join(root, folder);
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      continue; // that folder was never used: not an error
    }
    for (const name of names) {
      const full = path.join(dir, name);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat?.isFile()) continue;
      out.push({ key: `${folder}/${name}`, bytes: stat.size });
    }
  }
  return out;
}

/** Extension for the Content-Type header, falling back to a generic type. */
function contentTypeFor(key: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(key);
  return match ? mimeForExtension(match[1].toLowerCase()) : "application/octet-stream";
}

/**
 * Copy every local object and the database to the configured driver.
 *
 * `dryRun` reports what would move without writing anything.
 */
export async function migrateToRemote(dryRun: boolean): Promise<MigrationReport> {
  // Raw drivers on purpose: the resilient wrapper would swallow an upload
  // failure and write locally instead, so the report would claim success while
  // nothing reached Supabase.
  const blobs = rawBlobStore();
  const database = rawSnapshotStore();

  // Nothing to do if the target *is* this machine — say so instead of copying a
  // directory onto itself.
  if (storageDriverHealth().effective === "local" && databaseDriverHealth().effective === "local") {
    return {
      dryRun,
      blocked:
        "Both drivers are still set to this machine's disk. Configure SUPABASE_URL and SUPABASE_SECRET_KEY and restart before copying.",
      files: [],
      totalBytes: 0,
      database: { copied: false, detail: "Not attempted: the database driver is local." },
    };
  }

  if (!blobs || !database) {
    return {
      dryRun,
      blocked:
        "Supabase is not configured, so there is nowhere to copy to. Set SUPABASE_URL and SUPABASE_SECRET_KEY, then restart.",
      files: [],
      totalBytes: 0,
      database: { copied: false, detail: "Not attempted: Supabase is not configured." },
    };
  }

  const keys = await localKeys();
  const totalBytes = keys.reduce((sum, entry) => sum + entry.bytes, 0);
  const source = localBlobStore(dataDir());
  const files: FileResult[] = [];

  for (const entry of keys) {
    if (dryRun) {
      files.push({ key: entry.key, bytes: entry.bytes, ok: true });
      continue;
    }
    try {
      const found = await source.get(entry.key);
      if (!found) {
        files.push({ key: entry.key, bytes: entry.bytes, ok: false, error: "vanished from disk" });
        continue;
      }
      await blobs.put(entry.key, found.data, contentTypeFor(entry.key));
      files.push({ key: entry.key, bytes: found.data.byteLength, ok: true });
    } catch (err) {
      files.push({
        key: entry.key,
        bytes: entry.bytes,
        ok: false,
        error: (err as Error).message.slice(0, 200),
      });
    }
  }

  // The database goes up whatever happens to the audio: an empty studio that can
  // still list its projects is better than neither.
  let databaseResult = { copied: false, detail: "Nothing stored locally yet." };
  if (databaseDriverHealth().effective !== "local") {
    try {
      const document = await localSnapshotStore(path.join(dataDir(), "db.json")).load();
      if (!document) {
        databaseResult = { copied: false, detail: "No local db.json to copy." };
      } else if (dryRun) {
        databaseResult = { copied: false, detail: "Would copy this machine's db.json." };
      } else {
        await database.save(document);
        databaseResult = { copied: true, detail: "Copied this machine's db.json." };
      }
    } catch (err) {
      databaseResult = { copied: false, detail: (err as Error).message.slice(0, 200) };
    }
  }

  return { dryRun, blocked: null, files, totalBytes, database: databaseResult };
}
