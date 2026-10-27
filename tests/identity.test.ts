import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Roles, the admin account, Google sign-in, the bootstrap code and email
 * verification — all against a real temporary data directory, with no mocks of
 * the auth module itself.
 *
 * The point of most of these tests is the *refusal*: an ordinary account must not
 * become admin, a suspended account must lose its sessions, the admin address
 * must not be claimable with a password, and no verification link may be reused.
 */

let tmpDir: string;
let auth: typeof import("@/lib/server/auth");
let db: typeof import("@/lib/server/db");

const PASSWORD = "correct horse battery";
const ADMIN = "admin@eldermi.test";

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-identity-"));
  process.env.DATA_DIR = tmpDir;
  process.env.ADMIN_EMAIL = ADMIN;
  process.env.ADMIN_BOOTSTRAP_CODE = "TEST-BOOTSTRAP-CODE";
  delete process.env.ALLOW_SIGNUP;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  vi.resetModules();
  auth = await import("@/lib/server/auth");
  db = await import("@/lib/server/db");
});

afterAll(async () => {
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_BOOTSTRAP_CODE;
  await rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  auth.__setSessionOverrideForTests(null);
});

/** Fresh account with a unique email. */
async function member(suffix: string, roles: ("artist" | "producer" | "engineer" | "promoter")[] = []) {
  return auth.signup(
    { name: `Member ${suffix}`, email: `${suffix}@studio.test`, password: PASSWORD, roles },
    "vitest",
  );
}

describe("roles on an account", () => {
  it("stores the roles chosen at sign-up and drops unknown ones", async () => {
    const user = await auth.signup(
      {
        name: "Role Tester",
        email: "roles@studio.test",
        password: PASSWORD,
        roles: ["artist", "producer", "wizard"] as never,
        handle: "role_tester",
      },
      "vitest",
    );
    expect(user.roles).toEqual(["artist", "producer"]);
    expect(user.handle).toBe("role_tester");
    expect(user.emailVerified).toBe(false);
    expect(user.provider).toBe("password");
  });

  it("never exposes the password hash or a verification token", async () => {
    const user = await member("private");
    const serialized = JSON.stringify(user);
    expect(serialized).not.toContain("scrypt$");
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("verifyTokenHash");
  });

  it("replaces roles rather than appending duplicates", async () => {
    const user = await member("setter", ["artist"]);
    const updated = await auth.setRoles(user.id, ["engineer", "engineer", "promoter"]);
    expect(updated.roles).toEqual(["engineer", "promoter"]);
  });

  it("refuses a handle another account already uses", async () => {
    await member("firsthandle");
    await auth.updateProfile((await member("secondhandle")).id, { handle: "unique_handle" });
    await expect(
      auth.updateProfile((await member("thirdhandle")).id, { handle: "unique_handle" }),
    ).rejects.toThrow(/already taken/i);
  });

  it("rejects a handle with spaces or symbols", async () => {
    const user = await member("badhandle");
    await expect(auth.updateProfile(user.id, { handle: "not a handle" })).rejects.toThrow(/handle/i);
  });
});

describe("profile links", () => {
  it("accepts https links and refuses anything else", async () => {
    const user = await member("links");
    const saved = await auth.updateProfile(user.id, {
      links: { audiomack: "https://audiomack.com/eldermi", instagram: "https://instagram.com/eldermi" },
    });
    expect(saved.links?.audiomack).toBe("https://audiomack.com/eldermi");

    await expect(
      auth.updateProfile(user.id, { links: { instagram: "javascript:alert(1)" } }),
    ).rejects.toThrow(/https/i);
  });
});

describe("public profile", () => {
  it("shows the handle's owner but not the email address", async () => {
    const user = await auth.signup(
      {
        name: "Public Person",
        email: "public@studio.test",
        password: PASSWORD,
        roles: ["artist"],
        handle: "public_person",
      },
      "vitest",
    );
    const profile = await auth.getPublicProfile("@PUBLIC_PERSON");
    expect(profile?.id).toBe(user.id);
    expect(profile?.roles).toEqual(["artist"]);
    expect(JSON.stringify(profile)).not.toContain("public@studio.test");
  });

  it("returns nothing for an unknown handle", async () => {
    expect(await auth.getPublicProfile("nobody_here")).toBeNull();
    expect(await auth.getPublicProfile("   ")).toBeNull();
  });

  it("hides a suspended account", async () => {
    const user = await auth.signup(
      {
        name: "Hidden Person",
        email: "hidden@studio.test",
        password: PASSWORD,
        roles: ["promoter"],
        handle: "hidden_person",
      },
      "vitest",
    );
    await auth.adminUpdateUser("someone", user.id, { suspended: true, suspendedReason: "Test" });
    expect(await auth.getPublicProfile("hidden_person")).toBeNull();
  });
});

describe("the admin account", () => {
  it("cannot be signed up for with a password", async () => {
    await expect(
      auth.signup({ name: "Fake Admin", email: ADMIN, password: PASSWORD }),
    ).rejects.toThrow(/reserved for the studio admin/i);
  });

  it("cannot be signed into with a password", async () => {
    // Either the address is unknown yet (generic 401) or the admin exists without
    // a password: both paths end in failure, which is the requirement — the admin
    // signs in with Google or the bootstrap code, never a password.
    await expect(auth.login({ email: ADMIN, password: PASSWORD })).rejects.toThrow(
      /Email or password is incorrect|Google|admin/i,
    );
  });

  it("is the only address reported as admin", async () => {
    const ordinary = await member("ordinary");
    expect(ordinary.isAdmin).toBe(false);
    expect(auth.isAdminEmail(ADMIN)).toBe(true);
    expect(auth.isAdminEmail("someone@else.test")).toBe(false);
  });

  it("gets admin rights from the ADMIN_EMAIL address only", async () => {
    // The Google path is how the admin normally arrives.
    const created = await auth.signInWithGoogle(
      { sub: "admin-sub", email: ADMIN, name: "Studio admin" },
      "vitest",
    );
    expect(created.isAdmin).toBe(true);
    expect(created.emailVerified).toBe(true);
    await expect(auth.adminUpdateUser(created.id, created.id, { suspended: true })).rejects.toThrow(
      /cannot suspend/i,
    );
    await expect(auth.adminUpdateUser(created.id, created.id, { suspended: false })).resolves.toBeTruthy();
  });
});

describe("suspension", () => {
  it("deletes every session for the account immediately", async () => {
    const user = await member("suspendme");
    const before = await db.readDb();
    expect(before.sessions.some((session) => session.userId === user.id)).toBe(true);

    await auth.adminUpdateUser("admin", user.id, {
      suspended: true,
      suspendedReason: "Spamming share links",
    });
    const after = await db.readDb();
    expect(after.sessions.some((session) => session.userId === user.id)).toBe(false);
    const row = after.users.find((entry) => entry.id === user.id);
    expect(row?.suspendedAt).toBeTruthy();
    expect(row?.suspendedReason).toBe("Spamming share links");
  });

  it("refuses sign-in while suspended, even with the right password", async () => {
    const user = await member("blocked");
    await auth.adminUpdateUser("admin", user.id, { suspended: true, suspendedReason: "Test" });
    await expect(auth.login({ email: user.email, password: PASSWORD })).rejects.toThrow(/suspended/i);
  });

  it("lets the admin reinstate the account", async () => {
    const user = await member("reinstated");
    await auth.adminUpdateUser("admin", user.id, { suspended: true });
    await auth.adminUpdateUser("admin", user.id, { suspended: false });
    const loggedIn = await auth.login({ email: user.email, password: PASSWORD });
    expect(loggedIn.id).toBe(user.id);
  });
});

describe("bootstrap code", () => {
  it("refuses a wrong code", async () => {
    await expect(auth.redeemBootstrapCode("NOT-THE-CODE", "vitest")).rejects.toThrow(/not correct/i);
  });

  it("signs the admin in once, with every role", async () => {
    const user = await auth.redeemBootstrapCode("TEST-BOOTSTRAP-CODE", "vitest");
    expect(user.isAdmin).toBe(true);
    expect(user.roles).toEqual(["artist", "producer", "engineer", "promoter"]);
    // A bootstrap admin has no password at all.
    expect(user.provider).toBe("bootstrap");
  });

  it("refuses the same code a second time", async () => {
    await expect(auth.redeemBootstrapCode("TEST-BOOTSTRAP-CODE", "vitest")).rejects.toThrow(
      /No bootstrap code is active|not correct/i,
    );
  });

  it("refuses once Google is configured", async () => {
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    try {
      expect(auth.googleConfigured()).toBe(true);
      await expect(auth.redeemBootstrapCode("TEST-BOOTSTRAP-CODE", "vitest")).rejects.toThrow(
        /Google sign-in is configured/i,
      );
      expect(auth.currentBootstrapCode()).toBeNull();
    } finally {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
    }
  });

  it("reports availability to the sign-in screen without leaking the code", async () => {
    const state = await auth.adminSignInState();
    // The address is masked, because /api/auth/me is readable without signing in.
    expect(state.adminEmailMasked).not.toBe(ADMIN);
    expect(state.adminEmailMasked?.endsWith("@eldermi.test")).toBe(true);
    expect(state.adminEmailMasked?.startsWith("a")).toBe(true);
    expect(state.googleConfigured).toBe(false);
    expect(JSON.stringify(state)).not.toContain("TEST-BOOTSTRAP-CODE");
  });
});

describe("Google sign-in", () => {
  const profile = {
    sub: "google-sub-1",
    email: "google-user@studio.test",
    name: "Google User",
  };

  it("creates a verified account on first sign-in", async () => {
    const user = await auth.signInWithGoogle(profile, "vitest");
    expect(user.provider).toBe("google");
    expect(user.emailVerified).toBe(true);
    expect(user.googleSub).toBe("google-sub-1");
    expect(user.roles).toEqual([]); // onboarding happens on /welcome
  });

  it("links the same Google account instead of duplicating it", async () => {
    const first = await auth.signInWithGoogle(profile, "vitest");
    const second = await auth.signInWithGoogle({ ...profile, name: "Renamed" }, "vitest");
    expect(second.id).toBe(first.id);
  });

  it("links an existing password account with the same email", async () => {
    const existing = await member("googlelink");
    const user = await auth.signInWithGoogle(
      { sub: "google-sub-2", email: existing.email, name: existing.name },
      "vitest",
    );
    expect(user.id).toBe(existing.id);
    expect(user.emailVerified).toBe(true);
  });

  it("refuses a suspended account", async () => {
    const existing = await member("googlesuspended");
    await auth.adminUpdateUser("admin", existing.id, { suspended: true, suspendedReason: "Test" });
    await expect(
      auth.signInWithGoogle(
        { sub: "google-sub-3", email: existing.email, name: "x" },
        "vitest",
      ),
    ).rejects.toThrow(/suspended/i);
  });
});

describe("role guards on the studio APIs", () => {
  it("refuses the mixing room to an artist but allows their vocal studio", async () => {
    const artist = await member("guardartist", ["artist"]);
    auth.__setSessionOverrideForTests(async () => artist);

    const mixer = await auth.guardStudio("mix");
    expect(mixer.response?.status).toBe(403);
    const body = await mixer.response!.json();
    expect(body.code).toBe("role_required");

    const vocal = await auth.guardStudio("vocal");
    expect(vocal.user?.id).toBe(artist.id);
    expect(vocal.response).toBeUndefined();
  });

  it("lets a producer into mixing and mastering", async () => {
    const producer = await member("guardproducer", ["producer"]);
    auth.__setSessionOverrideForTests(async () => producer);
    for (const studio of ["vocal", "mix", "mastering"] as const) {
      expect((await auth.guardStudio(studio)).user?.id).toBe(producer.id);
    }
  });

  it("gives a promoter no processing tools at all", async () => {
    const promoter = await member("guardpromoter", ["promoter"]);
    auth.__setSessionOverrideForTests(async () => promoter);
    expect((await auth.guardStudio("vocal")).response?.status).toBe(403);
    expect((await auth.guardAnyStudio()).response?.status).toBe(403);
  });

  it("lets the admin into every studio without a role", async () => {
    const admin = await auth.signInWithGoogle(
      { sub: "admin-sub-guards", email: ADMIN, name: "Studio admin" },
      "vitest",
    );
    auth.__setSessionOverrideForTests(async () => admin);
    expect((await auth.guardStudio("mastering")).user?.id).toBe(admin.id);
    expect((await auth.guardAnyStudio()).user?.id).toBe(admin.id);
    expect((await auth.adminGuard()).user?.id).toBe(admin.id);
  });

  it("answers 401 when nobody is signed in", async () => {
    auth.__setSessionOverrideForTests(async () => null);
    expect((await auth.guardStudio("vocal")).response?.status).toBe(401);
    expect((await auth.guardAnyStudio()).response?.status).toBe(401);
  });

  it("refuses a non-admin at the admin guard", async () => {
    const ordinary = await member("guardordinary", ["producer"]);
    auth.__setSessionOverrideForTests(async () => ordinary);
    expect((await auth.adminGuard()).response?.status).toBe(403);
  });
});

describe("email verification", () => {
  it("marks the address verified from a valid token, once", async () => {
    const user = await member("verify");
    const { token } = await auth.issueVerificationToken(user.id);
    const verified = await auth.confirmEmail(token);
    expect(verified.id).toBe(user.id);
    expect(verified.emailVerified).toBe(true);

    // The token is consumed by the confirmation.
    await expect(auth.confirmEmail(token)).rejects.toThrow();
  });

  it("refuses a token that does not exist or has expired", async () => {
    await expect(auth.confirmEmail("not-a-real-token")).rejects.toThrow(/verification/i);

    const user = await member("expired");
    const { token } = await auth.issueVerificationToken(user.id);
    // Age the stored expiry without touching the token.
    await db.mutateDb((state) => {
      const row = state.users.find((entry) => entry.id === user.id)!;
      row.verifyExpiresAt = new Date(Date.now() - 1000).toISOString();
    });
    await expect(auth.confirmEmail(token)).rejects.toThrow(/expired/i);
  });

  it("stores only the hash of the token", async () => {
    const user = await member("hashcheck");
    const { token } = await auth.issueVerificationToken(user.id);
    const state = await db.readDb();
    const row = state.users.find((entry) => entry.id === user.id)!;
    expect(row.verifyTokenHash).toBe(auth.sha256(token));
    expect(JSON.stringify(state)).not.toContain(`"${token}"`);
  });
});
