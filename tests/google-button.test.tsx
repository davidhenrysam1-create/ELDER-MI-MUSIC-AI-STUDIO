// @vitest-environment jsdom
/**
 * "Continue with Google" must never look broken.
 *
 * Two behaviours are pinned here, because both were bugs in the first build:
 * the button used to be a greyed-out "awaiting configuration" box that could
 * not be clicked, and setting Google up required finding the redirect URI
 * yourself. Now the button is always live and, while unconfigured, it explains
 * the one-time setup and shows the exact URI to paste into Google.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GoogleButton } from "@/components/auth/GoogleButton";

afterEach(() => cleanup());

describe("Continue with Google", () => {
  it("is a real link to the OAuth start route once Google is configured", () => {
    render(<GoogleButton configured />);
    const link = screen.getByRole("link", { name: /continue with google/i });
    expect(link.getAttribute("href")).toBe("/api/auth/google/start");
  });

  it("is still a clickable button when Google is not configured", () => {
    render(<GoogleButton configured={false} />);
    const button = screen.getByRole("button", { name: /continue with google/i });
    expect(button.hasAttribute("disabled")).toBe(false);
    // Nothing is shouted at the user before they ask for it.
    expect(screen.queryByText(/one-time set-up/i)).toBeNull();
  });

  it("opens the setup panel with the exact redirect URI for this address", () => {
    render(<GoogleButton configured={false} />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(screen.getByText(/google sign-in needs a one-time set-up/i)).toBeTruthy();
    // jsdom's default origin, i.e. the address the studio is open on.
    expect(screen.getByText(`${window.location.origin}/api/auth/google/callback`)).toBeTruthy();
    expect(screen.getByText(/nothing was sent to google/i)).toBeTruthy();
  });

  it("can arrive with the panel already open (after ?google=unconfigured)", () => {
    render(<GoogleButton configured={false} defaultOpen />);
    expect(screen.getByText(/google sign-in needs a one-time set-up/i)).toBeTruthy();
  });

  it("offers the email form as a way out", () => {
    const onUseEmail = vi.fn();
    render(<GoogleButton configured={false} defaultOpen onUseEmail={onUseEmail} />);
    fireEvent.click(screen.getByRole("button", { name: /use email and password instead/i }));
    expect(onUseEmail).toHaveBeenCalledTimes(1);
  });

  it("says so honestly when the clipboard is blocked", async () => {
    // A sandboxed iframe can refuse clipboard access; the button must not claim
    // a copy that did not happen.
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
    Object.assign(navigator, { clipboard: { writeText } });

    render(<GoogleButton configured={false} defaultOpen />);
    fireEvent.click(screen.getByRole("button", { name: /^copy$/i }));

    expect(await screen.findByText(/clipboard is blocked here/i)).toBeTruthy();
  });
});
