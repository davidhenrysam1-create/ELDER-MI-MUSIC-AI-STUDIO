// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { emptyProject } from "@/lib/projects";
import type { Project } from "@/lib/types";

const project: Project = emptyProject("Lagos Nights", "Afrobeats", 104, "F# minor");

const studioMock = vi.hoisted(() => {
  return {
    context: {
      ready: true,
      loading: false,
      loadError: null,
      projects: [] as unknown[],
      project: null as unknown,
      exports: [] as unknown[],
      settings: null as unknown,
      system: null as unknown,
      saveState: "saved",
      savedAt: null,
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
    },
  };
});

vi.mock("@/lib/client/studio", () => ({
  useStudio: () => studioMock.context,
}));

// The dashboard renders the "new project" dialog, which uses the App Router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

const { default: DashboardPage } = await import("@/app/page");

afterEach(() => cleanup());

describe("dashboard", () => {
  it("shows the brand slogan and all three studio names", () => {
    studioMock.context.projects = [project];
    studioMock.context.project = project;
    studioMock.context.system = {
      providers: { gemini: { configured: false, model: "gemini-2.5-flash" } },
      storage: { audioBytes: 0, exportBytes: 0 },
      engines: {},
      settings: {},
      version: "1.0.0",
    };
    render(<DashboardPage />);

    expect(screen.getByText(/Your Sound\. Your Culture\. Your Studio\./)).toBeTruthy();
    expect(screen.getAllByText(/Sam Vocal Studio/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sam Mix Studio/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sam Mastering Studio/).length).toBeGreaterThan(0);
  });

  it("states that AI providers are not configured instead of faking them", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Gemini not configured|local rules engine/i)).toBeTruthy();
  });

  it("invites the user to create a project when the studio is empty", () => {
    studioMock.context.projects = [];
    studioMock.context.project = null;
    render(<DashboardPage />);
    expect(screen.getAllByText(/project/i).length).toBeGreaterThan(0);
  });
});
