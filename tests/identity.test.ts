import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Roles, the owner account, Google sign-in and email verification — all against a
 * real temporary data directory, with no mocks of the auth module itself.
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
  delete process.env.ALLOW_SIGNUP;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  vi.resetModules();
  auth = await import("@/lib/server/auth");
  db = await import("@/lib/server/db");
});

afterAll(async () => {
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
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

  it("cannot be signed into with an arbitrary password", async () => {
    // No ADMIN_PASSWORD is set here, so there is nothing to create the account
    // from: signing in as the owner must fail and say what is missing.
    await expect(auth.login({ email: ADMIN, password: PASSWORD })).rejects.toThrow(
      /No owner account can be created yet/i,
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

describe("the owner account on a new deployment", () => {
  /*
   * The promise being pinned: ADMIN_EMAIL + ADMIN_PASSWORD are all the owner
   * needs. A fresh deployment has no accounts at all, and a free host can wipe
   * the database at any restart — in both cases the first successful sign-in
   * must create the account rather than asking for a code from a log.
   */
  const OWNER = "owner-password-123";

  /** Remove the owner account, so each test starts from an empty deployment. */
  async function wipeOwner() {
    const existing = (await auth.listUsers()).find((user) => user.email === ADMIN);
    if (existing) await auth.deleteUser(existing.id);
  }

  afterAll(async () => {
    delete process.env.ADMIN_PASSWORD;
    await wipeOwner();
  });

  it("refuses, and names the missing variable, when ADMIN_PASSWORD is unset", async () => {
    await wipeOwner();
    delete process.env.ADMIN_PASSWORD;
    await expect(auth.login({ email: ADMIN, password: OWNER })).rejects.toThrow(
      /No owner account can be created yet/i,
    );
  });

  it("refuses a password that is not ADMIN_PASSWORD", async () => {
    process.env.ADMIN_PASSWORD = OWNER;
    await expect(auth.login({ email: ADMIN, password: "definitely-not-it" })).rejects.toThrow(
      /does not match ADMIN_PASSWORD/i,
    );
    // ...and nothing was created by the failed attempt.
    const users = await auth.listUsers();
    expect(users.some((user) => user.email === ADMIN)).toBe(false);
  });

  it("creates the owner from the configured email and password, with every role", async () => {
    process.env.ADMIN_PASSWORD = OWNER;
    const user = await auth.login({ email: ADMIN, password: OWNER }, "vitest");
    expect(user.email).toBe(ADMIN);
    expect(user.isAdmin).toBe(true);
    expect(user.roles).toEqual(["artist", "producer", "engineer", "promoter"]);
    expect(user.emailVerified).toBe(true);
    // Created with a real password from the start — not a passwordless account.
    expect(user.provider).toBe("password");
    expect(user.passwordSeeded).toBe(true);
  });

  it("signs the same owner in again, and never creates a second account", async () => {
    process.env.ADMIN_PASSWORD = OWNER;
    const first = await auth.login({ email: ADMIN, password: OWNER }, "vitest");
    const second = await auth.login({ email: ADMIN, password: OWNER }, "vitest");
    expect(second.id).toBe(first.id);
    const admins = (await auth.listUsers()).filter((user) => user.email === ADMIN);
    expect(admins).toHaveLength(1);
  });

  it("creates nothing for another address that happens to use the same password", async () => {
    process.env.ADMIN_PASSWORD = OWNER;
    await expect(auth.login({ email: "stranger@studio.test", password: OWNER })).rejects.toThrow(
      /incorrect/i,
    );
    const users = await auth.listUsers();
    expect(users.some((user) => user.email === "stranger@studio.test")).toBe(false);
  });

  it("tells the sign-in screen what is set, without leaking the address or password", async () => {
    const state = await auth.adminSignInState();
    // The address is masked, because /api/auth/me is readable without signing in.
    expect(state.adminEmailMasked).not.toBe(ADMIN);
    expect(state.adminEmailMasked?.endsWith("@eldermi.test")).toBe(true);
    expect(state.adminEmailMasked?.startsWith("a")).toBe(true);
    expect(state.adminExists).toBe(true);
    expect(state.passwordConfigured).toBe(true);
    expect(state.googleConfigured).toBe(false);
    expect(JSON.stringify(state)).not.toContain(OWNER);
    expect(JSON.stringify(state)).not.toContain(ADMIN);
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

  /*
   * ALLOW_SIGNUP=false must close Google too. Otherwise the public link is a side
   * door: anyone with a Google account could create one. The owner's own address
   * stays allowed, or a fresh deployment could lock its owner out.
   */
  it("creates no new account when sign-up is closed", async () => {
    process.env.ALLOW_SIGNUP = "false";
    try {
      await expect(
        auth.signInWithGoogle({ sub: "closed-sub", email: "newcomer@studio.test", name: "New" }),
      ).rejects.toThrow(/New accounts are closed/i);
      const users = await auth.listUsers();
      expect(users.some((user) => user.email === "newcomer@studio.test")).toBe(false);
    } finally {
      delete process.env.ALLOW_SIGNUP;
    }
  });

  it("still lets an existing account sign in with Google while sign-up is closed", async () => {
    const existing = await member("existinggoogle");
    process.env.ALLOW_SIGNUP = "false";
    try {
      const user = await auth.signInWithGoogle(
        { sub: "existing-sub", email: existing.email, name: existing.name },
        "vitest",
      );
      expect(user.id).toBe(existing.id);
    } finally {
      delete process.env.ALLOW_SIGNUP;
    }
  });

  it("always lets the owner address in, so a closed studio cannot lock itself out", async () => {
    const owner = (await auth.listUsers()).find((entry) => entry.email === ADMIN);
    if (owner) await auth.deleteUser(owner.id);
    process.env.ALLOW_SIGNUP = "false";
    try {
      const created = await auth.signInWithGoogle({ sub: "owner-sub", email: ADMIN, name: "Owner" });
      expect(created.isAdmin).toBe(true);
    } finally {
      delete process.env.ALLOW_SIGNUP;
    }
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

describe("admin setup password (ADMIN_PASSWORD)", () => {
  const SETUP = "setup-password-123";

  it("ignores a setup password shorter than the minimum", async () => {
    process.env.ADMIN_PASSWORD = "short";
    try {
      expect(auth.adminPassword()).toBeNull();
      expect(auth.adminPasswordConfigured()).toBe(false);
    } finally {
      delete process.env.ADMIN_PASSWORD;
    }
  });

  it("lets the admin sign in with email + password and marks it as seeded", async () => {
    process.env.ADMIN_PASSWORD = SETUP;
    try {
      // A fresh deployment again: the first sign-in creates the owner account.
      const user = await auth.login({ email: ADMIN, password: SETUP }, "vitest");
      expect(user.isAdmin).toBe(true);
      expect(user.passwordSeeded).toBe(true);
      expect(user.email).toBe(ADMIN);
    } finally {
      delete process.env.ADMIN_PASSWORD;
    }
  });

  it("refuses a wrong admin password instead of guessing", async () => {
    await expect(
      auth.login({ email: ADMIN, password: "definitely-not-it" }, "vitest"),
    ).rejects.toThrow(/incorrect/i);
  });

  it("clears the seeded flag when the password is changed, and the old one stops working", async () => {
    const before = await auth.login({ email: ADMIN, password: SETUP }, "vitest");
    expect(before.passwordSeeded).toBe(true);

    await auth.changePassword(before.id, {
      currentPassword: SETUP,
      newPassword: "a-new-admin-password",
    });

    await expect(auth.login({ email: ADMIN, password: SETUP }, "vitest")).rejects.toThrow(/incorrect/i);
    const after = await auth.login({ email: ADMIN, password: "a-new-admin-password" }, "vitest");
    expect(after.passwordSeeded).toBe(false);
  });

  it("gives a Google-created admin the setup password on its next sign-in", async () => {
    // A clean slate: remove the owner, then let Google create it without a
    // password — exactly what happens when the owner first uses "Continue with
    // Google". ADMIN_PASSWORD must become their password afterwards, once.
    const owner = (await auth.listUsers()).find((entry) => entry.email === ADMIN);
    if (owner) await auth.deleteUser(owner.id);
    await auth.signInWithGoogle({ sub: "owner-google", email: ADMIN, name: "Studio admin" }, "vitest");

    process.env.ADMIN_PASSWORD = "seeded-after-google";
    try {
      const signedIn = await auth.login({ email: ADMIN, password: "seeded-after-google" }, "vitest");
      expect(signedIn.isAdmin).toBe(true);
      expect(signedIn.passwordSeeded).toBe(true);
    } finally {
      delete process.env.ADMIN_PASSWORD;
    }
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
