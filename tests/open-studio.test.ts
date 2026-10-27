import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Open studio mode — the default the owner asked for.
 *
 * There is no sign-in screen: opening the app acts as one owner account, with
 * every role and admin rights, so every studio, project, share link and the
 * admin console are reachable immediately. These tests pin three things:
 *
 *  1. anonymous visitors *are* somebody (the owner), not a fake empty user;
 *  2. the mode is a switch — `STUDIO_ACCOUNTS=on` restores real logins without
 *     touching the data;
 *  3. work saved before the owner existed is not stranded.
 */

let tmpDir: string;
let auth: typeof import("@/lib/server/auth");
let db: typeof import("@/lib/server/db");
let repo: typeof import("@/lib/server/repo");

const ADMIN = "owner@openstudio.test";

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-open-"));
  process.env.DATA_DIR = tmpDir;
  process.env.ADMIN_EMAIL = ADMIN;
  delete process.env.STUDIO_ACCOUNTS;
  delete process.env.ALLOW_SIGNUP;
  vi.resetModules();
  auth = await import("@/lib/server/auth");
  db = await import("@/lib/server/db");
  repo = await import("@/lib/server/repo");

  // A project from before accounts existed: no owner at all.
  await db.mutateDb((state) => {
    state.projects.push({
      ...structuredClone(state.projects[0] ?? ({} as never)),
      id: "prj_orphan",
      name: "Song from before accounts",
      ownerId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
  });
});

afterAll(async () => {
  delete process.env.ADMIN_EMAIL;
  delete process.env.STUDIO_ACCOUNTS;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("open studio mode", () => {
  it("is on by default and off only when STUDIO_ACCOUNTS is set", () => {
    expect(auth.openStudioMode()).toBe(true);
    process.env.STUDIO_ACCOUNTS = "on";
    expect(auth.openStudioMode()).toBe(false);
    process.env.STUDIO_ACCOUNTS = "off";
    expect(auth.openStudioMode()).toBe(true);
    delete process.env.STUDIO_ACCOUNTS;
  });

  it("acts as an owner account even with no cookie at all", async () => {
    auth.__setSessionOverrideForTests(null);
    const user = await auth.currentUser();
    expect(user).not.toBeNull();
    expect(user?.email).toBe(ADMIN);
    expect(user?.isAdmin).toBe(true);
    // Every role, so no studio or dashboard is closed.
    expect(user?.roles).toEqual(expect.arrayContaining(["artist", "producer", "engineer", "promoter"]));
    expect(user?.handle).toBeTruthy();
  });

  it("creates that account once and reuses it", async () => {
    const first = await auth.openStudioOwner();
    const second = await auth.openStudioOwner();
    expect(second.id).toBe(first.id);
    const users = await db.readDb();
    expect(users.users.filter((entry) => entry.email === ADMIN)).toHaveLength(1);
  });

  it("claims projects saved before the owner existed", async () => {
    const owner = await auth.openStudioOwner();
    const projects = await repo.listProjects(owner.id);
    expect(projects.map((project) => project.id)).toContain("prj_orphan");
  });

  it("lets every guard through, including the admin console", async () => {
    await expect(auth.requireUser()).resolves.toMatchObject({ email: ADMIN });
    await expect(auth.requireAdmin()).resolves.toMatchObject({ isAdmin: true });
    for (const studio of ["vocal", "mix", "mastering"] as const) {
      const guarded = await auth.guardStudio(studio);
      expect(guarded.response).toBeUndefined();
    }
    expect((await auth.guardAnyStudio()).response).toBeUndefined();
    expect((await auth.adminGuard()).response).toBeUndefined();
  });

  it("goes back to needing a session when accounts are switched on", async () => {
    process.env.STUDIO_ACCOUNTS = "on";
    try {
      auth.__setSessionOverrideForTests(null);
      expect(await auth.currentUser()).toBeNull();
      await expect(auth.requireUser()).rejects.toThrow(/sign in/i);
      const guarded = await auth.guardStudio("mix");
      expect(guarded.response?.status).toBe(401);
    } finally {
      delete process.env.STUDIO_ACCOUNTS;
    }
  });
});
