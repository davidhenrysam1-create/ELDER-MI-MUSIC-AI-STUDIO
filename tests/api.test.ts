import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Route-handler level tests. They exercise the real HTTP contracts (validation,
 * status codes, persistence) without needing a running server.
 */

let tmpDir: string;
let projectId = "";

let projectsRoute: typeof import("@/app/api/projects/route");
let projectRoute: typeof import("@/app/api/projects/[id]/route");
let assetsRoute: typeof import("@/app/api/projects/[id]/assets/route");
let assetRoute: typeof import("@/app/api/assets/[assetId]/route");
let versionsRoute: typeof import("@/app/api/projects/[id]/versions/route");
let exportsRoute: typeof import("@/app/api/exports/route");
let settingsRoute: typeof import("@/app/api/settings/route");
let promptRoute: typeof import("@/app/api/prompt/improve/route");
let mixRoute: typeof import("@/app/api/mix/recommendations/route");
let profilesRoute: typeof import("@/app/api/voice-profiles/route");

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createProject(name = "API Test") {
  const res = await projectsRoute.POST(
    jsonRequest("/api/projects", { name, genre: "Afrobeats", bpm: 102, musicalKey: "A minor" }),
  );
  const body = (await res.json()) as { project: { id: string } };
  return body.project.id;
}

/**
 * Route handlers now require a signed-in account. These tests run outside a
 * Next.js request scope, so they state the session explicitly through the
 * test-only override instead of forging a cookie.
 */
const TEST_USER = {
  id: "usr_api_test",
  email: "tester@studio.test",
  name: "API Tester",
  role: "owner" as const,
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
};

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-api-"));
  process.env.DATA_DIR = tmpDir;
  vi.resetModules();
  const auth = await import("@/lib/server/auth");
  auth.__setSessionOverrideForTests(async () => TEST_USER);
  projectsRoute = await import("@/app/api/projects/route");
  projectRoute = await import("@/app/api/projects/[id]/route");
  assetsRoute = await import("@/app/api/projects/[id]/assets/route");
  assetRoute = await import("@/app/api/assets/[assetId]/route");
  versionsRoute = await import("@/app/api/projects/[id]/versions/route");
  exportsRoute = await import("@/app/api/exports/route");
  settingsRoute = await import("@/app/api/settings/route");
  promptRoute = await import("@/app/api/prompt/improve/route");
  mixRoute = await import("@/app/api/mix/recommendations/route");
  profilesRoute = await import("@/app/api/voice-profiles/route");
  projectId = await createProject();
});

afterAll(async () => {
  const auth = await import("@/lib/server/auth");
  auth.__setSessionOverrideForTests(null);
  await rm(tmpDir, { recursive: true, force: true });
});

describe("projects API", () => {
  it("requires a name", async () => {
    const res = await projectsRoute.POST(jsonRequest("/api/projects", { name: "   " }));
    expect(res.status).toBe(400);
  });

  it("clamps tempo and rejects unknown genres", async () => {
    const res = await projectsRoute.POST(
      jsonRequest("/api/projects", { name: "Clamp", genre: "Polka", bpm: 999 }),
    );
    const body = (await res.json()) as { project: { bpm: number; genre: string } };
    expect(body.project.bpm).toBe(240);
    expect(body.project.genre).toBe("Afrobeats");
  });

  it("ignores identity fields when patching", async () => {
    const original = await projectRoute.GET(new Request("http://localhost/api/projects/x"), {
      params: Promise.resolve({ id: projectId }),
    });
    const before = (await original.json()) as {
      project: { id: string; createdAt: string; name: string };
    };
    const res = await projectRoute.PATCH(
      jsonRequest(
        "/api/projects/x",
        { id: "prj_hacked", createdAt: "1999-01-01", name: "Renamed" },
        "PATCH",
      ),
      { params: Promise.resolve({ id: projectId }) },
    );
    const after = (await res.json()) as {
      project: { id: string; createdAt: string; name: string };
    };
    expect(after.project.id).toBe(before.project.id);
    expect(after.project.createdAt).toBe(before.project.createdAt);
    expect(after.project.name).toBe("Renamed");
  });

  it("404s for a missing project", async () => {
    const res = await projectRoute.GET(new Request("http://localhost/api/projects/nope"), {
      params: Promise.resolve({ id: "prj_missing" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("asset uploads", () => {
  it("rejects DAW project files with an explanation instead of importing them", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3, 4])], "song.flp"));
    const res = await assetsRoute.POST(
      new Request("http://localhost/upload", { method: "POST", body: form }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(415);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain("unsupported");
  });

  it("rejects audio longer than the configured limit", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(2048)], "long.wav", { type: "audio/wav" }));
    form.append("meta", JSON.stringify({ durationSec: 9999 }));
    const res = await assetsRoute.POST(
      new Request("http://localhost/upload", { method: "POST", body: form }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(413);
  });

  it("stores audio, guesses the channel role and creates a mixer track", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(4096)], "Lead Vox.wav", { type: "audio/wav" }),
    );
    form.append(
      "meta",
      JSON.stringify({
        durationSec: 3.2,
        sampleRate: 48000,
        channels: 2,
        bitDepth: 24,
        peaks: [0, 0.5, -0.4, 2],
        kind: "vocal",
      }),
    );
    form.append("createTrack", "true");
    const res = await assetsRoute.POST(
      new Request("http://localhost/upload", { method: "POST", body: form }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      asset: { id: string; kind: string; peaks: number[]; sha256?: string };
      project: {
        tracks: { name: string; role: string; assetId: string }[];
        vocal: { sourceAssetId: string | null };
      };
    };
    expect(body.asset.kind).toBe("vocal");
    expect(Math.max(...body.asset.peaks)).toBeLessThanOrEqual(1);
    expect(body.asset.sha256).toHaveLength(64);
    expect(body.project.tracks[0].role).toBe("lead_vocal");
    expect(body.project.tracks[0].assetId).toBe(body.asset.id);
    expect(body.project.vocal.sourceAssetId).toBe(body.asset.id);
  });

  it("requires projectId when deleting an asset", async () => {
    const res = await assetRoute.DELETE(
      new Request("http://localhost/api/assets/ast_x", { method: "DELETE" }),
      { params: Promise.resolve({ assetId: "ast_x" }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("versions API", () => {
  it("snapshots the current state before restoring", async () => {
    const saved = await versionsRoute.POST(
      jsonRequest("/api/projects/x/versions", { note: "checkpoint", studio: "mix" }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(saved.status).toBe(201);
    const { version } = (await saved.json()) as { version: { id: string; label: string } };

    const restored = await versionsRoute.PUT(
      jsonRequest("/api/projects/x/versions", { versionId: version.id }, "PUT"),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(restored.status).toBe(200);
    const body = (await restored.json()) as {
      project: { versions: { label: string }[] };
    };
    expect(body.project.versions.some((v) => v.label === "Pre-restore checkpoint")).toBe(true);
  });

  it("404s on an unknown version", async () => {
    const res = await versionsRoute.PUT(
      jsonRequest("/api/projects/x/versions", { versionId: "ver_missing" }, "PUT"),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("exports API", () => {
  it("refuses to record an export with no file", async () => {
    const form = new FormData();
    form.append("meta", JSON.stringify({ projectId }));
    const res = await exportsRoute.POST(
      new Request("http://localhost/api/exports", { method: "POST", body: form }),
    );
    expect(res.status).toBe(400);
  });

  it("records only numeric measurements and rejects strings", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(2048)], "master.wav", { type: "audio/wav" }));
    form.append(
      "meta",
      JSON.stringify({
        projectId,
        format: "WAV",
        bitDepth: 24,
        sampleRate: 48000,
        integratedLufs: "loud",
        truePeakDb: -1.1,
        studio: "mastering",
      }),
    );
    const res = await exportsRoute.POST(
      new Request("http://localhost/api/exports", { method: "POST", body: form }),
    );
    expect(res.status).toBe(201);
    const { export: record } = (await res.json()) as {
      export: { integratedLufs: number; truePeakDb: number; format: string };
    };
    // "loud" is coerced to a number by validation, never trusted as a string.
    expect(typeof record.integratedLufs).toBe("number");
    expect(record.truePeakDb).toBe(-1.1);
    expect(record.format).toBe("WAV");
  });
});

describe("settings API", () => {
  it("clamps upload limits and rejects unknown formats", async () => {
    const clamped = await settingsRoute.PATCH(
      jsonRequest("/api/settings", { maxUploadMb: 5000, dither16Bit: false }, "PATCH"),
    );
    const { settings } = (await clamped.json()) as {
      settings: { maxUploadMb: number; dither16Bit: boolean };
    };
    expect(settings.maxUploadMb).toBe(500);
    expect(settings.dither16Bit).toBe(false);

    const bad = await settingsRoute.PATCH(
      jsonRequest("/api/settings", { defaultExportFormat: "flac" }, "PATCH"),
    );
    expect(bad.status).toBe(400);
  });
});

describe("AI routes", () => {
  it("requires a prompt", async () => {
    const res = await promptRoute.POST(
      jsonRequest("/api/prompt/improve", { prompt: "", studio: "vocal" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns a labelled local result and never claims a model call", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await promptRoute.POST(
      jsonRequest("/api/prompt/improve", {
        prompt: "bigger chorus with tight harmonies",
        studio: "vocal",
        genre: "Afrobeats",
        bpm: 102,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { source: string; note: string; text: string };
    expect(body.source).toBe("local-heuristic");
    expect(body.note).toMatch(/GEMINI_API_KEY/);
    expect(body.text.length).toBeGreaterThan(60);
  });

  it("validates mixing briefs", async () => {
    const res = await mixRoute.POST(
      jsonRequest("/api/mix/recommendations", { prompt: "  ", roles: [] }),
    );
    expect(res.status).toBe(400);
  });
});

describe("voice profile consent", () => {
  it("refuses a profile without recorded consent", async () => {
    const res = await profilesRoute.POST(
      jsonRequest("/api/voice-profiles", {
        name: "Someone",
        consentConfirmed: false,
        consentName: "",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("accepts a consented profile", async () => {
    const res = await profilesRoute.POST(
      jsonRequest("/api/voice-profiles", {
        name: "Elder Mi",
        consentConfirmed: true,
        consentName: "Elder Mi",
        timbreDescription: "warm baritone",
        genreSuitability: "Afrobeats",
      }),
    );
    expect(res.status).toBe(201);
    const { voiceProfile } = (await res.json()) as {
      voiceProfile: { consentConfirmed: boolean; consentName: string };
    };
    expect(voiceProfile.consentConfirmed).toBe(true);
    expect(voiceProfile.consentName).toBe("Elder Mi");
  });
});
