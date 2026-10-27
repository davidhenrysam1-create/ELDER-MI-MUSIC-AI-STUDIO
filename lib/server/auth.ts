/**
 * Accounts and sessions.
 *
 * Design rules, because this is a studio people keep their music in:
 *
 *  - Passwords are never stored, logged or returned. Only a salted scrypt hash
 *    (`scrypt$N$r$p$salt$hash`) is kept in the database.
 *  - The session cookie holds a random 256-bit token. The database stores only
 *    its SHA-256, so a copy of `db.json` cannot be replayed as a login.
 *  - The cookie is `HttpOnly` (no JavaScript access), `SameSite=Lax` (no
 *    cross-site posting) and `Secure` on HTTPS deployments.
 *  - There is no email delivery in this build, so there is no "we sent you a
 *    link" theatre: recovery is done from the account page while signed in, or
 *    by the owner from the server.
 *
 * Everything here runs on the Node runtime (scrypt + node:crypto), not the edge
 * runtime, which is why `middleware.ts` only does a cheap cookie-presence check
 * and every real check happens in a route handler.
 */
import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { mutateDb, readDb } from "@/lib/server/db";
import type { SessionRecord, User } from "@/lib/types";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Test seam.
 *
 * Route-handler unit tests call handlers directly, outside a Next.js request
 * scope, so `cookies()` throws. This override lets a test state which account is
 * "signed in" without weakening production behaviour: it is only ever set by
 * test code, never by a request, an environment variable or a header.
 */
let sessionOverride: (() => Promise<PublicUser | null>) | null = null;

/** Set (or clear) the signed-in account used by tests. */
export function __setSessionOverrideForTests(fn: (() => Promise<PublicUser | null>) | null) {
  sessionOverride = fn;
}

/** `cookies()` throws outside a request scope; return null instead of crashing. */
async function cookieStore() {
  try {
    return await cookies();
  } catch {
    return null;
  }
}

/** Cookie that carries the session token. Not readable from JavaScript. */
export const SESSION_COOKIE = "eldermi_session";
/** How long a session stays valid before a fresh sign-in is required. */
export const SESSION_DAYS = 30;

/** scrypt parameters. N=2^14 keeps a login under ~100 ms on a phone. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

/** Password rules shown in the UI; enforced again on the server. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

/** Error with an HTTP status, mapped straight onto a JSON response. */
export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* Hashing                                                             */
/* ------------------------------------------------------------------ */

/** Hash a password. The salt is random per password. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, SCRYPT.keylen);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${key.toString("hex")}`;
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false (rather than throwing) for malformed hashes so a corrupt record
 * cannot crash the login route or leak detail about the stored value.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, , , , salt, expected] = parts;
  try {
    const actual = await scrypt(password, salt, expected.length / 2);
    const a = Buffer.from(actual);
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Hash a share-link token or passcode with SHA-256 (they are high-entropy or short-lived). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lower-case and trim an email so logins are case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateSignup(input: {
  name: string;
  email: string;
  password: string;
}): { name: string; email: string; password: string } {
  const name = input.name.trim().slice(0, 60);
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (name.length < 2) throw new AuthError("Enter the name friends will see (at least 2 characters).");
  if (!EMAIL_RE.test(email) || email.length > 200) throw new AuthError("Enter a valid email address.");
  if (password.length < PASSWORD_MIN) {
    throw new AuthError(`Use at least ${PASSWORD_MIN} characters for your password.`);
  }
  if (password.length > PASSWORD_MAX) throw new AuthError("That password is too long.");
  return { name, email, password };
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

/** Public shape of an account — never includes the password hash. */
export type PublicUser = Omit<User, "passwordHash">;

function toPublic(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/** True when any account exists (used by the UI to choose "sign in" vs "create"). */
export async function accountCount(): Promise<number> {
  const db = await readDb();
  return db.users.length;
}

/**
 * Sign up.
 *
 * The first account becomes `owner` and adopts projects, exports and voice
 * profiles saved before accounts existed, so upgrading an existing studio does
 * not strand its music.
 *
 * Sign-up can be closed with `ALLOW_SIGNUP=false`; the owner can still create
 * accounts from the server. That keeps an exposed deployment from accepting
 * strangers while still allowing a small team.
 */
export async function signup(
  input: {
    name: string;
    email: string;
    password: string;
  },
  userAgent?: string | null,
): Promise<PublicUser> {
  const { name, email, password } = validateSignup(input);
  const allowSignup = (process.env.ALLOW_SIGNUP ?? "true").toLowerCase() !== "false";

  const db = await readDb();
  if (db.users.some((user) => user.email === email)) {
    throw new AuthError("An account with that email already exists. Sign in instead.", 409);
  }
  if (!allowSignup && db.users.length > 0) {
    throw new AuthError(
      "Sign-up is closed on this studio. Ask the owner for an account.",
      403,
    );
  }

  const passwordHash = await hashPassword(password);
  const created = await mutateDb((state) => {
    const isFirst = state.users.length === 0;
    const user: User = {
      id: `usr_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      email,
      name,
      passwordHash,
      role: isFirst ? "owner" : "member",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    state.users.push(user);
    if (isFirst) claimOrphans(state, user.id);
    return user;
  });

  await startSession(created.id, userAgent);
  return toPublic(created);
}

/**
 * Adopt pre-accounts data for the first account.
 *
 * Runs inside the signup mutation so the claim is atomic with account creation.
 */
function claimOrphans(state: Awaited<ReturnType<typeof readDb>>, userId: string) {
  for (const project of state.projects) if (!project.ownerId) project.ownerId = userId;
  for (const record of state.exports) {
    if (!record.ownerId) {
      const owner = state.projects.find((project) => project.id === record.projectId)?.ownerId;
      record.ownerId = owner ?? userId;
    }
  }
  for (const profile of state.voiceProfiles) if (!profile.ownerId) profile.ownerId = userId;
  for (const share of state.shares) if (!share.ownerId) share.ownerId = userId;
}

/** Sign in. Deliberately vague about which half was wrong. */
export async function login(
  input: { email: string; password: string },
  userAgent?: string | null,
): Promise<PublicUser> {
  const email = normalizeEmail(input.email ?? "");
  const password = input.password ?? "";
  const db = await readDb();
  const user = db.users.find((entry) => entry.email === email);
  // Hash even when the email is unknown, so timing does not reveal accounts.
  const known = user ? await verifyPassword(password, user.passwordHash) : await hashPassword(password).then(() => false);
  if (!user || !known) {
    throw new AuthError("Email or password is incorrect.", 401);
  }
  const updated = await mutateDb((state) => {
    const record = state.users.find((entry) => entry.id === user.id)!;
    record.lastLoginAt = new Date().toISOString();
    return record;
  });
  await startSession(updated.id, userAgent);
  return toPublic(updated);
}

/** List accounts for the owner-facing team view (no hashes, no sessions). */
export async function listUsers(): Promise<PublicUser[]> {
  const db = await readDb();
  return db.users.map(toPublic).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Update the display name on the signed-in account. */
export async function updateProfile(userId: string, patch: { name: string }): Promise<PublicUser> {
  const name = patch.name.trim().slice(0, 60);
  if (name.length < 2) throw new AuthError("Enter the name friends will see (at least 2 characters).");
  const updated = await mutateDb((state) => {
    const user = state.users.find((entry) => entry.id === userId);
    if (!user) throw new AuthError("Account not found.", 404);
    user.name = name;
    return user;
  });
  return toPublic(updated);
}

/**
 * Change a password.
 *
 * Every other session is revoked, which is the behaviour people expect after a
 * password change on a shared laptop.
 */
export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) throw new AuthError("Account not found.", 404);
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AuthError("Your current password is incorrect.", 401);
  }
  if ((input.newPassword ?? "").length < PASSWORD_MIN) {
    throw new AuthError(`Use at least ${PASSWORD_MIN} characters for your new password.`);
  }
  const passwordHash = await hashPassword(input.newPassword);
  await mutateDb((state) => {
    const record = state.users.find((entry) => entry.id === userId)!;
    record.passwordHash = passwordHash;
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
  });
}

/**
 * Delete an account and everything it owns.
 *
 * Audio and export files are removed by the caller (see
 * `deleteAccountData` in `lib/server/repo.ts`) so storage cleanup and the
 * database change stay in one place.
 */
export async function deleteUser(userId: string): Promise<void> {
  await mutateDb((state) => {
    state.users = state.users.filter((user) => user.id !== userId);
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
    state.shares = state.shares.filter((share) => share.ownerId !== userId);
  });
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

/** Describe the device for the account page without storing an IP address. */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : /Firefox\//.test(userAgent)
            ? "Firefox"
            : "Browser";
  const platform = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? "iOS"
      : /Mac OS X/i.test(userAgent)
        ? "Mac"
        : /Windows/i.test(userAgent)
          ? "Windows"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "device";
  return `${browser} on ${platform}`;
}

/**
 * Create a session and set the cookie.
 *
 * Only valid inside a route handler or Server Action (Next.js restriction on
 * writing cookies), which is where sign-in and sign-up happen.
 */
export async function startSession(userId: string, userAgent?: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const record: SessionRecord = {
    id: sha256(token),
    userId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    device: deviceLabel(userAgent ?? null),
  };
  await mutateDb((state) => {
    // Drop this user's expired sessions while we are here.
    state.sessions = state.sessions.filter(
      (session) => session.userId !== userId || new Date(session.expiresAt) > now,
    );
    state.sessions.push(record);
    // Hard cap so a scripted login loop cannot grow the database forever.
    state.sessions = state.sessions.slice(-200);
  });

  const store = await cookieStore();
  store?.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return token;
}

/** Read the signed-in account, or null. Never throws for a missing cookie. */
export async function currentUser(): Promise<PublicUser | null> {
  if (sessionOverride) return sessionOverride();
  const store = await cookieStore();
  const token = store?.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await readDb();
  const session = db.sessions.find((entry) => entry.id === sha256(token));
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    // Expired: remove it so the store does not accumulate dead rows.
    await mutateDb((state) => {
      state.sessions = state.sessions.filter((entry) => entry.id !== session.id);
    });
    return null;
  }
  const user = db.users.find((entry) => entry.id === session.userId);
  return user ? toPublic(user) : null;
}

/** Read the signed-in account or throw a 401 `AuthError`. */
export async function requireUser(): Promise<PublicUser> {
  const user = await currentUser();
  if (!user) throw new AuthError("Sign in to continue.", 401);
  return user;
}

/**
 * Route-handler guard.
 *
 * Usage:
 *   const auth = await guard();
 *   if (auth.response) return auth.response;
 *   // auth.user is a PublicUser
 *
 * Keeping this in one place means every protected route answers `401` with the
 * same JSON shape instead of each handler inventing its own.
 */
export async function guard(): Promise<
  { user: PublicUser; response?: undefined } | { user?: undefined; response: Response }
> {
  try {
    return { user: await requireUser() };
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return {
      response: Response.json(
        { error: err instanceof Error ? err.message : "Sign in to continue." },
        { status },
      ),
    };
  }
}

/** Sessions for the account page, newest first. */
export async function listSessions(userId: string) {
  const db = await readDb();
  return db.sessions
    .filter((session) => session.userId === userId)
    .map((session) => ({
      id: session.id.slice(0, 12),
      device: session.device,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Sign out: delete the current session and clear the cookie. */
export async function endSession(): Promise<void> {
  const store = await cookieStore();
  const token = store?.get(SESSION_COOKIE)?.value;
  if (token) {
    const id = sha256(token);
    await mutateDb((state) => {
      state.sessions = state.sessions.filter((session) => session.id !== id);
    });
  }
  store?.delete(SESSION_COOKIE);
}

/** Sign out everywhere (all devices) for one account. */
export async function endAllSessions(userId: string): Promise<void> {
  await mutateDb((state) => {
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
  });
  const store = await cookieStore();
  store?.delete(SESSION_COOKIE);
}
