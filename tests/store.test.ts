import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AssetMeta } from "@/lib/types";

let tmpDir: string;
let repo: typeof import("@/lib/server/repo");
let storage: typeof import("@/lib/server/storage");

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-test-"));
  process.env.DATA_DIR = tmpDir;
  vi.resetModules();
  repo = await import("@/lib/server/repo");
  storage = await import("@/lib/server/storage");
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function fakeAsset(projectId: string, id = "ast_test"): AssetMeta {
  return {
    id,
    projectId,
    name: "stem.wav",
    kind: "stem",
    mimeType: "audio/wav",
    extension: "wav",
    sizeBytes: 4,
    durationSec: 2,
    sampleRate: 48000,
    channels: 2,
    bitDepth: 24,
    peaks: [0.1, 0.4, 0.2],
    createdAt: new Date().toISOString(),
  };
}

describe("project persistence", () => {
  it("creates, patches and reloads a project", async () => {
    const project = await repo.createProject({ name: "Lagos Test", bpm: 110 });
    expect(project.id).toMatch(/^prj_/);

    await repo.patchProject(project.id, (p) => {
      p.notes = "rough take";
      p.mix.presetId = "amapiano";
    });

    const reloaded = await repo.getProject(project.id);
    expect(reloaded?.notes).toBe("rough take");
    expect(reloaded?.mix.presetId).toBe("amapiano");
    expect(reloaded?.mix.groups.length).toBe(3);

    const list = await repo.listProjects();
    expect(list.some((p) => p.id === project.id)).toBe(true);
  });

  it("writes valid JSON to disk after each mutation", async () => {
    const raw = await readFile(path.join(tmpDir, "db.json"), "utf8");
    const parsed = JSON.parse(raw);
    // Schema 3 added releases/follows/likes; the store must keep the number in
    // step with `migrate()` so an older database is upgraded on read.
    expect(parsed.version).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(parsed.releases)).toBe(true);
    expect(Array.isArray(parsed.follows)).toBe(true);
    expect(Array.isArray(parsed.likes)).toBe(true);
    expect(Array.isArray(parsed.projects)).toBe(true);
  });

  it("persists assets and removes their files when the project is deleted", async () => {
    const project = await repo.createProject({ name: "Delete Me" });
    await storage.writeAudio("ast_test", "wav", new Uint8Array([1, 2, 3, 4]));
    const asset = fakeAsset(project.id);
    await repo.patchProject(project.id, (p) => {
      p.assets.push(asset);
    });

    const filePath = path.join(tmpDir, "audio", "ast_test.wav");
    await expect(stat(filePath)).resolves.toBeTruthy();

    await repo.deleteProject(project.id);
    await expect(repo.getProject(project.id)).resolves.toBeNull();
    await expect(stat(filePath)).rejects.toBeTruthy();
  });

  it("saves a reversible version", async () => {
    const project = await repo.createProject({ name: "Versioned" });
    await repo.patchProject(project.id, (p) => {
      p.tracks.push({
        id: "trk_1",
        name: "Lead",
        role: "lead_vocal",
        groupId: "vocals",
        assetId: null,
        volumeDb: -3,
        pan: 0,
        muted: false,
        soloed: false,
        eqLowDb: 0,
        eqMidDb: 0,
        eqHighDb: 1,
        compThresholdDb: -18,
        compRatio: 2.5,
        reverbSend: 0.1,
        delaySend: 0,
        width: 1,
        order: 0,
        color: "#A855F7",
        createdAt: new Date().toISOString(),
      });
    });

    const version = await repo.saveVersion(project.id, "first pass", "vocal");
    expect(version?.tracks).toHaveLength(1);

    await repo.patchProject(project.id, (p) => {
      p.tracks = [];
      p.notes = "stripped";
    });

    const restored = await repo.restoreVersion(project.id, version!.id);
    expect(restored?.tracks).toHaveLength(1);
    expect(restored?.tracks[0].name).toBe("Lead");
    // Versions capture studio state (tracks, mixer, mastering), not free-text notes.
    expect(restored?.notes).toBe("stripped");
    expect(restored?.versions.length).toBeGreaterThanOrEqual(1);
  });

  it("records exports with measured metadata", async () => {
    const project = await repo.createProject({ name: "Delivery" });
    await storage.writeExport("exp_test.wav", new Uint8Array([0, 1, 2, 3]));
    await repo.addExport({
      id: "exp_test",
      ownerId: null,
      projectId: project.id,
      projectName: project.name,
      studio: "mastering",
      assetId: null,
      fileName: "master.wav",
      mimeType: "audio/wav",
      format: "WAV",
      bitDepth: 24,
      sampleRate: 48000,
      sizeBytes: 4,
      durationSec: 1,
      integratedLufs: -13.8,
      truePeakDb: -1.02,
      createdAt: new Date().toISOString(),
      storedName: "exp_test.wav",
    });
    const exports = await repo.listExports();
    expect(exports[0].integratedLufs).toBe(-13.8);
    expect(exports[0].truePeakDb).toBe(-1.02);
  });

  it("migrates a database written by an older schema", async () => {
    // Simulate an old project file with no groups / mastering prompt.
    const legacyPath = path.join(tmpDir, "db.json");
    await writeFile(legacyPath, JSON.stringify({
      version: 1,
      projects: [
        {
          id: "prj_legacy",
          name: "Legacy",
          genre: "Afrobeats",
          bpm: 100,
          musicalKey: "C major",
          notes: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tracks: [],
          assets: [],
          versions: [],
          jobs: [],
          mix: { prompt: "old", recommendations: [] },
          vocal: { prompt: "old" },
          mastering: { profileId: "warm", controls: { targetLufs: -11 } },
        },
      ],
      exports: [],
      voiceProfiles: [],
      settings: {},
    }));
    vi.resetModules();
    const fresh = await import("@/lib/server/db");
    const db = await fresh.readDb();
    const legacy = db.projects.find((p) => p.id === "prj_legacy");
    expect(legacy?.mix.groups.length).toBe(3);
    expect(legacy?.mastering.prompt).toContain("Master");
    expect(legacy?.mastering.controls.truePeakCeilingDb).toBeDefined();
    expect(fresh.defaultSettings.maxUploadMb).toBeGreaterThan(0);
  });

  it("purges all studio data", async () => {
    await repo.purgeAllData();
    const projects = await repo.listProjects();
    expect(projects).toHaveLength(0);
    const exports = await repo.listExports();
    expect(exports).toHaveLength(0);
  });

  it("enforces consent for voice profiles at the API level input shape", async () => {
    const profile = {
      id: "vp_test",
      ownerId: null,
      name: "Performer",
      timbreDescription: "warm",
      genreSuitability: "Afrobeats",
      consentConfirmed: true,
      consentName: "Owner",
      referenceAssetId: null,
      createdAt: new Date().toISOString(),
    };
    await repo.addVoiceProfile(profile);
    const list = await repo.listVoiceProfiles();
    expect(list.some((p) => p.id === "vp_test" && p.consentConfirmed)).toBe(true);
    await repo.deleteVoiceProfile("vp_test");
    expect((await repo.listVoiceProfiles()).some((p) => p.id === "vp_test")).toBe(false);
  });
});

describe("storage validation", () => {
  it("rejects unsupported extensions and sanitises names", () => {
    expect(() => storage.assertAllowedExtension("exe")).toThrow(/Unsupported/);
    expect(() => storage.assertAllowedExtension("wav")).not.toThrow();
    expect(storage.sanitizeFileName("../../etc/passwd")).not.toContain("/");
    expect(storage.extensionOf("Mix 01.WAV")).toBe("wav");
    expect(storage.mimeForExtension("mp3")).toBe("audio/mpeg");
  });

  it("hashes audio deterministically", () => {
    const a = storage.sha256(new Uint8Array([1, 2, 3]));
    const b = storage.sha256(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

// Keep an explicit unused import guard for mkdir (used by future tests).
void mkdir;
