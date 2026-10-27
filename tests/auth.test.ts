import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Accounts, sessions and data isolation.
 *
 * These exercise the real modules against a temporary data directory: password
 * hashing, sign-up rules, the owner claim of pre-accounts projects, and — most
 * importantly — that one account can never read another account's music.
 */

let tmpDir: string;
let auth: typeof import("@/lib/server/auth");
let repo: typeof import("@/lib/server/repo");
let db: typeof import("@/lib/server/db");

const PASSWORD = "correct horse battery";

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-auth-"));
  process.env.DATA_DIR = tmpDir;
  delete process.env.ALLOW_SIGNUP;
  vi.resetModules();
  auth = await import("@/lib/server/auth");
  repo = await import("@/lib/server/repo");
  db = await import("@/lib/server/db");
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // No test may inherit a signed-in state from another.
  auth.__setSessionOverrideForTests(null);
});

describe("password storage", () => {
  it("never stores the password and verifies only the right one", async () => {
    const hash = await auth.hashPassword(PASSWORD);
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(hash).not.toContain(PASSWORD);
    expect(await auth.verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await auth.verifyPassword("wrong password", hash)).toBe(false);
  });

  it("salted: the same password hashes differently twice", async () => {
    const a = await auth.hashPassword(PASSWORD);
    const b = await auth.hashPassword(PASSWORD);
    expect(a).not.toBe(b);
  });

  it("treats a malformed hash as a failed login instead of throwing", async () => {
    expect(await auth.verifyPassword(PASSWORD, "not-a-hash")).toBe(false);
    expect(await auth.verifyPassword(PASSWORD, "scrypt$1$2$3$4")).toBe(false);
  });
});

describe("sign-up", () => {
  it("rejects short passwords, bad emails and short names", async () => {
    await expect(
      auth.signup({ name: "Ada", email: "ada@studio.test", password: "short" }),
    ).rejects.toThrow(/at least 8/i);
    await expect(
      auth.signup({ name: "Ada", email: "not-an-email", password: PASSWORD }),
    ).rejects.toThrow(/valid email/i);
    await expect(
      auth.signup({ name: "A", email: "a@studio.test", password: PASSWORD }),
    ).rejects.toThrow(/name/i);
  });

  it("makes the first account the owner and claims pre-account projects", async () => {
    // Simulates data saved before accounts existed (ownerId null).
    const orphan = await repo.createProject({ name: "Legacy session" });
    expect(orphan.ownerId).toBeNull();

    const owner = await auth.signup({
      name: "Elder Mi",
      email: "Owner@Studio.test",
      password: PASSWORD,
    });
    expect(owner.role).toBe("owner");
    expect(owner.email).toBe("owner@studio.test"); // normalised
    expect((owner as { passwordHash?: string }).passwordHash).toBeUndefined();

    const claimed = await repo.getProject(orphan.id);
    expect(claimed?.ownerId).toBe(owner.id);
  });

  it("refuses a duplicate email and a second owner", async () => {
    await expect(
      auth.signup({ name: "Impostor", email: "owner@studio.test", password: PASSWORD }),
    ).rejects.toMatchObject({ status: 409 });

    const member = await auth.signup({
      name: "Session guitarist",
      email: "guitar@studio.test",
      password: PASSWORD,
    });
    expect(member.role).toBe("member");
  });

  it("can be closed with ALLOW_SIGNUP=false but still allows the first account", async () => {
    const fresh = await mkdtemp(path.join(os.tmpdir(), "eldermi-signup-"));
    process.env.DATA_DIR = fresh;
    process.env.ALLOW_SIGNUP = "false";
    vi.resetModules();
    const isolatedAuth = await import("@/lib/server/auth");
    const first = await isolatedAuth.signup({
      name: "Owner",
      email: "first@studio.test",
      password: PASSWORD,
    });
    expect(first.role).toBe("owner");
    await expect(
      isolatedAuth.signup({ name: "Second", email: "second@studio.test", password: PASSWORD }),
    ).rejects.toMatchObject({ status: 403 });
    delete process.env.ALLOW_SIGNUP;
    await rm(fresh, { recursive: true, force: true });
    vi.resetModules();
    process.env.DATA_DIR = tmpDir;
    auth = await import("@/lib/server/auth");
    repo = await import("@/lib/server/repo");
    db = await import("@/lib/server/db");
  });
});

describe("sign-in", () => {
  it("accepts the right password and rejects the wrong one with the same message", async () => {
    const user = await auth.login({ email: "owner@studio.test", password: PASSWORD });
    expect(user.email).toBe("owner@studio.test");

    await expect(
      auth.login({ email: "owner@studio.test", password: "nope" }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      auth.login({ email: "owner@studio.test", password: "nope" }),
    ).rejects.toThrow(/incorrect/i);
    await expect(
      auth.login({ email: "missing@studio.test", password: PASSWORD }),
    ).rejects.toThrow(/incorrect/i);
  });

  it("records the device and expiry of a session", async () => {
    await auth.login(
      { email: "owner@studio.test", password: PASSWORD },
      "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile",
    );
    const sessions = await auth.listSessions(
      (await db.readDb()).users.find((entry) => entry.email === "owner@studio.test")!.id,
    );
    expect(sessions[0].device).toContain("Chrome on Android");
    expect(new Date(sessions[0].expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("changes the password, revoking other sessions", async () => {
    const user = await auth.login({ email: "guitar@studio.test", password: PASSWORD });
    await expect(
      auth.changePassword(user.id, { currentPassword: "wrong", newPassword: "a new password" }),
    ).rejects.toMatchObject({ status: 401 });

    await auth.changePassword(user.id, {
      currentPassword: PASSWORD,
      newPassword: "a brand new password",
    });
    await expect(
      auth.login({ email: "guitar@studio.test", password: PASSWORD }),
    ).rejects.toMatchObject({ status: 401 });
    const again = await auth.login({ email: "guitar@studio.test", password: "a brand new password" });
    expect(again.id).toBe(user.id);
    const sessions = await auth.listSessions(user.id);
    expect(sessions).toHaveLength(1);
  });
});

describe("data isolation", () => {
  it("keeps each account's projects, exports and profiles separate", async () => {
    const owner = (await auth.login({ email: "owner@studio.test", password: PASSWORD })) as {
      id: string;
    };
    const member = (await auth.login({ email: "guitar@studio.test", password: "a brand new password" })) as {
      id: string;
    };

    const mine = await repo.createProject({ name: "Owner session" }, owner.id);
    const theirs = await repo.createProject({ name: "Guitar session" }, member.id);

    expect((await repo.listProjects(owner.id)).map((p) => p.id)).toContain(mine.id);
    expect((await repo.listProjects(owner.id)).map((p) => p.id)).not.toContain(theirs.id);

    // Cross-account reads and deletes are reported as "not found", not "forbidden",
    // so an id cannot be probed.
    expect(await repo.getProject(mine.id, member.id)).toBeNull();
    expect(await repo.getProject(theirs.id, owner.id)).toBeNull();
    expect(await repo.deleteProject(mine.id, member.id)).toBe(false);
    expect(await repo.getProject(mine.id, owner.id)).not.toBeNull();
  });

  it("scopes the guarded routes to the signed-in account", async () => {
    const owner = (await auth.login({ email: "owner@studio.test", password: PASSWORD })) as {
      id: string;
      email: string;
      name: string;
      role: "owner" | "member";
      createdAt: string;
      lastLoginAt: string | null;
    };
    const projectsRoute = await import("@/app/api/projects/route");

    // No session: the route answers 401 instead of leaking a project list.
    auth.__setSessionOverrideForTests(null);
    const anon = await projectsRoute.GET();
    expect(anon.status).toBe(401);

    auth.__setSessionOverrideForTests(async () => owner);
    const signedIn = await projectsRoute.GET();
    expect(signedIn.status).toBe(200);
    const body = (await signedIn.json()) as { projects: { ownerId: string }[] };
    expect(body.projects.every((project) => project.ownerId === owner.id)).toBe(true);
  });

  it("deleting a member removes their sessions and share links", async () => {
    const member = (await auth.login({ email: "guitar@studio.test", password: "a brand new password" })) as {
      id: string;
    };
    await auth.deleteUser(member.id);
    const state = await db.readDb();
    expect(state.users.some((user) => user.id === member.id)).toBe(false);
    expect(state.sessions.some((session) => session.userId === member.id)).toBe(false);
    expect(state.shares.some((share) => share.ownerId === member.id)).toBe(false);
  });
});
