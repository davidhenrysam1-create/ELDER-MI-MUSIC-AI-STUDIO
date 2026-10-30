// @vitest-environment jsdom
/**
 * The account icon in the top-right corner of the studio header.
 *
 * Why this is tested: the header used to draw a static "EM · Studio owner ·
 * local" chip — hardcoded initials, no click, hidden on phones. These tests pin
 * what replaced it: real initials, real account details, and a menu that a
 * signed-out visitor can actually use to reach the sign-in screen.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AccountMenu, initialsFor } from "@/components/shell/AccountMenu";
import type { AccountUser } from "@/lib/client/api";

afterEach(cleanup);

const owner: AccountUser = {
  id: "usr_1",
  email: "david@example.test",
  name: "David Henry Sam",
  role: "owner",
  roles: ["artist", "producer", "engineer", "promoter"],
  isAdmin: true,
  handle: "admin",
  emailVerified: true,
} as AccountUser;

describe("initialsFor", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFor({ name: "Elder Mi", email: "x@y.z" })).toBe("EM");
    expect(initialsFor({ name: "david henry sam", email: "x@y.z" })).toBe("DH");
  });

  it("falls back to the address when there is no usable name", () => {
    expect(initialsFor({ name: "", email: "davidhenrysam1@gmail.com" })).toBe("DA");
    expect(initialsFor(null)).toBe("?");
  });

  it("never returns an empty circle", () => {
    expect(initialsFor({ name: "   ", email: "" })).toBe("?");
  });
});

describe("the account icon", () => {
  it("shows the signed-in account's initials on the button", () => {
    render(<AccountMenu user={owner} openStudio={false} />);
    const button = screen.getByRole("button", { name: /account menu/i });
    expect(button.textContent).toContain("DH");
  });

  it("is a real menu that opens with the account it belongs to", () => {
    render(<AccountMenu user={owner} openStudio={false} />);
    // Closed until asked: the details are not in the page.
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));

    const menu = screen.getByRole("menu");
    expect(menu.textContent).toContain("David Henry Sam");
    expect(menu.textContent).toContain("david@example.test");
    // Roles come from the account, not from a hardcoded string.
    expect(menu.textContent?.toLowerCase()).toContain("artist");
    expect(menu.textContent).toContain("admin");
  });

  it("links to My account and the admin console", () => {
    render(<AccountMenu user={owner} openStudio={false} />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menuitem", { name: /my account/i }).getAttribute("href")).toBe("/account");
    expect(screen.getByRole("menuitem", { name: /admin console/i }).getAttribute("href")).toBe("/admin");
  });

  it("hides the admin entry from a non-admin", () => {
    render(<AccountMenu user={{ ...owner, isAdmin: false }} openStudio={false} />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.queryByRole("menuitem", { name: /admin console/i })).toBeNull();
  });

  it("signs out from the menu, and closes it first", () => {
    const onSignOut = vi.fn();
    render(<AccountMenu user={owner} openStudio={false} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("offers no sign-out in open-studio mode, because there is no login screen", () => {
    render(<AccountMenu user={owner} openStudio />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.queryByRole("menuitem", { name: /sign out/i })).toBeNull();
    // The account itself is still reachable.
    expect(screen.getByRole("menuitem", { name: /studio profile/i }).getAttribute("href")).toBe(
      "/account",
    );
  });

  it("becomes a plain Sign in link when nobody is signed in", () => {
    render(<AccountMenu user={null} openStudio={false} />);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link.getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("button", { name: /account menu/i })).toBeNull();
  });

  it("shows a neutral placeholder while the session is still loading", () => {
    render(<AccountMenu user={null} openStudio={false} loading />);
    // Not a "Sign in" link: nothing claims the visitor is signed out yet.
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /account menu/i })).toBeNull();
    expect(screen.getByLabelText(/loading account/i)).toBeTruthy();
  });

  it("closes on Escape", () => {
    render(<AccountMenu user={owner} openStudio={false} />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
