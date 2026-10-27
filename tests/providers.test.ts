import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeWav } from "@/lib/audio/wav";

/**
 * Music-generation tests.
 *
 * Every network call is mocked, so these tests describe the *contract* of each
 * adapter (what we send, what we accept, how vendor errors are surfaced) and the
 * orchestrator's money guards. Nothing here contacts a real provider.
 */

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

/** A 0.25 s stereo WAV at 48 kHz — small, but a real decodable file. */
function sampleWav(seconds = 0.25): Uint8Array {
  const frames = Math.round(48_000 * seconds);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    const value = Math.sin((2 * Math.PI * 440 * i) / 48_000) * 0.4;
    left[i] = value;
    right[i] = value;
  }
  return encodeWav([left, right], 48_000, 16);
}

const WAV_BYTES = sampleWav();

/** Minimal `Response` stand-ins for the mocked fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function audioResponse(bytes: Uint8Array, contentType = "audio/wav"): Response {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Install a fetch stub and return the recorded calls. */
function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return handler(url, init);
  });
  vi.stubGlobal("fetch", spy);
  return calls;
}

const ENV_KEYS = [
  "GOOGLE_API_KEY",
  "GOOGLE_VERTEX_ACCESS_TOKEN",
  "GOOGLE_VERTEX_PROJECT",
  "STABILITY_API_KEY",
  "ELEVENLABS_API_KEY",
  "REPLICATE_API_TOKEN",
] as const;

const savedEnv = new Map<string, string | undefined>();

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  // Start every test unconfigured so "no key" behaviour is the default.
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* Adapters: descriptor + configuration honesty                        */
/* ------------------------------------------------------------------ */

describe("provider descriptors", () => {
  it("reports every provider as unconfigured when no key is present", async () => {
    const { listDescriptors } = await import("@/lib/server/providers/registry");
    const descriptors = listDescriptors();
    expect(descriptors).toHaveLength(4);
    expect(descriptors.every((entry) => entry.configured === false)).toBe(true);
    // Each names the exact environment variable the producer must set.
    for (const entry of descriptors) expect(entry.keyEnv.length).toBeGreaterThan(0);
  });

  it("flips a provider to configured only when its key is set", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    const { listDescriptors } = await import("@/lib/server/providers/registry");
    const elevenlabs = listDescriptors().find((entry) => entry.id === "elevenlabs_music");
    expect(elevenlabs?.configured).toBe(true);
    // Lyria needs a project as well as a credential.
    process.env.GOOGLE_API_KEY = "test-key";
    expect(
      listDescriptors().find((entry) => entry.id === "lyria")?.configured,
    ).toBe(false);
    process.env.GOOGLE_VERTEX_PROJECT = "demo-project";
    expect(listDescriptors().find((entry) => entry.id === "lyria")?.configured).toBe(true);
  });

  it("filters by generation kind", async () => {
    const { descriptorsForKind } = await import("@/lib/server/providers/registry");
    expect(descriptorsForKind("song").map((entry) => entry.id)).toEqual(["elevenlabs_music"]);
    expect(descriptorsForKind("beat").map((entry) => entry.id)).toEqual([
      "lyria",
      "stable_audio",
      "replicate_musicgen",
    ]);
    expect(descriptorsForKind("vocals").map((entry) => entry.id)).toEqual(["elevenlabs_music"]);
  });

  it("rounds cost estimates to cents", async () => {
    const { estimateCost, getProvider } = await import("@/lib/server/providers/registry");
    const descriptor = getProvider("lyria").descriptor();
    // 0.002 USD/s * 30 s = 0.06
    expect(estimateCost(descriptor, 30)).toBe(0.06);
    expect(estimateCost(descriptor, 7)).toBe(0.01);
  });

  it("rejects unknown provider ids with a 400", async () => {
    const { getProvider, isProviderId } = await import("@/lib/server/providers/registry");
    expect(isProviderId("nope")).toBe(false);
    expect(() => getProvider("nope")).toThrowError(/Unknown provider/);
    try {
      getProvider("nope");
    } catch (err) {
      expect((err as { status: number }).status).toBe(400);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Adapters: HTTP behaviour                                            */
/* ------------------------------------------------------------------ */

describe("lyria adapter", () => {
  it("posts to the Vertex predict endpoint and returns the audio", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    process.env.GOOGLE_VERTEX_PROJECT = "demo-project";
    const calls = mockFetch(() =>
      jsonResponse({
        predictions: [{ bytesBase64Encoded: Buffer.from(WAV_BYTES).toString("base64") }],
      }),
    );
    const { lyriaProvider } = await import("@/lib/server/providers/lyria");
    const start = await lyriaProvider.start({ kind: "beat", prompt: "amapiano groove", durationSec: 20 });

    expect(start.mode).toBe("ready");
    if (start.mode !== "ready") return;
    expect(start.result.audio.extension).toBe("wav");
    expect(start.result.audio.bytes.byteLength).toBe(WAV_BYTES.byteLength);
    expect(start.result.costUsd).toBeCloseTo(0.04, 5);
    expect(calls[0].url).toContain("demo-project");
    expect(calls[0].url).toContain("lyria-002");
    expect(calls[0].init?.method).toBe("POST");
  });

  it("surfaces a 401 as a non-retryable provider error", async () => {
    process.env.GOOGLE_API_KEY = "bad-key";
    process.env.GOOGLE_VERTEX_PROJECT = "demo-project";
    mockFetch(() => errorResponse(401, "API key not valid"));
    const { lyriaProvider } = await import("@/lib/server/providers/lyria");
    await expect(
      lyriaProvider.start({ kind: "beat", prompt: "amapiano groove", durationSec: 10 }),
    ).rejects.toMatchObject({ status: 502, retryable: false });
  });

  it("marks a 429 as retryable and keeps the vendor wording", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    process.env.GOOGLE_VERTEX_PROJECT = "demo-project";
    mockFetch(() => errorResponse(429, "Quota exceeded for lyria-002"));
    const { lyriaProvider } = await import("@/lib/server/providers/lyria");
    await expect(
      lyriaProvider.start({ kind: "beat", prompt: "amapiano groove", durationSec: 10 }),
    ).rejects.toMatchObject({ status: 429, retryable: true });
    await expect(
      lyriaProvider.start({ kind: "beat", prompt: "amapiano groove", durationSec: 10 }),
    ).rejects.toThrow(/Quota exceeded/);
  });

  it("refuses an empty predictions array instead of inventing audio", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    process.env.GOOGLE_VERTEX_PROJECT = "demo-project";
    mockFetch(() => jsonResponse({ predictions: [] }));
    const { lyriaProvider } = await import("@/lib/server/providers/lyria");
    await expect(
      lyriaProvider.start({ kind: "beat", prompt: "amapiano groove", durationSec: 10 }),
    ).rejects.toThrow(/returned no audio/);
  });

  it("caps the request length at 30 s", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    process.env.GOOGLE_VERTEX_PROJECT = "demo-project";
    mockFetch(() => jsonResponse({ predictions: [] }));
    const { lyriaProvider } = await import("@/lib/server/providers/lyria");
    await expect(
      lyriaProvider.start({ kind: "beat", prompt: "amapiano groove", durationSec: 60 }),
    ).rejects.toThrow(/up to 30s/);
  });
});

describe("stable audio adapter", () => {
  it("sends multipart form data and accepts a WAV body", async () => {
    process.env.STABILITY_API_KEY = "test-key";
    const calls = mockFetch(() => audioResponse(WAV_BYTES, "audio/wav"));
    const { stableAudioProvider } = await import("@/lib/server/providers/stableAudio");
    const start = await stableAudioProvider.start({
      kind: "instrumental",
      prompt: "warm afro-house instrumental",
      durationSec: 45,
    });

    expect(start.mode).toBe("ready");
    if (start.mode !== "ready") return;
    expect(start.result.audio.extension).toBe("wav");
    expect(calls[0].init?.body).toBeInstanceOf(FormData);
    const form = calls[0].init?.body as FormData;
    expect(form.get("prompt")).toBe("warm afro-house instrumental");
    expect(form.get("output_format")).toBe("wav");
    expect(form.get("duration")).toBe("45");
  });

  it("rejects an empty audio body", async () => {
    process.env.STABILITY_API_KEY = "test-key";
    mockFetch(() => new Response(new Uint8Array(0), { status: 200 }));
    const { stableAudioProvider } = await import("@/lib/server/providers/stableAudio");
    await expect(
      stableAudioProvider.start({ kind: "beat", prompt: "log drum beat", durationSec: 20 }),
    ).rejects.toThrow(/empty file/);
  });

  it("reports a 500 as retryable", async () => {
    process.env.STABILITY_API_KEY = "test-key";
    mockFetch(() => errorResponse(500, "engine overloaded"));
    const { stableAudioProvider } = await import("@/lib/server/providers/stableAudio");
    await expect(
      stableAudioProvider.start({ kind: "beat", prompt: "log drum beat", durationSec: 20 }),
    ).rejects.toMatchObject({ retryable: true });
  });
});

describe("elevenlabs adapter", () => {
  it("requests an MP3 and records the duration it asked for", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    const calls = mockFetch(() =>
      audioResponse(new Uint8Array([0xff, 0xfb, 0x90, 0x00]), "audio/mpeg"),
    );
    const { elevenLabsProvider } = await import("@/lib/server/providers/elevenlabs");
    const start = await elevenLabsProvider.start({
      kind: "song",
      prompt: "afrobeats love song",
      durationSec: 120,
    });

    expect(start.mode).toBe("ready");
    if (start.mode !== "ready") return;
    expect(start.result.audio.extension).toBe("mp3");
    expect(start.result.durationSec).toBe(120);
    const body = JSON.parse(String(calls[0].init?.body)) as { music_length_ms: number };
    expect(body.music_length_ms).toBe(120_000);
  });

  it("does not pretend a synchronous provider can be polled", async () => {
    const { elevenLabsProvider } = await import("@/lib/server/providers/elevenlabs");
    await expect(elevenLabsProvider.poll("x", {} as never)).rejects.toThrow(/synchronously/);
  });
});

describe("replicate adapter", () => {
  it("polls a running prediction and copies the finished file", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    let polls = 0;
    const calls = mockFetch((url) => {
      if (url.includes("/predictions/")) {
        polls += 1;
        return jsonResponse({
          id: "pred_1",
          status: "succeeded",
          output: "https://replicate.delivery/out.mp3",
        });
      }
      if (url.startsWith("https://replicate.delivery/")) {
        return audioResponse(new Uint8Array([0xff, 0xfb, 0x90, 0x00]), "audio/mpeg");
      }
      return jsonResponse({ id: "pred_1", status: "starting" });
    });

    const { replicateMusicgenProvider } = await import("@/lib/server/providers/replicate");
    const started = await replicateMusicgenProvider.start({
      kind: "beat",
      prompt: "slow afrobeat drums",
      durationSec: 30,
    });
    expect(started.mode).toBe("pending");
    if (started.mode !== "pending") return;
    expect(started.providerJobId).toBe("pred_1");

    const finished = await replicateMusicgenProvider.poll(started.providerJobId, {
      kind: "beat",
      prompt: "slow afrobeat drums",
      durationSec: 30,
    });
    expect(polls).toBe(1);
    expect(finished.mode).toBe("ready");
    if (finished.mode !== "ready") return;
    expect(finished.result.audio.extension).toBe("mp3");
    expect(calls.at(-1)?.url).toBe("https://replicate.delivery/out.mp3");
  });

  it("turns a failed prediction into a non-retryable error", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    mockFetch(() =>
      jsonResponse({ id: "pred_2", status: "failed", error: "NSFW filter triggered" }),
    );
    const { replicateMusicgenProvider } = await import("@/lib/server/providers/replicate");
    await expect(
      replicateMusicgenProvider.start({ kind: "beat", prompt: "something", durationSec: 10 }),
    ).rejects.toMatchObject({ retryable: false });
    await expect(
      replicateMusicgenProvider.start({ kind: "beat", prompt: "something", durationSec: 10 }),
    ).rejects.toThrow(/NSFW filter/);
  });

  it("cancels a pending prediction", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    const calls = mockFetch(() => jsonResponse({ id: "pred_3", status: "canceled" }));
    const { replicateMusicgenProvider } = await import("@/lib/server/providers/replicate");
    await replicateMusicgenProvider.cancel?.("pred_3");
    expect(calls[0].url).toContain("/predictions/pred_3/cancel");
    expect(calls[0].init?.method).toBe("POST");
  });
});

/* ------------------------------------------------------------------ */
/* Orchestrator: budgets, storage, spend ledger                        */
/* ------------------------------------------------------------------ */

describe("generation orchestrator", () => {
  let tmpDir: string;
  let projectId: string;
  let generation: typeof import("@/lib/server/generation");
  let repo: typeof import("@/lib/server/repo");
  let db: typeof import("@/lib/server/db");

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-gen-"));
    process.env.DATA_DIR = tmpDir;
    vi.resetModules();
    generation = await import("@/lib/server/generation");
    repo = await import("@/lib/server/repo");
    db = await import("@/lib/server/db");
    const project = await repo.createProject({ name: "Generation Test", genre: "Amapiano-influenced Afrobeats", bpm: 108 });
    projectId = project.id;
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("refuses every request while paid generation is off (403)", async () => {
    process.env.STABILITY_API_KEY = "test-key";
    const calls = mockFetch(() => audioResponse(WAV_BYTES));
    await expect(
      generation.createGeneration(projectId, {
        providerId: "stable_audio",
        kind: "beat",
        prompt: "log drum groove",
        durationSec: 20,
      }),
    ).rejects.toMatchObject({ status: 403 });
    // Nothing must reach the vendor while the guard is closed.
    expect(calls).toHaveLength(0);
  });

  it("returns 400 for an unconfigured provider", async () => {
    await db.mutateDb((state) => {
      state.settings.allowPaidGeneration = true;
    });
    await expect(
      generation.createGeneration(projectId, {
        providerId: "elevenlabs_music",
        kind: "song",
        prompt: "afrobeats love song",
        durationSec: 30,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("refuses a request that would exceed the spend cap (402)", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    await db.mutateDb((state) => {
      state.settings.allowPaidGeneration = true;
      state.settings.spendCapUsd = 0.5;
      state.spend.lifetimeUsd = 0.45;
    });
    const calls = mockFetch(() => audioResponse(new Uint8Array([0xff, 0xfb]), "audio/mpeg"));
    await expect(
      generation.createGeneration(projectId, {
        providerId: "elevenlabs_music",
        kind: "song",
        prompt: "afrobeats love song",
        durationSec: 60,
      }),
    ).rejects.toMatchObject({ status: 402 });
    expect(calls).toHaveLength(0);
  });

  it("stores audio as an asset + channel and charges the ledger", async () => {
    process.env.STABILITY_API_KEY = "test-key";
    await db.mutateDb((state) => {
      state.settings.allowPaidGeneration = true;
      state.settings.spendCapUsd = 50;
      state.spend.lifetimeUsd = 0;
    });
    mockFetch(() => audioResponse(WAV_BYTES, "audio/wav"));

    const outcome = await generation.createGeneration(projectId, {
      providerId: "stable_audio",
      kind: "beat",
      prompt: "amapiano log drum groove at 108 bpm",
      // Request 20 s so the cost estimate is above one cent; the fixture itself
      // is 0.25 s, proving the stored duration is measured from the file.
      durationSec: 20,
    });

    expect(outcome.job.status).toBe("completed");
    expect(outcome.asset).not.toBeNull();
    const asset = outcome.asset!;
    expect(asset.kind).toBe("stem");
    expect(asset.engine).toContain("stable_audio");
    expect(asset.provenance?.providerId).toBe("stable_audio");
    expect(asset.provenance?.prompt).toContain("amapiano");
    expect(asset.provenance?.jobId).toBe(outcome.job.id);
    // WAV is decoded server-side, so peaks and duration are measured, not guessed.
    expect(asset.peaks.length).toBeGreaterThan(0);
    expect(asset.durationSec).toBeCloseTo(0.25, 2);
    expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);

    const project = await repo.getProject(projectId);
    expect(project?.assets.some((entry) => entry.id === asset.id)).toBe(true);
    expect(project?.tracks.some((entry) => entry.assetId === asset.id)).toBe(true);

    const spend = await generation.spendSummary();
    expect(spend.lifetimeUsd).toBeCloseTo(outcome.job.costChargedUsd, 2);
    expect(spend.lifetimeUsd).toBeGreaterThan(0);
    expect(spend.capUsd).toBe(50);
    expect(spend.remainingUsd).toBeCloseTo(50 - spend.lifetimeUsd, 2);
  });

  it("records a provider runtime failure on the job without charging", async () => {
    process.env.STABILITY_API_KEY = "test-key";
    const before = (await generation.spendSummary()).lifetimeUsd;
    mockFetch(() => errorResponse(500, "engine exploded"));

    const outcome = await generation.createGeneration(projectId, {
      providerId: "stable_audio",
      kind: "beat",
      prompt: "broken request",
      durationSec: 5,
    });

    expect(outcome.job.status).toBe("failed");
    expect(outcome.job.message).toContain("engine exploded");
    expect(outcome.asset).toBeNull();
    expect((await generation.spendSummary()).lifetimeUsd).toBe(before);
  });

  it("never re-polls or re-charges a finished job", async () => {
    const jobs = await generation.listGenerations(projectId);
    const completed = jobs.find((job) => job.status === "completed");
    expect(completed).toBeDefined();
    const calls = mockFetch(() => audioResponse(WAV_BYTES));
    const again = await generation.advanceGeneration(completed!.id);
    expect(again?.job.status).toBe("completed");
    expect(calls).toHaveLength(0);
  });

  it("cancels a pending job and charges nothing", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    mockFetch(() => jsonResponse({ id: "pred_9", status: "processing" }));

    const created = await generation.createGeneration(projectId, {
      providerId: "replicate_musicgen",
      kind: "beat",
      prompt: "pending render",
      durationSec: 30,
    });
    expect(created.job.status).toBe("running");
    expect(created.job.providerJobId).toBe("pred_9");

    const before = (await generation.spendSummary()).lifetimeUsd;
    const cancelled = await generation.cancelGeneration(created.job.id);
    expect(cancelled?.status).toBe("cancelled");
    expect((await generation.spendSummary()).lifetimeUsd).toBe(before);
  });
});
