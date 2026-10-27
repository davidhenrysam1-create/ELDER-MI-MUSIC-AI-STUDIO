// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyProject } from "@/lib/projects";
import type { Project } from "@/lib/types";

const project: Project = emptyProject("Render Test", "Afrobeats", 104, "F# minor");

const ctx = vi.hoisted(() => ({
  user: {
    id: "usr_page_test",
    email: "tester@studio.test",
    name: "Page Tester",
    role: "owner",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: null,
  },
  signupOpen: true,
  signOut: vi.fn(),
  ready: true,
  loading: false,
  loadError: null,
  projects: [] as unknown[],
  project: null as unknown,
  exports: [] as unknown[],
  settings: {
    defaultExportFormat: "wav24",
    dither16Bit: true,
    autoSave: true,
    processingQuality: "balanced",
    maxUploadMb: 80,
    maxDurationSec: 720,
  },
  system: {
    version: "1.0.0",
    providers: {
      gemini: { configured: false, model: "gemini-2.5-flash" },
      voiceConversion: { configured: false, note: "Requires a licensed provider." },
    },
    storage: { audioBytes: 0, exportBytes: 0 },
    engines: { analysis: "Local BS.1770", playback: "Web Audio", rendering: "Offline" },
    settings: {},
  },
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
  usePathname: () => "/vocal",
  useSearchParams: () => new URLSearchParams(),
}));

const pages = [
  { name: "Sam Vocal Studio", file: "@/app/vocal/page", heading: /Sam Vocal Studio/i },
  { name: "Sam Mix Studio", file: "@/app/mix/page", heading: /Sam Mix Studio/i },
  { name: "Sam Mastering Studio", file: "@/app/mastering/page", heading: /Sam Mastering Studio/i },
  { name: "Projects", file: "@/app/projects/page", heading: /My Projects/i },
  { name: "Voice profiles", file: "@/app/voice-profiles/page", heading: /My Voice Profiles/i },
  { name: "Exports", file: "@/app/exports/page", heading: /Export History|Exports/i },
  { name: "Settings", file: "@/app/settings/page", heading: /Settings/i },
  { name: "Account", file: "@/app/account/page", heading: /My account/i },
  { name: "Share with friends", file: "@/app/shares/page", heading: /Share with friends/i },
  { name: "Sign in", file: "@/app/login/page", heading: /Sign in/i },
  { name: "Create account", file: "@/app/signup/page", heading: /Create your account/i },
  { name: "Docs", file: "@/app/docs/page", heading: /Studio documentation/i },
  { name: "Help", file: "@/app/help/page", heading: /Help/i },
] as const;

afterEach(() => cleanup());

describe("studio pages render with an open project", () => {
  for (const page of pages) {
    it(`${page.name} renders its heading`, async () => {
      ctx.projects = [project];
      ctx.project = project;
      const mod = (await import(/* @vite-ignore */ page.file)) as {
        default: () => React.ReactElement;
      };
      const Page = mod.default;
      const { container } = render(<Page />);
      expect(container.textContent ?? "").toMatch(page.heading);
      expect(container.textContent?.length ?? 0).toBeGreaterThan(120);
    });
  }
});

describe("empty project states", () => {
  for (const page of pages) {
    it(`${page.name} renders without a project`, async () => {
      ctx.projects = [];
      ctx.project = null;
      const mod = (await import(/* @vite-ignore */ page.file)) as {
        default: () => React.ReactElement;
      };
      const Page = mod.default;
      const { container } = render(<Page />);
      expect(container.textContent?.length ?? 0).toBeGreaterThan(20);
    });
  }
});

describe("studio interactions", () => {
  it("opens the FL Studio / Cubase stem guide", async () => {
    ctx.projects = [project];
    ctx.project = project;
    const Page = (await import("@/app/mix/page")).default;
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: /FL Studio & Cubase stems/i }));
    expect(screen.getByText(/Split mixer tracks/i)).toBeTruthy();
    expect(screen.getByText(/Audio Mixdown/i)).toBeTruthy();
    expect(screen.getByText(/\.flp projects are detected/i)).toBeTruthy();
  });

  it("writes a selected genre starting point into the project", async () => {
    ctx.projects = [project];
    ctx.project = project;
    const Page = (await import("@/app/mix/page")).default;
    render(<Page />);
    const presetSelect = screen
      .getAllByRole("combobox")
      .find((el) => (el as HTMLSelectElement).value === project.mix.presetId) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: "afro_pop" } });
    const updater = (ctx.updateProject as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)?.[0] as
      | ((p: Project) => Project)
      | undefined;
    expect(updater).toBeTruthy();
    expect(updater!(project).mix.presetId).toBe("afro_pop");
  });

  it("loads a mastering profile into the controls", async () => {
    ctx.projects = [project];
    ctx.project = project;
    const Page = (await import("@/app/mastering/page")).default;
    render(<Page />);
    const profileButton = screen.getByRole("button", { name: /Warm Afrobeats Master/i });
    fireEvent.click(profileButton);
    const updater = (ctx.updateProject as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)?.[0] as
      | ((p: Project) => Project)
      | undefined;
    expect(updater).toBeTruthy();
    const next = updater!(project);
    expect(next.mastering.profileId).toBe("warm");
    expect(Number.isFinite(next.mastering.controls.targetLufs)).toBe(true);
    expect(next.mastering.controls.targetLufs).toBeLessThan(0);
  });

  it("explains that neural voice transformation is unavailable instead of faking it", async () => {
    ctx.projects = [project];
    ctx.project = project;
    const Page = (await import("@/app/vocal/page")).default;
    render(<Page />);
    const transform = screen.getByRole("button", { name: /Voice Transformation/i });
    expect(transform).toBeTruthy();
    (ctx.notify as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(transform!);
    expect(ctx.notify).toHaveBeenCalled();
    const [, title, message] = (ctx.notify as ReturnType<typeof vi.fn>).mock.calls[0] as string[];
    expect(title.toLowerCase()).toContain("needs configuration");
    expect(message.length).toBeGreaterThan(20);
  });
});
