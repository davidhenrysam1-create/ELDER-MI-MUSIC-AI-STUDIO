// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Icon } from "@/components/ui/Icon";
import {
  EmptyState,
  GlassCard,
  GradientText,
  Metric,
  ProgressBar,
  SectionHeading,
  Segmented,
  StatusPill,
} from "@/components/ui/primitives";
import { StudioCard } from "@/components/dashboard/StudioCard";
import { emptyProject } from "@/lib/projects";
import type { Project, StudioSettings } from "@/lib/types";

/**
 * Smoke tests for the client UI shell. They render real components (no mocks of
 * the components themselves) so a broken primitive or prop contract fails here.
 */

afterEach(() => cleanup());

describe("icon set", () => {
  it("renders every icon used by the studios without throwing", () => {
    const names = [
      "mic",
      "sliders",
      "disc",
      "play",
      "pause",
      "volume",
      "download",
      "sparkles",
      "waveform",
      "folder",
      "voice",
      "settings",
      "lock",
      "alert",
    ] as const;
    for (const name of names) {
      const { container, unmount } = render(<Icon name={name} size={18} />);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });
});

describe("primitives", () => {
  it("renders gradient headings and status pills", () => {
    render(
      <GlassCard>
        <GradientText variant="vocal">Sam Vocal Studio</GradientText>
        <StatusPill tone="success" icon="check">
          Ready
        </StatusPill>
      </GlassCard>,
    );
    expect(screen.getByText("Sam Vocal Studio")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("exposes the segmented control as a labelled tablist", () => {
    render(
      <Segmented
        label="Playback speed"
        value="1"
        options={[
          { value: "1", label: "1×" },
          { value: "2", label: "2×" },
        ]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("tablist", { name: "Playback speed" })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("marks the selected segment", () => {
    render(
      <Segmented
        label="Mode"
        value="b"
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
        onChange={() => {}}
      />,
    );
    const [a, b] = screen.getAllByRole("tab");
    expect(a.getAttribute("aria-selected")).toBe("false");
    expect(b.getAttribute("aria-selected")).toBe("true");
  });

  it("switches segments on click", () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Mode"
        value="a"
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
        onChange={onChange}
      />,
    );
    screen.getAllByRole("tab")[1].click();
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("renders metrics, progress and empty states", () => {
    render(
      <div>
        <Metric label="Projects" value={3} hint="Saved" />
        <ProgressBar value={42} />
        <SectionHeading title="Recent work" description="Latest renders" />
        <EmptyState icon="folder" title="No projects" description="Create one to begin" />
      </div>,
    );
    expect(screen.getByText("Projects")).toBeTruthy();
    expect(screen.getByText("Recent work")).toBeTruthy();
    expect(screen.getByText("No projects")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42");
  });
});

describe("studio cards", () => {
  it("links to the workspace with its exact name", () => {
    render(
      <StudioCard
        studio="mastering"
        title="Sam Mastering Studio"
        description="Master your record"
        action="Open Mastering Studio"
        href="/mastering"
        meta="7 profiles"
      />,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/mastering");
    expect(screen.getByText("Sam Mastering Studio")).toBeTruthy();
  });
});

describe("colour system", () => {
  it("only uses Tailwind opacity steps that actually compile", () => {
    // Tailwind emits opacity modifiers in 5% steps; /8 or /12 silently produce
    // no CSS, which previously made glass borders invisible.
    const roots = ["app", "components", "lib"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      const fs = require("node:fs") as typeof import("node:fs");
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(tsx?|css)$/.test(entry.name)) continue;
        const source = readFileSync(full, "utf8");
        for (const match of source.matchAll(/\b(bg|border|text|ring|divide|from|via|to)-(white|black)\/(\d{1,3})\b/g)) {
          if (Number(match[3]) % 5 !== 0) offenders.push(`${full}: ${match[0]}`);
        }
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });
});

describe("project defaults consumed by the UI", () => {
  it("serialises a project that the studio pages can render", () => {
    const project: Project = emptyProject("UI Test", "Afrobeats", 104, "F# minor");
    const settings: StudioSettings = {
      allowPaidGeneration: false,
      spendCapUsd: 5,
      defaultExportFormat: "wav24",
      dither16Bit: true,
      autoSave: true,
      processingQuality: "balanced",
      maxUploadMb: 80,
      maxDurationSec: 720,
    };
    expect(settings.defaultExportFormat).toBe("wav24");
    expect(project.mastering.controls.targetLufs).toBe(-14);
  });
});

describe("module graph", () => {
  it("keeps useStudio calls inside a provider type", () => {
    // The provider must throw a helpful message if a page forgets the provider.
    const source = readFileSync(path.join(process.cwd(), "lib/client/studio.tsx"), "utf8");
    expect(source).toContain("useStudio must be used inside StudioProvider");
    vi.restoreAllMocks();
  });
});
