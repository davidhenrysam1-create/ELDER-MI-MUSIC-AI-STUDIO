// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { emptyProject } from "@/lib/projects";

const project = emptyProject("Responsive Test", "Afrobeats", 104, "F# minor");

const ctx = vi.hoisted(() => ({
  ready: true,
  loading: false,
  loadError: null,
  projects: [] as unknown[],
  project: null as unknown,
  exports: [] as unknown[],
  settings: { maxUploadMb: 80 },
  system: { storage: { audioBytes: 1024, exportBytes: 2048 }, providers: { gemini: { configured: false } } },
  saveState: "saved",
  savedAt: new Date().toISOString(),
  busyLabel: null,
  setBusyLabel: vi.fn(),
  selectProject: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  duplicateProject: vi.fn(),
  updateProject: vi.fn(),
  replaceProject: vi.fn(),
  refresh: vi.fn(),
  refreshExports: vi.fn(),
  refreshSystem: vi.fn(),
  saveNow: vi.fn(),
  upload: vi.fn(),
  uploadChannels: vi.fn(),
  deleteAsset: vi.fn(),
  saveVersion: vi.fn(),
  restoreVersion: vi.fn(),
  updateSettings: vi.fn(),
  notify: vi.fn(),
  dismissToast: vi.fn(),
  toasts: [] as unknown[],
  player: {
    assetId: null,
    projectId: null,
    name: "",
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    gainDb: 0,
    loop: false,
    ready: false,
  },
  playAsset: vi.fn(),
  togglePlayback: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
  setPlayerGainDb: vi.fn(),
  setLoop: vi.fn(),
  stopPlayback: vi.fn(),
  saveExport: vi.fn(),
}));

vi.mock("@/lib/client/studio", () => ({ useStudio: () => ctx }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/mix",
}));

const { StudioShell } = await import("@/components/shell/StudioShell");

afterEach(() => cleanup());

describe("studio shell across screen sizes", () => {
  it("keeps the brand, slogan and all three studio names", () => {
    ctx.projects = [project];
    ctx.project = project;
    const { container } = render(
      <StudioShell>
        <div>content</div>
      </StudioShell>,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Elder Mi");
    expect(text).toContain("Your Sound. Your Culture. Your Studio.");
    expect(text).toContain("Sam Vocal Studio");
    expect(text).toContain("Sam Mix Studio");
    expect(text).toContain("Sam Mastering Studio");
    expect(text).toContain("content");
  });

  it("marks the active workspace for assistive tech", () => {
    render(
      <StudioShell>
        <div />
      </StudioShell>,
    );
    const current = screen.getAllByRole("link").filter((el) => el.getAttribute("aria-current") === "page");
    expect(current.length).toBeGreaterThan(0);
    expect(current.some((el) => (el.textContent ?? "").includes("Sam Mix Studio"))).toBe(true);
  });

  it("renders the mobile project switcher and compact studio tabs", () => {
    ctx.projects = [project];
    ctx.project = project;
    const { container } = render(
      <StudioShell>
        <div />
      </StudioShell>,
    );
    const selects = container.querySelectorAll("select");
    // One desktop project switcher + one compact switcher for phones.
    expect(selects.length).toBeGreaterThanOrEqual(2);
    // Compact tabs carry the short workspace names.
    expect(container.textContent).toContain("Vocal");
    expect(container.textContent).toContain("Mastering");
  });

  it("renders the global player with safe-area aware positioning", () => {
    const { container } = render(
      <StudioShell>
        <div />
      </StudioShell>,
    );
    const player = container.querySelector(".safe-bottom");
    expect(player).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /^play$|^pause$/i }).length).toBeGreaterThan(0);
  });
});

describe("responsive stylesheet guards", () => {
  const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
  const tailwind = readFileSync(path.join(process.cwd(), "tailwind.config.ts"), "utf8");

  it("handles notches, dynamic viewports and iOS text sizing", () => {
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("100dvh");
    expect(css).toContain("-webkit-text-size-adjust");
  });

  it("prevents iOS zoom by keeping fields at 16px on phones", () => {
    expect(css).toMatch(/@media \(max-width: 640px\)/);
    expect(css).toMatch(/font-size: 16px/);
  });

  it("enlarges touch targets and sliders for touch pointers", () => {
    expect(css).toContain("@media (pointer: coarse)");
    expect(css).toMatch(/input\[type="range"\] \{\s*height: 34px;/);
  });

  it("declares the extra breakpoints used by the layouts", () => {
    expect(tailwind).toContain('xs: "400px"');
    expect(tailwind).toContain('"3xl": "1800px"');
    expect(tailwind).toContain("short:");
  });

  it("keeps a print stylesheet for technical reports", () => {
    expect(css).toContain("@media print");
  });
});
