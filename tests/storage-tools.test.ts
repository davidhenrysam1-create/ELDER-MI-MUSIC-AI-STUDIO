import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { describeSupabaseFailure, testSupabaseConnection } from "@/lib/server/drivers/diagnostics";
import { migrateToRemote } from "@/lib/server/migrate";
import { resetDrivers } from "@/lib/server/drivers";
import { resetRuntimeStatus } from "@/lib/server/drivers/resilient";

/**
 * The two storage tools.
 *
 * The connection test runs against a stubbed Supabase (this sandbox cannot reach
 * the real one), and the copy runs against a stubbed target driver — its job is
 * to prove that every local file is *attempted*, that one failure does not abort
 * the rest, and that the source directory is left untouched.
 */

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-tools-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  delete process.env.SUPABASE_TABLE;
  delete process.env.STORAGE_DRIVER;
  delete process.env.DATABASE_DRIVER;
  delete process.env.DATA_DIR;
  resetDrivers();
  resetRuntimeStatus();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("SQL error messages", () => {
  it("names the mistake behind each status", () => {
    expect(describeSupabaseFailure(401, "bad jwt")).toMatch(/publishable/i);
    expect(describeSupabaseFailure(404, "")).toMatch(/bucket and table names/i);
    expect(describeSupabaseFailure(400, "")).toMatch(/size limit/i);
    expect(describeSupabaseFailure(500, "boom")).toMatch(/500/);
  });
});

describe("connection test", () => {
  it("reports unconfigured rather than pretending to check", async () => {
    const report = await testSupabaseConnection();
    expect(report.configured).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.checks[0].detail).toMatch(/SUPABASE_SECRET_KEY/);
  });

  it("passes when both the bucket and the table answer", async () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
    process.env.SUPABASE_BUCKET = "tracks";
    process.env.SUPABASE_TABLE = "songs";
    vi.stubGlobal("fetch", async () => json([]));

    const report = await testSupabaseConnection();
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.name)).toEqual([
      "Credentials",
      'Storage bucket "tracks"',
      'Database table "songs"',
    ]);
  });

  it("tells the owner which half failed, and why", async () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/storage/v1/")) return json({ message: "Object not found" }, 404);
      return json([], 200);
    });

    const report = await testSupabaseConnection();
    expect(report.ok).toBe(false);
    const storage = report.checks.find((check) => check.name.startsWith("Storage"))!;
    const database = report.checks.find((check) => check.name.startsWith("Database"))!;
    expect(storage.ok).toBe(false);
    expect(storage.detail).toMatch(/bucket and table names/i);
    expect(database.ok).toBe(true);
  });

  it("explains an unreachable project instead of throwing", async () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    const report = await testSupabaseConnection();
    expect(report.ok).toBe(false);
    expect(report.checks[1].detail).toMatch(/Could not reach Supabase/i);
    expect(report.checks[1].detail).toMatch(/paused/i);
  });
});

describe("copying this machine's studio up", () => {
  async function seedDataDir() {
    const dir = path.join(tmpDir, `data-${Math.random().toString(36).slice(2, 8)}`);
    await mkdir(path.join(dir, "audio"), { recursive: true });
    await mkdir(path.join(dir, "exports"), { recursive: true });
    await writeFile(path.join(dir, "audio", "a1.wav"), "aaaa");
    await writeFile(path.join(dir, "audio", "a2.mp3"), "bbb");
    await writeFile(path.join(dir, "exports", "mix.wav"), "cc");
    await writeFile(path.join(dir, "db.json"), JSON.stringify({ version: 3, projects: [] }));
    process.env.DATA_DIR = dir;
    return dir;
  }

  it("refuses when both drivers are still local", async () => {
    await seedDataDir();
    const report = await migrateToRemote(false);
    expect(report.blocked).toMatch(/still set to this machine/i);
    expect(report.files).toHaveLength(0);
  });

  it("lists everything but writes nothing on a dry run", async () => {
    await seedDataDir();
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
    process.env.STORAGE_DRIVER = "supabase";
    process.env.DATABASE_DRIVER = "supabase";
    resetDrivers();

    const puts: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" && String(input).includes("/storage/v1/object/")) {
        puts.push(String(input));
        return json({});
      }
      if (String(input).includes("/rest/v1/")) return json(init?.method === "GET" ? [] : [{ rev: 1 }]);
      return json([]);
    });

    const report = await migrateToRemote(true);
    expect(report.dryRun).toBe(true);
    expect(report.files).toHaveLength(3);
    expect(report.totalBytes).toBe(4 + 3 + 2);
    expect(puts).toHaveLength(0); // nothing uploaded
    expect(report.database.copied).toBe(false);
  });

  it("uploads every file and the database when confirmed", async () => {
    const dir = await seedDataDir();
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
    process.env.SUPABASE_BUCKET = "tracks";
    process.env.SUPABASE_TABLE = "songs";
    process.env.STORAGE_DRIVER = "supabase";
    process.env.DATABASE_DRIVER = "supabase";
    resetDrivers();

    const uploaded: string[] = [];
    let savedBody: string | null = null;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/storage/v1/object/")) {
        uploaded.push(url);
        return json({});
      }
      if (url.includes("/rest/v1/")) {
        if (init?.method === "GET") return json([]); // empty table
        if (init?.method === "POST") savedBody = String(init.body);
        return json([{ rev: 1 }]);
      }
      return json([]);
    });

    const report = await migrateToRemote(false);
    expect(report.blocked).toBeNull();
    expect(report.files.every((file) => file.ok)).toBe(true);
    expect(uploaded).toHaveLength(3);
    expect(uploaded.some((url) => url.endsWith("/tracks/audio/a1.wav"))).toBe(true);
    expect(uploaded.some((url) => url.endsWith("/tracks/exports/mix.wav"))).toBe(true);
    expect(report.database.copied).toBe(true);
    expect(savedBody).toContain("version");

    // The source is read-only: every file is still on disk.
    const still = await import("node:fs/promises").then((fs) => fs.readdir(path.join(dir, "audio")));
    expect(still.sort()).toEqual(["a1.wav", "a2.mp3"]);
  });

  it("keeps going when one file fails, and reports which", async () => {
    await seedDataDir();
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
    // The stub matches on the bucket name, so it must be the one under test.
    process.env.SUPABASE_BUCKET = "tracks";
    process.env.STORAGE_DRIVER = "supabase";
    process.env.DATABASE_DRIVER = "supabase";
    resetDrivers();

    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/tracks/audio/a2.mp3")) return json({ message: "nope" }, 400);
      if (url.includes("/storage/v1/object/")) return json({});
      if (url.includes("/rest/v1/")) return json(init?.method === "GET" ? [] : [{ rev: 1 }]);
      return json([]);
    });

    const report = await migrateToRemote(false);
    const failed = report.files.filter((file) => !file.ok);
    expect(report.files).toHaveLength(3);
    expect(failed).toHaveLength(1);
    expect(failed[0].key).toBe("audio/a2.mp3");
    expect(failed[0].error).toMatch(/400/);
  });
});
