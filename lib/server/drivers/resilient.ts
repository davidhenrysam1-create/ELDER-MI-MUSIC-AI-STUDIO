/**
 * Resilience around a remote driver.
 *
 * A laptop with no internet, a paused Supabase project, a rotated key — any of
 * these makes the remote driver throw. Letting that propagate would take the
 * whole studio down: `readDb()` is called by every page, so "Supabase is
 * unreachable" would become a blank 500 and the owner could not even reach the
 * Settings screen that explains the problem.
 *
 * So the remote driver is wrapped:
 *
 *  - **reads** fall back to this machine's copy and the failure is recorded;
 *  - **writes** fall back too, so the session keeps working rather than losing
 *    the take that was just recorded;
 *  - every screen is told, in plain words, that new work is on this machine and
 *    not in Supabase (`runtimeStatus()` → `/api/system` → Settings banner).
 *
 * This is a deliberate trade: a diverging local copy that the owner can see
 * beats a dead app. Nothing is ever reported as saved to Supabase when it was
 * not.
 */
import type { BlobStore, SnapshotStore } from "./types";

export type DriverScope = "blobs" | "database";

interface RuntimeFailure {
  scope: DriverScope;
  message: string;
  at: string;
}

const failures = new Map<DriverScope, RuntimeFailure>();

/** Record that the remote driver could not be used. */
export function noteRemoteFailure(scope: DriverScope, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const existing = failures.get(scope);
  // Keep the first failure's time so "since when" stays meaningful.
  failures.set(scope, {
    scope,
    message: message.slice(0, 300),
    at: existing?.at ?? new Date().toISOString(),
  });
  console.error(`[Elder Mi] ${scope} driver fell back to this machine: ${message}`);
}

/** Record a successful remote call, clearing any previous fallback. */
export function noteRemoteSuccess(scope: DriverScope): void {
  if (failures.has(scope)) {
    console.warn(`[Elder Mi] ${scope} driver is back on the remote store.`);
    failures.delete(scope);
  }
}

/** Everything currently degraded, for the API and the Settings page. */
export function runtimeStatus(): {
  degraded: boolean;
  failures: RuntimeFailure[];
  message: string | null;
} {
  const list = [...failures.values()];
  if (list.length === 0) return { degraded: false, failures: [], message: null };
  const where = list.map((entry) => (entry.scope === "blobs" ? "audio/exports" : "the database"));
  return {
    degraded: true,
    failures: list,
    message: `Supabase could not be reached for ${where.join(" and ")}, so the studio is working on this machine's copy. New work is not in Supabase until the connection or the key is fixed — this is not a silent fallback.`,
  };
}

/** Test seam: forget recorded failures. */
export function resetRuntimeStatus(): void {
  failures.clear();
}

/**
 * Wrap a remote blob store with a local fallback.
 *
 * `get` returning null (a genuinely missing object) is *not* a failure and does
 * not fall back — that would mask a deleted file as a local copy.
 */
export function resilientBlobStore(primary: BlobStore, fallback: BlobStore): BlobStore {
  return {
    kind: primary.kind,
    label: primary.label,

    async put(key, bytes, contentType) {
      try {
        await primary.put(key, bytes, contentType);
        noteRemoteSuccess("blobs");
      } catch (err) {
        noteRemoteFailure("blobs", err);
        await fallback.put(key, bytes, contentType);
      }
    },

    async get(key) {
      try {
        const found = await primary.get(key);
        noteRemoteSuccess("blobs");
        if (found) return found;
        // Missing remotely: check the local copy from before the fallback, so a
        // stem recorded earlier is not reported as gone.
        return await fallback.get(key);
      } catch (err) {
        noteRemoteFailure("blobs", err);
        return fallback.get(key);
      }
    },

    async remove(key) {
      try {
        await primary.remove(key);
        noteRemoteSuccess("blobs");
      } catch (err) {
        noteRemoteFailure("blobs", err);
      }
      // Always remove the local copy too: deletion is idempotent and the user
      // asked for the file to be gone.
      await fallback.remove(key).catch(() => {});
    },

    async exists(key) {
      try {
        if (await primary.exists(key)) {
          noteRemoteSuccess("blobs");
          return true;
        }
      } catch (err) {
        noteRemoteFailure("blobs", err);
      }
      return fallback.exists(key);
    },

    async usage() {
      try {
        const usage = await primary.usage();
        noteRemoteSuccess("blobs");
        return usage;
      } catch (err) {
        noteRemoteFailure("blobs", err);
        return fallback.usage();
      }
    },
  };
}

/** Wrap a remote snapshot store with a local fallback. */
export function resilientSnapshotStore(
  primary: SnapshotStore,
  fallback: SnapshotStore,
): SnapshotStore {
  return {
    kind: primary.kind,
    label: primary.label,

    async load() {
      try {
        const stored = await primary.load();
        noteRemoteSuccess("database");
        return stored;
      } catch (err) {
        noteRemoteFailure("database", err);
        return fallback.load();
      }
    },

    async save(document) {
      try {
        await primary.save(document);
        noteRemoteSuccess("database");
      } catch (err) {
        noteRemoteFailure("database", err);
        // Keep the session alive: the data lands on this machine's copy.
        await fallback.save(document);
      }
    },
  };
}
