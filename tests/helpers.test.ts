import { describe, expect, it } from "vitest";
import { buildArrangementPlan } from "@/lib/audio/arrangement";
import { detectUnsupportedPackage } from "@/lib/client/zip";
import { sanitizeForFileName } from "@/lib/client/exporting";
import { clamp, formatBytes, formatDb, formatLufs, formatTime, titleCase } from "@/lib/format";
import { emptyProject, guessRoleFromName } from "@/lib/projects";
import { CHOIR_STYLES, MIX_PRESETS, PROMPT_SEEDS, VOCAL_TOOLS } from "@/lib/types";
import type { ChoirStyleId } from "@/lib/types";

const fallback = {
  layerCount: 3,
  intensity: 0.6,
  density: 0.5,
  choirSize: 8,
  choirStyle: (CHOIR_STYLES[0]?.id ?? "zulu") as ChoirStyleId,
};

describe("arrangement plans", () => {
  it("builds a section plan that fills the requested duration", () => {
    const plan = buildArrangementPlan("energetic Afrobeats chorus with choir", 104, 24, fallback);
    expect(plan.sections.length).toBeGreaterThan(2);
    expect(plan.summary.length).toBeGreaterThan(20);
    for (const section of plan.sections) {
      expect(section.section.length).toBeGreaterThan(1);
      expect(section.layers.length).toBeGreaterThan(0);
      expect(section.bars).toMatch(/\d/);
    }
    expect(plan.settings.tool).toBe("choir");
    expect(plan.settings.layerCount).toBeGreaterThanOrEqual(2);
    expect(plan.settings.choirSize).toBeGreaterThanOrEqual(8);
  });

  it("responds to intimate language without inventing extra layers", () => {
    const plan = buildArrangementPlan("soft intimate verse, subtle harmonies", 92, 16, fallback);
    expect(plan.settings.intensity).toBeLessThanOrEqual(0.5);
    expect(plan.settings.layerCount).toBeLessThanOrEqual(3);
  });

  it("keeps every setting inside the generator's accepted range", () => {
    const plan = buildArrangementPlan("huge hype club chant with call and response", 120, 12, fallback);
    expect(plan.settings.intensity).toBeGreaterThan(0);
    expect(plan.settings.intensity).toBeLessThanOrEqual(1);
    expect(plan.settings.density).toBeLessThanOrEqual(1);
    expect(plan.settings.choirSize).toBeLessThanOrEqual(24);
    expect(VOCAL_TOOLS.some((t) => t.id === plan.settings.tool)).toBe(true);
  });
});

describe("DAW import guardrails", () => {
  it("explains native project files instead of importing them", () => {
    for (const name of ["song.flp", "mix.cpr", "track.als", "session.logicx", "x.rpp"]) {
      const message = detectUnsupportedPackage(name);
      expect(message).toBeTruthy();
      expect(message!.toLowerCase()).toContain("stem");
    }
  });

  it("explains MIDI and unsupported archives", () => {
    expect(detectUnsupportedPackage("melody.mid")).toMatch(/MIDI/i);
    expect(detectUnsupportedPackage("stems.rar")).toMatch(/zip/i);
  });

  it("allows zip and audio files through", () => {
    expect(detectUnsupportedPackage("stems.zip")).toBeNull();
    expect(detectUnsupportedPackage("kick.wav")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats time, bytes and levels", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toMatch(/KB/);
    expect(formatDb(-3, 1)).toBe("-3.0 dB");
    expect(formatLufs(-13.96)).toBe("-14.0 LUFS");
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(titleCase("lead vocal")).toBe("Lead Vocal");
  });

  it("produces safe export file names", () => {
    expect(sanitizeForFileName("Lagos Níghts / mix #1")).toBe("Lagos_Nghts_mix_1");
    expect(sanitizeForFileName("")).toBe("ElderMi_Export");
  });
});

describe("prompt seeds and presets", () => {
  it("every studio has a usable starting brief", () => {
    for (const key of ["vocal", "mix", "mastering"] as const) {
      expect(PROMPT_SEEDS[key].length).toBeGreaterThan(80);
    }
  });

  it("every mix preset defines a full channel state except custom", () => {
    for (const preset of MIX_PRESETS) {
      if (preset.id === "custom") continue;
      expect(preset.label.length).toBeGreaterThan(2);
      expect(Object.keys(preset.roles).length).toBeGreaterThan(0);
      for (const settings of Object.values(preset.roles)) {
        expect(Number.isFinite(settings.volumeDb ?? 0)).toBe(true);
      }
    }
  });

  it("creates new projects with the right per-studio defaults", () => {
    const project = emptyProject("Defaults", "Amapiano-influenced Afrobeats", 112, "C minor");
    expect(project.vocal.tool).toBe("chorus");
    expect(project.vocal.generatedAssetIds).toEqual([]);
    expect(project.mix.lastMixAssetId).toBeNull();
    expect(project.mastering.profileId).toBeTruthy();
    expect(project.tracks).toEqual([]);
    expect(guessRoleFromName("backing vox 2.wav")).toMatch(/backing|harmony|double/);
  });
});
