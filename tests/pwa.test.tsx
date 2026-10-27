// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import manifest from "@/app/manifest";
import OfflinePage from "@/app/offline/page";
import { PwaBridge } from "@/components/pwa/PwaBridge";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("web app manifest", () => {
  const data = manifest();

  it("is installable with the correct identity and scope", () => {
    expect(data.name).toBe("Elder Mi Music AI Studio");
    expect(data.short_name).toBe("Elder Mi");
    expect(data.start_url).toBe("/");
    expect(data.scope).toBe("/");
    expect(data.display).toBe("standalone");
    expect(data.theme_color).toBe("#090914");
    expect(data.background_color).toBe("#090914");
  });

  it("ships both a maskable and a standard icon at installable sizes", () => {
    const icons = data.icons ?? [];
    const sizes = icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      expect(readFileSync(path.join(process.cwd(), "public", icon.src!)).length).toBeGreaterThan(1000);
    }
  });

  it("adds shortcuts for the three named studios", () => {
    const urls = (data.shortcuts ?? []).map((shortcut) => shortcut.url);
    expect(urls).toEqual(expect.arrayContaining(["/vocal", "/mix", "/mastering"]));
    expect(data.shortcuts?.[0]?.name).toBe("Sam Vocal Studio");
  });

  it("declares any orientation so phones and tablets can rotate freely", () => {
    expect(data.orientation).toBe("any");
  });
});

describe("service worker", () => {
  const source = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

  it("never caches API responses or audio streams", () => {
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain("isPrivateData");
  });

  it("has an offline navigation fallback", () => {
    expect(source).toContain('"/offline"');
    expect(source).toContain('self.addEventListener("fetch"');
  });
});

describe("PwaBridge", () => {
  it("renders nothing when the studio is already installed", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("standalone"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { container } = render(<PwaBridge />);
    expect(container.textContent).toBe("");
  });

  it("shows an install action when the browser offers one", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    render(<PwaBridge />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(event);

    const install = await screen.findByRole("button", { name: /^Install$/i });
    fireEvent.click(install);
    expect(prompt).toHaveBeenCalled();
  });

  it("explains Add to Home Screen on iPhone instead of faking an install button", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const userAgent = vi.spyOn(window.navigator, "userAgent", "get");
    userAgent.mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    Object.defineProperty(document, "ontouchend", { value: () => {}, configurable: true });

    render(<PwaBridge />);
    expect(await screen.findByText(/Add Elder Mi to your Home Screen/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Install$/i })).toBeNull();
    userAgent.mockRestore();
  });

  it("respects a dismissed prompt", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    window.localStorage.setItem("eldermi.installDismissed", "1");
    const { container } = render(<PwaBridge />);
    window.dispatchEvent(new Event("beforeinstallprompt"));
    expect(container.textContent).toBe("");
  });
});

describe("offline page", () => {
  it("is honest about what needs the studio server", () => {
    const { container } = render(<OfflinePage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/offline/i);
    expect(text).toMatch(/Nothing has been lost/i);
    expect(text).toMatch(/needs a connection/i);
  });
});
