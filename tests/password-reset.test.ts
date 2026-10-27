import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Forgotten-password recovery.
 *
 * The rules that matter, all checked against a real temporary database:
 *  - the link is single use, expires in an hour, and only ever stored as a hash;
 *  - a reset sets the new password, signs every device out, and burns the token;
 *  - asking for a link never reveals whether an address has an account;
 *  - with no mail provider the API says "no email was sent" instead of pretending.
 */

let tmpDir: string;
let auth: typeof import("@/lib/server/auth");
let db: typeof import("@/lib/server/db");

const OLD = "old password 123";
const NEW = "brand new password 456";

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-reset-"));
  process.env.DATA_DIR = tmpDir;
  delete process.env.ADMIN_EMAIL;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  vi.resetModules();
  auth = await import("@/lib/server/auth");
  db = await import("@/lib/server/db");
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  auth.__setSessionOverrideForTests(null);
});

async function member(suffix: string, password = OLD) {
  return auth.signup(
    { name: `Reset ${suffix}`, email: `${suffix}@studio.test`, password, roles: ["artist"] },
    "vitest",
  );
}

describe("password reset tokens", () => {
  it("issues a link for a real account and stores only its hash", async () => {
    const user = await member("issue");
    const result = await auth.issuePasswordReset(user.email);
    expect(result.issued).toBe(true);
    if (!result.issued) return;

    const stored = (await db.readDb()).users.find((entry) => entry.id === user.id)!;
    expect(stored.resetTokenHash).toBe(auth.sha256(result.token));
    expect(stored.resetExpiresAt).toBe(result.expiresAt);
    // The raw token is never written down.
    expect(JSON.stringify(stored)).not.toContain(result.token);
  });

  it("says nothing useful about an address that has no account", async () => {
    const result = await auth.issuePasswordReset("nobody@studio.test");
    expect(result).toEqual({ issued: false, reason: "unknown" });
  });

  it("refuses a Google-only account, which has no password to reset", async () => {
    await (db.mutateDb as typeof db.mutateDb)((state) => {
      state.users.push({
        ...state.users[0],
        id: "usr_googleonly",
        email: "googleonly@studio.test",
        passwordHash: "",
        handle: null,
        provider: "google",
      });
    });
    const result = await auth.issuePasswordReset("googleonly@studio.test");
    expect(result).toEqual({ issued: false, reason: "no-password" });
  });

  it("refuses a suspended account", async () => {
    const user = await member("suspended");
    await db.mutateDb((state) => {
      const record = state.users.find((entry) => entry.id === user.id)!;
      record.suspendedAt = new Date().toISOString();
      record.suspendedReason = "test";
    });
    expect(await auth.issuePasswordReset(user.email)).toEqual({ issued: false, reason: "suspended" });
  });
});

describe("choosing a new password", () => {
  it("stores the new password, burns the token and signs every device out", async () => {
    const user = await member("happy");
    // A live session that must not survive the reset.
    await auth.startSession(user.id, "vitest");
    expect((await db.readDb()).sessions.some((session) => session.userId === user.id)).toBe(true);

    const issued = await auth.issuePasswordReset(user.email);
    expect(issued.issued).toBe(true);
    if (!issued.issued) return;

    await auth.resetPasswordWithToken(issued.token, NEW);

    // Every session for that account is gone (checked before signing in again,
    // because a successful login legitimately creates a new one).
    expect((await db.readDb()).sessions.some((session) => session.userId === user.id)).toBe(false);

    const stored = (await db.readDb()).users.find((entry) => entry.id === user.id)!;
    expect(stored.resetTokenHash).toBeNull();
    expect(stored.resetExpiresAt).toBeNull();

    // New password works, old one does not.
    await expect(auth.login({ email: user.email, password: NEW })).resolves.toMatchObject({
      email: user.email,
    });
    await expect(auth.login({ email: user.email, password: OLD })).rejects.toThrow(
      /email or password/i,
    );
  });

  it("refuses the same link twice", async () => {
    const user = await member("once");
    const issued = await auth.issuePasswordReset(user.email);
    if (!issued.issued) throw new Error("token expected");

    await auth.resetPasswordWithToken(issued.token, NEW);
    await expect(auth.resetPasswordWithToken(issued.token, "another password 789")).rejects.toThrow(
      /not valid/i,
    );
  });

  it("refuses an expired link", async () => {
    const user = await member("expired");
    const issued = await auth.issuePasswordReset(user.email);
    if (!issued.issued) throw new Error("token expected");

    await db.mutateDb((state) => {
      const record = state.users.find((entry) => entry.id === user.id)!;
      record.resetExpiresAt = new Date(Date.now() - 1000).toISOString();
    });
    await expect(auth.resetPasswordWithToken(issued.token, NEW)).rejects.toThrow(/expired/i);
  });

  it("refuses a short password and a made-up token", async () => {
    const user = await member("short");
    const issued = await auth.issuePasswordReset(user.email);
    if (!issued.issued) throw new Error("token expected");

    await expect(auth.resetPasswordWithToken(issued.token, "short")).rejects.toThrow(
      /at least 8/i,
    );
    await expect(auth.resetPasswordWithToken("not-a-real-token", NEW)).rejects.toThrow(/not valid/i);
  });

  it("clears the setup-password flag, so the admin's seeded password is retired", async () => {
    const user = await member("seeded");
    await db.mutateDb((state) => {
      const record = state.users.find((entry) => entry.id === user.id)!;
      record.passwordSeeded = true;
    });
    const issued = await auth.issuePasswordReset(user.email);
    if (!issued.issued) throw new Error("token expected");
    const updated = await auth.resetPasswordWithToken(issued.token, NEW);
    expect(updated.passwordSeeded).toBe(false);
  });
});

describe("POST /api/auth/password/forgot", () => {
  it("says plainly that no email was sent when no provider is configured", async () => {
    const { POST } = await import("@/app/api/auth/password/forgot/route");
    const body = (email: string) =>
      POST(
        new Request("http://localhost/api/auth/password/forgot", {
          method: "POST",
          body: JSON.stringify({ email }),
        }),
      ).then((response) => response.json());

    const known = await body((await member("asked")).email);
    expect(known.emailConfigured).toBe(false);
    expect(known.sent).toBe(false);
    expect(known.reason).toMatch(/no email provider/i);

    // The same shape for an address that does not exist: no account leak.
    const unknown = await body("stranger@studio.test");
    expect(unknown).toEqual(known);
  });
});

describe("POST /api/auth/password/reset", () => {
  it("answers 400 with a readable reason for a bad token", async () => {
    const { POST } = await import("@/app/api/auth/password/reset/route");
    const response = await POST(
      new Request("http://localhost/api/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token: "nope", password: NEW }),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/not valid/i);
  });
});
