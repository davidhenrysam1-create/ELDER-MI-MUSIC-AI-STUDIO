import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ROLES,
  ROLE_LABEL,
  canAdminister,
  canOpenRoute,
  canPublish,
  canUseStudio,
  describeRoles,
  homeForRoles,
  studiosForRoles,
} from "@/lib/roles";

/**
 * The role map is the one place that decides what an account gets, so it is
 * tested directly instead of only through the pages that use it.
 */
describe("role → studio mapping", () => {
  it("gives producers and engineers all three studios", () => {
    for (const role of ["producer", "engineer"] as const) {
      expect(studiosForRoles([role])).toEqual(["vocal", "mix", "mastering"]);
    }
  });

  it("gives artists the vocal studio but not mixing or mastering", () => {
    expect(canUseStudio(["artist"], "vocal")).toBe(true);
    expect(canUseStudio(["artist"], "mix")).toBe(false);
    expect(canUseStudio(["artist"], "mastering")).toBe(false);
  });

  it("gives promoters no processing tools at all", () => {
    for (const studio of ["vocal", "mix", "mastering"] as const) {
      expect(canUseStudio(["promoter"], studio)).toBe(false);
    }
    expect(studiosForRoles(["promoter"])).toEqual([]);
  });

  it("combines several roles", () => {
    expect(canUseStudio(["artist", "producer"], "mastering")).toBe(true);
    expect(canUseStudio(["promoter", "artist"], "vocal")).toBe(true);
    expect(describeRoles(["artist", "producer"])).toBe("Artist & Producer");
  });

  it("treats a missing role as no access, not full access", () => {
    expect(canUseStudio(undefined, "mix")).toBe(false);
    expect(canUseStudio([], "vocal")).toBe(false);
    expect(canPublish(undefined)).toBe(false);
  });

  it("lets the admin through every gate", () => {
    expect(canUseStudio([], "mastering", true)).toBe(true);
    expect(canPublish([], true)).toBe(true);
    expect(canAdminister(true)).toBe(true);
    expect(canAdminister(false)).toBe(false);
    expect(canAdminister(undefined)).toBe(false);
  });

  it("sends an account without roles to the welcome screen", () => {
    expect(homeForRoles([])).toBe("/welcome");
    expect(homeForRoles(["promoter"])).toBe("/");
  });

  it("describes roles for a human", () => {
    expect(describeRoles([])).toBe("No role chosen yet");
    expect(describeRoles(["engineer"])).toBe("Engineer");
    expect(describeRoles(["promoter", "artist", "engineer"])).toBe("Artist, Engineer & Promoter");
  });

  it("has a label for every role it ships", () => {
    expect(ACCOUNT_ROLES).toHaveLength(4);
    for (const role of ACCOUNT_ROLES) expect(ROLE_LABEL[role].length).toBeGreaterThan(2);
  });
});

describe("role → route guard", () => {
  it("refuses the mixer and mastering pages to an artist", () => {
    expect(canOpenRoute("/mix", ["artist"])).toBe(false);
    expect(canOpenRoute("/mastering", ["artist"])).toBe(false);
    expect(canOpenRoute("/vocal", ["artist"])).toBe(true);
  });

  it("refuses the vocal and mixing pages to a promoter but allows publishing", () => {
    expect(canOpenRoute("/vocal", ["promoter"])).toBe(false);
    expect(canOpenRoute("/mix", ["promoter"])).toBe(false);
    expect(canOpenRoute("/publish", ["promoter"])).toBe(true);
    expect(canOpenRoute("/shares", ["promoter"])).toBe(true);
  });

  it("always allows the dashboard, projects, account, settings and documentation", () => {
    for (const path of ["/", "/projects", "/projects/abc", "/account", "/settings", "/docs", "/help"]) {
      expect(canOpenRoute(path, ["promoter"])).toBe(true);
    }
  });

  it("lets the admin open anything", () => {
    expect(canOpenRoute("/mastering", [], true)).toBe(true);
  });
});
