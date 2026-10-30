/**
 * Local filesystem drivers — the default.
 *
 * Same behaviour the studio always had: objects under `DATA_DIR`, writes atomic
 * through a temp file and a rename so a crash mid-write cannot leave a truncated
 * stem behind. Extracted here only so the remote driver has a matching shape.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BlobStore, SnapshotStore } from "./types";

/** Reject anything that could escape the data directory. */
function safeKey(key: string): string {
  const normalised = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalised || normalised.split("/").some((part) => part === ".." || part === "")) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return normalised;
}

export function localBlobStore(dataDir: string): BlobStore {
  const root = path.resolve(dataDir);
  const resolve = (key: string) => path.join(root, safeKey(key));

  const walk = async (dir: string): Promise<number> => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let bytes = 0;
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) bytes += await walk(full);
        else if (entry.isFile()) bytes += (await fs.stat(full)).size;
      }
      return bytes;
    } catch {
      return 0;
    }
  };

  return {
    kind: "local",
    label: "This machine's disk (.data)",

    async put(key, bytes) {
      const file = resolve(key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      // Atomic: write beside the target, then rename over it.
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, bytes);
      await fs.rename(tmp, file);
    },

    async get(key) {
      const file = resolve(key);
      try {
        return { data: await fs.readFile(file), key };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },

    async remove(key) {
      await fs.unlink(resolve(key)).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== "ENOENT") throw err;
      });
    },

    async exists(key) {
      try {
        await fs.access(resolve(key));
        return true;
      } catch {
        return false;
      }
    },

    async usage() {
      return {
        audioBytes: await walk(path.join(root, "audio")),
        exportBytes: await walk(path.join(root, "exports")),
      };
    },
  };
}

export function localSnapshotStore(dbPath: string): SnapshotStore {
  const file = path.resolve(dbPath);

  return {
    kind: "local",
    label: "This machine's disk (.data/db.json)",

    async load() {
      try {
        const raw = await fs.readFile(file, "utf8");
        return JSON.parse(raw) as unknown;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") return null;
        // Corrupt file: keep it for forensics rather than overwriting it.
        if (err instanceof SyntaxError) {
          const stamp = createHash("sha256").update(String(Date.now())).digest("hex").slice(0, 8);
          await fs.rename(file, `${file}.corrupt-${stamp}`).catch(() => {});
          return null;
        }
        throw err;
      }
    },

    async save(document) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(document, null, 2), "utf8");
      await fs.rename(tmp, file);
    },
  };
}
