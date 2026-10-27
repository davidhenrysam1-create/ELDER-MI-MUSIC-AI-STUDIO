// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { emptyProject } from "@/lib/projects";
import type { ProviderDescriptor } from "@/lib/server/providers/types";
import type { GenerationJob } from "@/lib/types";

/**
 * Generate panel behaviour.
 *
 * The point of these tests is honesty: with no key the panel must explain setup
 * instead of offering a button, with the budget switches closed it must not send
 * anything, and a completed job must be reported with the provider's own message.
 */

const project = emptyProject("Generate Test", "Afrobeats", 104, "F# minor");

const ctx = vi.hoisted(() => ({
  project: null as unknown,
  replaceProject: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/client/studio", () => ({ useStudio: () => ctx }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/mix",
}));

/** Build a descriptor with sensible defaults for each provider id. */
function descriptor(overrides: Partial<ProviderDescriptor> = {}): ProviderDescriptor {
  return {
    id: "elevenlabs_music",
    name: "ElevenLabs Music",
    vendor: "ElevenLabs",
    kinds: ["song", "vocals"],
    configured: true,
    keyEnv: ["ELEVENLABS_API_KEY"],
    model: "music_v1",
    docsUrl: "https://example.test/docs",
    licence: "Vendor terms apply.",
    estimateUsdPerSecond: 0.01,
    maxDurationSec: 300,
    async: false,
    note: "Test provider",
    ...overrides,
  };
}

function catalogue(options: {
  providers: ProviderDescriptor[];
  allowPaidGeneration?: boolean;
  capUsd?: number;
  lifetimeUsd?: number;
}) {
  const configured = options.providers.filter((entry) => entry.configured);
  return {
    providers: options.providers,
    summary: {
      total: options.providers.length,
      configured: configured.length,
      usableKinds: Array.from(new Set(configured.flatMap((entry) => entry.kinds))),
      note: "test",
    },
    spend: {
      lifetimeUsd: options.lifetimeUsd ?? 0,
      capUsd: options.capUsd ?? 5,
      allowPaidGeneration: options.allowPaidGeneration ?? false,
      remainingUsd: (options.capUsd ?? 5) - (options.lifetimeUsd ?? 0),
    },
    settings: {
      allowPaidGeneration: options.allowPaidGeneration ?? false,
      spendCapUsd: options.capUsd ?? 5,
    },
  };
}

const completedJob: GenerationJob = {
  id: "gen_test",
  projectId: project.id,
  providerId: "elevenlabs_music",
  modelId: "music_v1",
  kind: "song",
  prompt: "afrobeats love song",
  negativePrompt: null,
  durationSec: 30,
  status: "completed",
  progress: 100,
  message: "Generated song — afrobeats-love-song.mp3 added to the project",
  providerJobId: null,
  assetId: "ast_test",
  costEstimateUsd: 0.3,
  costChargedUsd: 0.3,
  licence: "Vendor terms apply.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** Route mocked fetches by URL. */
function stubApi(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    void init;
    const key = Object.keys(routes).find((candidate) => url.startsWith(candidate));
    if (!key) return new Response("{}", { status: 200 });
    return new Response(JSON.stringify(routes[key]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  ctx.project = project;
  ctx.replaceProject.mockReset();
  ctx.notify.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GeneratePanel", () => {
  it("explains which key to add when nothing is configured", async () => {
    stubApi({
      "/api/providers": catalogue({
        providers: [
          descriptor({ configured: false, id: "lyria", name: "Google Lyria 2", keyEnv: ["GOOGLE_API_KEY", "GOOGLE_VERTEX_PROJECT"] }),
          descriptor({ configured: false }),
        ],
      }),
    });
    const { GeneratePanel } = await import("@/components/studio/GeneratePanel");
    render(<GeneratePanel studio="mix" />);

    await waitFor(() => expect(screen.getByText(/No generation provider is configured/i)).toBeTruthy());
    expect(screen.getByText(/GOOGLE_API_KEY \+ GOOGLE_VERTEX_PROJECT/)).toBeTruthy();
    // No generate button while there is nothing to call.
    expect(screen.queryByRole("button", { name: /Generate audio/i })).toBeNull();
  });

  it("shows the budget state and disables generation while paid use is off", async () => {
    stubApi({
      "/api/providers": catalogue({
        providers: [descriptor()],
        allowPaidGeneration: false,
        capUsd: 5,
        lifetimeUsd: 1.25,
      }),
    });
    const { GeneratePanel } = await import("@/components/studio/GeneratePanel");
    render(<GeneratePanel studio="vocal" defaultKind="song" />);

    await waitFor(() => expect(screen.getByText(/Paid generation off/i)).toBeTruthy());
    expect(screen.getByText(/Used/)).toBeTruthy();
    const button = screen.getByRole("button", { name: /Generate audio/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("sends the request and reports the provider's completed message", async () => {
    const fetchMock = stubApi({
      "/api/providers": catalogue({
        providers: [descriptor()],
        allowPaidGeneration: true,
        capUsd: 5,
      }),
      "/api/generate": { job: completedJob, asset: null },
      "/api/projects/": { project },
    });
    const { GeneratePanel } = await import("@/components/studio/GeneratePanel");
    render(<GeneratePanel studio="vocal" defaultKind="song" />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Generate audio/i })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Brief/i), {
      target: { value: "afrobeats love song with male tenor lead" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate audio/i }));

    await waitFor(() => expect(ctx.notify).toHaveBeenCalled());
    const [level, title, message] = ctx.notify.mock.calls.at(-1)!;
    expect(level).toBe("success");
    expect(title).toBe("Audio generated");
    expect(String(message)).toContain("added to the project");

    // The POST body must carry the real request the producer made.
    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/generate" && (init as RequestInit | undefined)?.method === "POST",
    );
    expect(post).toBeDefined();
    const body = JSON.parse(String((post![1] as RequestInit).body)) as Record<string, unknown>;
    expect(body.providerId).toBe("elevenlabs_music");
    expect(body.kind).toBe("song");
    expect(body.prompt).toContain("afrobeats love song");
    expect(body.projectId).toBe(project.id);
  });

  it("surfaces a refused request without inventing success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/providers") {
          return new Response(
            JSON.stringify(
              catalogue({ providers: [descriptor()], allowPaidGeneration: true, capUsd: 5 }),
            ),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ error: "This request would exceed the $5.00 spend cap." }),
          { status: 402, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const { GeneratePanel } = await import("@/components/studio/GeneratePanel");
    render(<GeneratePanel studio="vocal" defaultKind="song" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Generate audio/i })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Brief/i), {
      target: { value: "a full song please" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate audio/i }));

    await waitFor(() => expect(ctx.notify).toHaveBeenCalled());
    const [level, , message] = ctx.notify.mock.calls.at(-1)!;
    expect(level).toBe("error");
    expect(String(message)).toContain("spend cap");
    expect(ctx.replaceProject).not.toHaveBeenCalled();
  });
});
