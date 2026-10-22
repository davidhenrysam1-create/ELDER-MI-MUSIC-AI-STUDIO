import { afterEach, describe, expect, it } from "vitest";
import { improvePrompt, mixRecommendations } from "@/lib/server/promptEngine";
import { applyPresetToTracks, emptyProject, guessRoleFromName, makeTrack } from "@/lib/projects";

const ctx = { genre: "Afrobeats", bpm: 104, key: "F# minor" };

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe("prompt improvement", () => {
  it("falls back to the local engine and says so when Gemini is not configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await improvePrompt(
      "make the chorus bigger and clearer",
      "vocal",
      ctx,
    );
    expect(result.source).toBe("local-heuristic");
    expect(result.note).toMatch(/GEMINI_API_KEY/i);
    expect(result.text.length).toBeGreaterThan(80);
    expect(result.text.toLowerCase()).toContain("lead");
  });

  it("produces mastering guidance with concrete targets", async () => {
    const result = await improvePrompt("master this for release", "mastering", ctx);
    expect(result.text).toMatch(/LUFS/i);
    expect(result.text).toMatch(/dBTP/i);
    expect(result.text.toLowerCase()).not.toContain("i listened");
  });

  it("rejects empty prompts", async () => {
    await expect(improvePrompt("   ", "mix", ctx)).rejects.toThrow(/instruction/i);
  });

  it("labels mock provider failures instead of silently faking a model call", async () => {
    process.env.GEMINI_API_KEY = "test-key-not-real";
    // Force the network call to fail fast in the sandbox.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network unavailable");
    }) as typeof fetch;
    try {
      const result = await improvePrompt("tighten the low end", "mix", ctx);
      expect(result.source).toBe("local-heuristic");
      expect(result.note).toMatch(/Gemini request failed/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("mixing recommendations", () => {
  it("returns reviewable stages with bounded channel values", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await mixRecommendations(
      "improve vocal clarity, control the low end and keep the percussion energetic",
      "modern_afrobeats",
      ["lead_vocal", "bass", "percussion", "drums"],
    );
    expect(result.source).toBe("local-heuristic");
    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    for (const rec of result.recommendations) {
      expect(rec.summary.length).toBeGreaterThan(5);
      expect(rec.detail.length).toBeGreaterThan(10);
      expect(rec.applied).toBe(false);
      if (rec.settings) {
        for (const value of Object.values(rec.settings)) {
          expect(Number.isFinite(value)).toBe(true);
        }
        if (rec.settings.eqHighDb !== undefined) {
          expect(rec.settings.eqHighDb).toBeLessThanOrEqual(12);
          expect(rec.settings.eqHighDb).toBeGreaterThanOrEqual(-12);
        }
      }
    }
    expect(result.recommendations.some((r) => r.targetRole === "lead_vocal")).toBe(true);
  });

  it("rejects an empty brief at the API boundary", async () => {
    const { POST } = await import("@/app/api/mix/recommendations/route");
    const response = await POST(
      new Request("http://localhost/api/mix/recommendations", {
        method: "POST",
        body: JSON.stringify({ prompt: "   " }),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toMatch(/brief/i);
  });
});

describe("project defaults & presets", () => {
  it("creates a valid empty project with real defaults", () => {
    const project = emptyProject("Test session", "Afro-fusion", 112, "A minor");
    expect(project.name).toBe("Test session");
    expect(project.genre).toBe("Afro-fusion");
    expect(project.tracks).toHaveLength(0);
    expect(project.assets).toHaveLength(0);
    expect(project.mix.groups).toHaveLength(3);
    expect(project.mastering.controls.targetLufs).toBe(-14);
    expect(project.mastering.outputBitDepth).toBe(24);
    expect(project.vocal.prompt).toContain("Afrobeats chorus");
  });

  it("assigns sensible roles from file names", () => {
    expect(guessRoleFromName("Lead Vox.wav")).toBe("lead_vocal");
    expect(guessRoleFromName("shaker-loop.wav")).toBe("percussion");
    expect(guessRoleFromName("808 sub.aiff")).toBe("bass");
    expect(guessRoleFromName("keys.wav")).toBe("keys");
    expect(guessRoleFromName("unknown.wav")).toBe("other");
  });

  it("applies a preset only to the matching roles and keeps mute/solo", () => {
    const lead = { ...makeTrack("a1", "Lead", "lead_vocal", 0), muted: true };
    const bass = makeTrack("a2", "Bass", "bass", 1);
    const withPreset = applyPresetToTracks([lead, bass], "modern_afrobeats");
    expect(withPreset[0].muted).toBe(true);
    expect(withPreset[0].eqHighDb).toBeGreaterThan(0);
    expect(withPreset[1].eqLowDb).toBeGreaterThan(0);
    expect(withPreset[1].width).toBeLessThan(1);
  });

  it("leaves tracks untouched for the custom preset", () => {
    const track = makeTrack("a1", "Lead", "lead_vocal", 0);
    const [out] = applyPresetToTracks([track], "custom");
    expect(out).toEqual(track);
  });
});
