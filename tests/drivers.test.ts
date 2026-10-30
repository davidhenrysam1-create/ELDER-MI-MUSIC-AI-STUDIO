import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { localBlobStore, localSnapshotStore } from "@/lib/server/drivers/local";
import { supabaseBlobStore, supabaseSnapshotStore } from "@/lib/server/drivers/supabase";
import {
  blobStore,
  databaseDriverChoice,
  driverHealth,
  durableStorage,
  resetDrivers,
  storageDriverChoice,
  storageStatus,
} from "@/lib/server/drivers";

/**
 * Storage drivers.
 *
 * The local driver is exercised against a real temporary directory. The Supabase
 * driver is exercised against a stubbed `fetch` that records the requests — that
 * proves the URLs, headers and revision logic are right, and it is honest about
 * what it does *not* prove: nothing here contacts Supabase, so the live path
 * stays labelled "awaiting configuration" until real credentials exist.
 */

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-drivers-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.STORAGE_DRIVER;
  delete process.env.DATABASE_DRIVER;
  resetDrivers();
});

const bytes = (text: string) => new TextEncoder().encode(text);

describe("local driver", () => {
  it("writes, reads, overwrites and deletes one object", async () => {
    const store = localBlobStore(path.join(tmpDir, "blobs-a"));
    expect(await store.get("audio/a1.wav")).toBeNull();

    await store.put("audio/a1.wav", bytes("first"));
    expect((await store.get("audio/a1.wav"))?.data.toString()).toBe("first");
    expect(await store.exists("audio/a1.wav")).toBe(true);

    await store.put("audio/a1.wav", bytes("second")); // overwrite in place
    expect((await store.get("audio/a1.wav"))?.data.toString()).toBe("second");

    await store.remove("audio/a1.wav");
    expect(await store.get("audio/a1.wav")).toBeNull();
    // Deleting twice is not an error.
    await expect(store.remove("audio/a1.wav")).resolves.toBeUndefined();
  });

  it("refuses a key that would escape the data directory", async () => {
    const store = localBlobStore(path.join(tmpDir, "blobs-b"));
    await expect(store.put("../secrets.txt", bytes("no"))).rejects.toThrow(/unsafe/i);
  });

  it("meters audio and exports separately", async () => {
    const store = localBlobStore(path.join(tmpDir, "blobs-c"));
    await store.put("audio/one.wav", bytes("12345"));
    await store.put("exports/two.wav", bytes("123"));
    expect(await store.usage()).toEqual({ audioBytes: 5, exportBytes: 3 });
  });

  it("loads a snapshot, saves it atomically, and starts empty when absent", async () => {
    const file = path.join(tmpDir, "store-a", "db.json");
    const store = localSnapshotStore(file);
    expect(await store.load()).toBeNull();

    await store.save({ version: 3, projects: [{ id: "p1" }] });
    expect(await store.load()).toEqual({ version: 3, projects: [{ id: "p1" }] });

    await store.save({ version: 3, projects: [] });
    expect(await store.load()).toEqual({ version: 3, projects: [] });
  });
});

/* ------------------------------------------------------------------ */
/* Supabase — against a stubbed fetch                                  */
/* ------------------------------------------------------------------ */

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/** Install a fake Supabase that answers the endpoints the driver uses. */
function stubSupabase(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: (init?.method ?? "GET").toUpperCase(),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    return handler(call);
  });
  return calls;
}

const CONFIG = {
  url: "https://project.supabase.co",
  key: "service-role-key",
  bucket: "studio-audio",
  table: "studio_docs",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Supabase blob driver", () => {
  it("uploads with the service key and upsert header, to the exact object path", async () => {
    const calls = stubSupabase(() => json({ Key: "studio-audio/audio/a1.wav" }));
    const store = supabaseBlobStore(CONFIG);

    await store.put("audio/a1.wav", bytes("abc"), "audio/wav");

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://project.supabase.co/storage/v1/object/studio-audio/audio/a1.wav");
    expect(calls[0].headers.Authorization).toBe("Bearer service-role-key");
    expect(calls[0].headers["x-upsert"]).toBe("true");
    expect(calls[0].headers["Content-Type"]).toBe("audio/wav");
  });

  it("reads bytes back, and reports a missing object as null rather than empty", async () => {
    stubSupabase(() => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const store = supabaseBlobStore(CONFIG);
    const found = await store.get("audio/a1.wav");
    expect(found?.data.equals(Buffer.from([1, 2, 3]))).toBe(true);

    vi.unstubAllGlobals();
    stubSupabase(() => json({ message: "Object not found" }, 400));
    resetDrivers();
    expect(await supabaseBlobStore(CONFIG).get("audio/missing.wav")).toBeNull();
  });

  it("surfaces a real failure instead of masking it as 'missing'", async () => {
    stubSupabase(() => json({ message: "Invalid JWT" }, 401));
    await expect(supabaseBlobStore(CONFIG).get("audio/a1.wav")).rejects.toThrow(/401/);
  });

  it("treats deleting something already gone as success", async () => {
    stubSupabase(() => json({ message: "Object not found" }, 404));
    await expect(supabaseBlobStore(CONFIG).remove("audio/a1.wav")).resolves.toBeUndefined();
  });

  it("meters by listing each prefix", async () => {
    stubSupabase((call) => {
      const request = JSON.parse(call.body ?? "{}") as { prefix?: string };
      return json(
        request.prefix === "audio"
          ? [{ metadata: { size: 10 } }, { metadata: { size: 5 } }]
          : [{ metadata: { size: 2 } }],
      );
    });
    expect(await supabaseBlobStore(CONFIG).usage()).toEqual({ audioBytes: 15, exportBytes: 2 });
  });
});

describe("Supabase snapshot driver", () => {
  it("loads the single row's document", async () => {
    stubSupabase(() => json([{ body: { version: 3, projects: [] }, rev: 7 }]));
    expect(await supabaseSnapshotStore(CONFIG).load()).toEqual({ version: 3, projects: [] });
  });

  it("returns null for an empty table", async () => {
    stubSupabase(() => json([]));
    expect(await supabaseSnapshotStore(CONFIG).load()).toBeNull();
  });

  it("inserts the row on the first write of a process", async () => {
    const calls = stubSupabase(() => json([{ id: "studio", rev: 1 }]));
    await supabaseSnapshotStore(CONFIG).save({ version: 3 });

    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://project.supabase.co/rest/v1/studio_docs");
    expect(calls[0].headers.Prefer).toContain("merge-duplicates");
    expect(JSON.parse(calls[0].body ?? "[]")).toEqual([{ id: "studio", body: { version: 3 }, rev: 1 }]);
  });

  it("updates conditionally on the revision it last saw", async () => {
    const calls = stubSupabase((call) => {
      if (call.method === "GET") return json([{ body: { version: 3 }, rev: 4 }]);
      return json([{ rev: 5 }]);
    });
    const store = supabaseSnapshotStore(CONFIG);
    await store.load();
    await store.save({ version: 3, projects: [{ id: "p1" }] });

    const patch = calls.find((call) => call.method === "PATCH")!;
    expect(patch.url).toContain("id=eq.studio");
    expect(patch.url).toContain("rev=eq.4");
    expect(JSON.parse(patch.body ?? "{}").rev).toBe(5);
  });

  it("re-reads and retries when another writer got there first", async () => {
    let attempt = 0;
    const calls = stubSupabase((call) => {
      if (call.method === "GET") {
        attempt += 0; // reads are not counted
        return json([{ body: { version: 3 }, rev: 9 }]);
      }
      attempt += 1;
      // First conditional update matches no rows (someone wrote after us).
      return attempt === 1 ? json([]) : json([{ rev: 10 }]);
    });
    const store = supabaseSnapshotStore(CONFIG);
    await store.load();
    await store.save({ version: 3, projects: [] });

    const patches = calls.filter((call) => call.method === "PATCH");
    expect(patches).toHaveLength(2);
    expect(patches[1].url).toContain("rev=eq.9");
  });
});

describe("driver selection", () => {
  it("stays on this machine until Supabase is configured", () => {
    expect(storageDriverChoice()).toBe("local");
    expect(databaseDriverChoice()).toBe("local");
    expect(storageStatus().blobs.durable).toBe(false);
    expect(storageStatus().blobs.reason).toMatch(/SUPABASE_URL/);
  });

  it("switches to Supabase the moment the credentials exist", () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    resetDrivers();
    expect(storageDriverChoice()).toBe("supabase");
    expect(databaseDriverChoice()).toBe("supabase");
    const status = storageStatus();
    expect(status.blobs.durable).toBe(true);
    expect(status.blobs.label).toContain("studio-audio");
    expect(status.database.label).toContain("studio_docs");
  });

  it("honours an explicit 'local' even when Supabase is configured", () => {
    process.env.STORAGE_DRIVER = "local";
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    resetDrivers();
    expect(storageDriverChoice()).toBe("local");
    expect(storageStatus().blobs.kind).toBe("local");
  });

  it("falls back loudly when Supabase is requested but the key is missing", () => {
    // The exact situation of a half-copied config file: the studio must keep
    // working, and must say out loud that the choice was not honoured.
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.STORAGE_DRIVER = "supabase";
    process.env.DATABASE_DRIVER = "supabase";
    resetDrivers();

    const health = driverHealth();
    expect(health.ok).toBe(false);
    expect(health.blobs.requested).toBe("supabase");
    expect(health.blobs.effective).toBe("local");

    const status = storageStatus();
    expect(status.blobs.kind).toBe("local");
    expect(status.blobs.durable).toBe(false);
    expect(status.warning).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(status.warning).toMatch(/not in Supabase/i);
    // And it really does keep working on disk.
    expect(() => blobStore()).not.toThrow();
    expect(blobStore().kind).toBe("local");
    expect(durableStorage()).toBe(false);
  });

  it("reports healthy once the key arrives", () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.STORAGE_DRIVER = "supabase";
    process.env.DATABASE_DRIVER = "supabase";
    resetDrivers();
    const health = driverHealth();
    expect(health.ok).toBe(true);
    expect(health.blobs.effective).toBe("supabase");
    expect(storageStatus().warning).toBeNull();
    expect(durableStorage()).toBe(true);
  });
});
