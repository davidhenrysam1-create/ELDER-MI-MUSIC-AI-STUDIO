/**
 * Accounts and sessions.
 *
 * Design rules, because this is a studio people keep their music in:
 *
 *  - Passwords are never stored, logged or returned. Only a salted scrypt hash
 *    (`scrypt$N$r$p$salt$hash`) is kept in the database.
 *  - The session cookie holds a random 256-bit token. The database stores only
 *    its SHA-256, so a copy of `db.json` cannot be replayed as a login.
 *  - The cookie is `HttpOnly` (no JavaScript access) and `SameSite=Lax` on a
 *    plain first-party page. When the studio is served over HTTPS — including
 *    inside an embedded preview iframe — it becomes `SameSite=None; Secure;
 *    Partitioned` so the browser actually keeps it. See `lib/server/cookies.ts`
 *    for why, and `middleware.ts` for the matching Origin check that replaces
 *    the CSRF protection `Lax` used to give us.
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
import { persistentCookieOptions } from "@/lib/server/cookies";
import { ACCOUNT_ROLES, canUseStudio, studiosForRoles } from "@/lib/roles";
import type {
  AccountRole,
  AuthProvider,
  ProfileLinks,
  SessionRecord,
  StudioId,
  User,
} from "@/lib/types";

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

/** Test seam: forget the in-memory bootstrap code so a test can start clean. */
export function __resetBootstrapForTests(): void {
  bootstrapRecord = null;
}

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

/**
 * Public shape of an account — never includes the password hash or the email
 * verification token.
 */
export type PublicUser = Omit<User, "passwordHash" | "verifyTokenHash">;

/**
 * The studio admin's email address, if the operator set one.
 *
 * This is the only source of admin rights. It is **not** a stored flag that a
 * request could set, so nobody can promote themselves by patching their profile.
 */
export function adminEmail(): string | null {
  const raw = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return raw ? raw : null;
}

/** True when this address is the configured admin. */
export function isAdminEmail(email: string): boolean {
  const admin = adminEmail();
  return Boolean(admin && email.trim().toLowerCase() === admin);
}

/** Linked platforms default to empty strings rather than undefined. */
function emptyLinks(): ProfileLinks {
  return { audiomack: "", instagram: "", facebook: "" };
}

/**
 * Fill in fields added after the first release.
 *
 * Older records in `.data/db.json` have no `roles`, `provider` or `links`; this
 * keeps every read total without a destructive migration.
 */
export function normalizeUser(user: User): User {
  return {
    ...user,
    role: user.role ?? "member",
    roles: (user.roles ?? []).filter((role): role is AccountRole =>
      (ACCOUNT_ROLES as string[]).includes(role),
    ),
    handle: user.handle ?? null,
    bio: user.bio ?? "",
    links: { ...emptyLinks(), ...user.links },
    isAdmin: isAdminEmail(user.email),
    emailVerified: user.emailVerified === true,
    verifyTokenHash: user.verifyTokenHash ?? null,
    verifyExpiresAt: user.verifyExpiresAt ?? null,
    provider: user.provider ?? "password",
    googleSub: user.googleSub ?? null,
    suspendedAt: user.suspendedAt ?? null,
    suspendedReason: user.suspendedReason ?? null,
  };
}

function toPublic(raw: User): PublicUser {
  const user = normalizeUser(raw);
  const { passwordHash: _passwordHash, verifyTokenHash: _verifyTokenHash, ...rest } = user;
  // The stored flag is never trusted on its own: it is recomputed from ADMIN_EMAIL.
  // In an open studio the acting account is the owner, so the console is theirs.
  const isOpenOwner = openStudioMode() && user.email === openStudioOwnerEmail();
  return { ...rest, isAdmin: isAdminEmail(user.email) || isOpenOwner };
}

/** Throw when an admin suspended the account. */
function assertActive(user: User) {
  if (user.suspendedAt) {
    throw new AuthError(
      user.suspendedReason
        ? `This account is suspended: ${user.suspendedReason}`
        : "This account is suspended. Contact the studio admin.",
      403,
    );
  }
}

/** Validate a `@handle`: 3–20 characters, letters, numbers and underscore. */
export function validateHandle(raw: string): string {
  const handle = raw.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    throw new AuthError(
      "A handle needs 3–20 characters: letters, numbers or underscore (no spaces).",
    );
  }
  return handle;
}

/** Keep only valid roles, de-duplicated and in canonical order. */
export function cleanRoles(input: unknown): AccountRole[] {
  const list = Array.isArray(input) ? input : [input];
  const valid = list.filter(
    (role): role is AccountRole => typeof role === "string" && (ACCOUNT_ROLES as string[]).includes(role),
  );
  return ACCOUNT_ROLES.filter((role) => valid.includes(role));
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
    roles?: AccountRole[];
    handle?: string;
    provider?: AuthProvider;
  },
  userAgent?: string | null,
): Promise<PublicUser> {
  const { name, email, password } = validateSignup(input);
  // The admin address is reserved: it signs in with Google or a bootstrap code,
  // so a stranger cannot claim it by knowing the address.
  if (isAdminEmail(email)) {
    throw new AuthError(
      "That address is reserved for the studio admin. Use “Continue with Google”, or the admin bootstrap code shown in the server log.",
      403,
    );
  }
  const roles = cleanRoles(input.roles ?? []);
  const handle = input.handle ? validateHandle(input.handle) : null;
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

  if (handle) {
    const taken = (await readDb()).users.some((user) => user.handle === handle);
    if (taken) throw new AuthError("That handle is already taken. Try another.", 409);
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
      roles,
      handle,
      bio: "",
      links: emptyLinks(),
      isAdmin: false,
      // No mail provider is configured in this build, so nothing claims to have
      // sent a verification email; the account starts unverified and says so.
      emailVerified: false,
      provider: input.provider ?? "password",
      googleSub: null,
      suspendedAt: null,
      suspendedReason: null,
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
  const wantsAdmin = isAdminEmail(email);

  // An admin account created by the bootstrap code (or by Google) starts with no
  // password. If the operator set ADMIN_PASSWORD, adopt it now — once — so the
  // admin can sign in with email + password from then on.
  if (wantsAdmin) await seedAdminPassword();

  const db = await readDb();
  const user = db.users.find((entry) => entry.email === email);
  // Hash even when the email is unknown, so timing does not reveal accounts.
  const known = user ? await verifyPassword(password, user.passwordHash) : await hashPassword(password).then(() => false);
  if (!user || !known) {
    // For the admin address only, say what to do instead of a bare failure: this
    // is the one account whose owner cannot reset a password by email.
    if (wantsAdmin && !user) {
      throw new AuthError(
        "The admin account has not been created yet. Open /admin-bootstrap and enter the one-time code from the server log.",
        401,
      );
    }
    throw new AuthError("Email or password is incorrect.", 401);
  }
  assertActive(user);
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

/** Update the signed-in account: display name, handle, bio and profile links. */
export async function updateProfile(
  userId: string,
  patch: {
    name?: string;
    handle?: string | null;
    bio?: string;
    links?: Partial<ProfileLinks>;
    roles?: AccountRole[];
  },
): Promise<PublicUser> {
  const db = await readDb();
  const existing = db.users.find((entry) => entry.id === userId);
  if (!existing) throw new AuthError("Account not found.", 404);

  const name = (patch.name ?? existing.name).trim().slice(0, 60);
  if (name.length < 2) throw new AuthError("Enter the name friends will see (at least 2 characters).");

  let handle = existing.handle ?? null;
  if (patch.handle !== undefined) {
    handle = patch.handle === null || patch.handle === "" ? null : validateHandle(patch.handle);
    if (handle) {
      const taken = db.users.some((user) => user.id !== userId && user.handle === handle);
      if (taken) throw new AuthError("That handle is already taken. Try another.", 409);
    }
  }

  const bio = (patch.bio ?? existing.bio ?? "").slice(0, 400);
  const links: ProfileLinks = {
    ...emptyLinks(),
    ...existing.links,
    ...(patch.links ?? {}),
  };
  for (const key of ["audiomack", "instagram", "facebook"] as const) {
    links[key] = (links[key] ?? "").trim().slice(0, 200);
    if (links[key] && !/^https?:\/\//i.test(links[key]) && links[key] !== "") {
      throw new AuthError("Links must start with https:// (or leave them empty).");
    }
  }

  const roles = patch.roles ? cleanRoles(patch.roles) : undefined;

  const updated = await mutateDb((state) => {
    const user = state.users.find((entry) => entry.id === userId);
    if (!user) throw new AuthError("Account not found.", 404);
    user.name = name;
    user.handle = handle;
    user.bio = bio;
    user.links = links;
    if (roles) user.roles = roles;
    return user;
  });
  return toPublic(updated);
}

/** Set the roles chosen on the welcome screen. At least one role is required. */
export async function setRoles(userId: string, roles: AccountRole[]): Promise<PublicUser> {
  const clean = cleanRoles(roles);
  if (clean.length === 0) throw new AuthError("Choose at least one role.");
  const updated = await mutateDb((state) => {
    const user = state.users.find((entry) => entry.id === userId);
    if (!user) throw new AuthError("Account not found.", 404);
    user.roles = clean;
    return user;
  });
  return toPublic(updated);
}

/**
 * The public face of an account: what a stranger may see on `/u/<handle>`.
 *
 * Deliberately excludes the email address, sessions, provider, verification
 * state and suspension reason — a public page must not leak account facts.
 * Suspended accounts resolve to `null`, so the page simply reads as missing.
 */
export interface PublicProfile {
  id: string;
  name: string;
  handle: string;
  bio: string;
  roles: AccountRole[];
  links: ProfileLinks;
  isAdmin: boolean;
  joinedAt: string;
}

/** Look up a public profile by handle (case-insensitive, no leading @). */
export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const wanted = handle.trim().replace(/^@/, "").toLowerCase();
  if (!wanted) return null;
  const db = await readDb();
  const user = db.users.map(normalizeUser).find((u) => (u.handle ?? "").toLowerCase() === wanted);
  if (!user || user.suspendedAt) return null;
  return {
    id: user.id,
    name: user.name,
    handle: user.handle ?? "",
    bio: user.bio ?? "",
    roles: user.roles ?? [],
    links: {
      audiomack: user.links?.audiomack ?? "",
      instagram: user.links?.instagram ?? "",
      facebook: user.links?.facebook ?? "",
    },
    isAdmin: isAdminEmail(user.email),
    joinedAt: user.createdAt,
  };
}

export async function getUser(userId: string): Promise<PublicUser | null> {
  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  return user ? toPublic(user) : null;
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
    // The setup password from .env.local is no longer in use.
    record.passwordSeeded = false;
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
    ...(await persistentCookieOptions(expires)),
  });
  return token;
}

/**
 * Remove the session cookie.
 *
 * `store.delete()` would emit `Set-Cookie: eldermi_session=;` without the
 * SameSite/Secure/Partitioned attributes the cookie was created with, and a
 * browser will not match those to the stored cookie — so the "signed out"
 * browser can keep sending the old token. Setting an expired value with the
 * *same* attributes is the reliable way to clear it.
 */
async function clearSessionCookie(): Promise<void> {
  const store = await cookieStore();
  store?.set(SESSION_COOKIE, "", {
    ...(await persistentCookieOptions(new Date(0))),
    httpOnly: true,
    maxAge: 0,
  });
}

/* ------------------------------------------------------------------ */
/* Open studio mode                                                    */
/* ------------------------------------------------------------------ */

/**
 * True when the studio opens straight into its tools.
 *
 * The owner asked for a studio where nothing sits behind a sign-in screen: open
 * the address and every studio, project, share link and the admin console are
 * simply there. That is the default for this build (`STUDIO_ACCOUNTS` unset).
 *
 * Set `STUDIO_ACCOUNTS=on` to bring back the login screen, separate personal
 * libraries and sign-up. No account, password, session or project is deleted in
 * either direction — the whole accounts system stays in the codebase and keeps
 * working the moment that variable is set.
 */
export function openStudioMode(): boolean {
  return (process.env.STUDIO_ACCOUNTS ?? "").trim().toLowerCase() !== "on";
}

/** Address of the account an open studio acts as (the admin when configured). */
function openStudioOwnerEmail(): string {
  return adminEmail() ?? "studio@elder-mi.local";
}

/**
 * The single account an open studio acts as.
 *
 * Created once, with every role and a public handle, so publishing, likes,
 * follows, downloads, share links and the admin console all have a real owner
 * to attribute work to — nothing is faked as "anonymous". Projects saved before
 * accounts existed are claimed at the same moment.
 */
export async function openStudioOwner(): Promise<PublicUser> {
  const email = openStudioOwnerEmail();
  const existing = (await readDb()).users.find((user) => user.email === email);
  if (existing) return toPublic(existing);

  const created = await mutateDb((state) => {
    const already = state.users.find((user) => user.email === email);
    if (already) return already;

    // A handle is required to publish; "studio" is the natural first choice.
    let handle = "studio";
    for (let suffix = 2; state.users.some((user) => user.handle === handle); suffix += 1) {
      handle = `studio${suffix}`;
    }

    const user: User = {
      id: `usr_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      email,
      name: "Studio owner",
      passwordHash: "",
      role: "owner",
      // Every role at once, so each dashboard and every studio is usable.
      roles: [...ACCOUNT_ROLES],
      handle,
      bio: "",
      links: emptyLinks(),
      isAdmin: true,
      emailVerified: true,
      provider: "password",
      googleSub: null,
      suspendedAt: null,
      suspendedReason: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    state.users.push(user);
    claimOrphans(state, user.id);
    return user;
  });

  return toPublic(created);
}

/** Read the signed-in account, or null. Never throws for a missing cookie. */
export async function currentUser(): Promise<PublicUser | null> {
  if (sessionOverride) return sessionOverride();
  // Open studio: there is nobody to sign in as — every request acts as the
  // studio owner, so no screen ever asks for a password.
  if (openStudioMode()) return openStudioOwner();

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

/** Signed-in account that is also the studio admin, or a 403. */
export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (!user.isAdmin) {
    throw new AuthError("Only the studio admin can open that.", 403);
  }
  return user;
}

/**
 * Route guard for a studio's tools: the account's roles must include that studio.
 *
 * The navigation hides what a role cannot use, but hiding is not enforcement —
 * a direct `fetch` or a typed URL reaches the handler, so every studio endpoint
 * calls this. Admins pass.
 */
export async function guardStudio(
  studio: StudioId,
): Promise<{ user: PublicUser; response?: undefined } | { user?: undefined; response: Response }> {
  let user: PublicUser;
  try {
    user = await requireUser();
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return {
      response: Response.json(
        { error: err instanceof Error ? err.message : "Sign in to continue." },
        { status },
      ),
    };
  }
  if (!canUseStudio(user.roles, studio, user.isAdmin)) {
    return {
      response: Response.json(
        {
          error: `Your dashboard does not include this studio. Change your roles in My account, or ask the studio admin.`,
          code: "role_required",
          studio,
        },
        { status: 403 },
      ),
    };
  }
  return { user };
}

/** Guard for tools that belong to any studio (a promoter gets none of them). */
export async function guardAnyStudio(): Promise<
  { user: PublicUser; response?: undefined } | { user?: undefined; response: Response }
> {
  try {
    const user = await requireUser();
    if (user.isAdmin) return { user };
    const any = studiosForRoles(user.roles).length > 0;
    if (!any) {
      return {
        response: Response.json(
          {
            error:
              "Your dashboard is the promoter dashboard: it has no processing tools. Change your roles in My account if that is wrong.",
            code: "role_required",
          },
          { status: 403 },
        ),
      };
    }
    return { user };
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

/** Route-handler admin guard, matching `guard()`'s response shape. */
export async function adminGuard(): Promise<
  { user: PublicUser; response?: undefined } | { user?: undefined; response: Response }
> {
  try {
    return { user: await requireAdmin() };
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 403;
    return {
      response: Response.json(
        { error: err instanceof Error ? err.message : "Only the studio admin can open that." },
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
  await clearSessionCookie();
}

/** Sign out everywhere (all devices) for one account. */
export async function endAllSessions(userId: string): Promise<void> {
  await mutateDb((state) => {
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
  });
  await clearSessionCookie();
}

/* ------------------------------------------------------------------ */
/* Admin                                                              */
/* ------------------------------------------------------------------ */

/**
 * Admin actions on another account.
 *
 * Admin rights are decided by `ADMIN_EMAIL` alone, so this cannot be used to
 * create a second admin — only to change roles, verification and suspension.
 */
export async function adminUpdateUser(
  actorId: string,
  userId: string,
  patch: {
    roles?: AccountRole[];
    suspended?: boolean;
    suspendedReason?: string;
    emailVerified?: boolean;
    name?: string;
  },
): Promise<PublicUser> {
  if (actorId === userId && patch.suspended) {
    throw new AuthError("You cannot suspend your own admin account.");
  }
  const updated = await mutateDb((state) => {
    const user = state.users.find((entry) => entry.id === userId);
    if (!user) throw new AuthError("Account not found.", 404);
    if (isAdminEmail(user.email) && patch.suspended) {
      throw new AuthError("The studio admin account cannot be suspended.", 400);
    }
    if (patch.roles) {
      const roles = cleanRoles(patch.roles);
      user.roles = roles;
    }
    if (patch.name !== undefined) user.name = patch.name.trim().slice(0, 60) || user.name;
    if (patch.emailVerified !== undefined) user.emailVerified = patch.emailVerified;
    if (patch.suspended !== undefined) {
      user.suspendedAt = patch.suspended ? new Date().toISOString() : null;
      user.suspendedReason = patch.suspended
        ? (patch.suspendedReason ?? "").slice(0, 200) || "Suspended by the studio admin"
        : null;
      // A suspended account loses every session immediately.
      if (patch.suspended) {
        state.sessions = state.sessions.filter((session) => session.userId !== userId);
      }
    }
    return user;
  });
  return toPublic(updated);
}

/* ------------------------------------------------------------------ */
/* Google sign-in                                                     */
/* ------------------------------------------------------------------ */

/**
 * Optional setup password for the admin account (`ADMIN_PASSWORD`).
 *
 * Why it exists: the admin normally signs in with Google, and while Google is
 * unconfigured it uses a one-time bootstrap code. Both can leave the owner
 * locked out (Google off, code already used, or the code lost with a server
 * restart). Setting `ADMIN_PASSWORD` gives the admin a normal email + password
 * sign-in that survives restarts.
 *
 * The value lives in `.env.local` (git-ignored) — never in the repository — and
 * is only used to *seed* the password once. After that the stored scrypt hash is
 * authoritative, so changing the password in My account really changes it.
 *
 * It is deliberately ignored if shorter than the normal minimum length.
 */
export function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  if (!value || value.length < PASSWORD_MIN) return null;
  return value;
}

/** True when an admin setup password is available for seeding. */
export function adminPasswordConfigured(): boolean {
  return adminPassword() !== null;
}

/**
 * Give the admin account the setup password if it has none yet.
 *
 * Runs on every admin sign-in attempt, so an account created by the bootstrap
 * code or by Google gains a password the next time the admin tries to sign in.
 * An existing hash is never replaced — that would undo a password change.
 */
async function seedAdminPassword(): Promise<void> {
  const secret = adminPassword();
  const email = adminEmail();
  if (!secret || !email) return;
  const db = await readDb();
  const user = db.users.find((entry) => entry.email === email);
  if (!user || user.passwordHash) return;
  const passwordHash = await hashPassword(secret);
  await mutateDb((state) => {
    const record = state.users.find((entry) => entry.id === user.id);
    if (!record || record.passwordHash) return;
    record.passwordHash = passwordHash;
    record.passwordSeeded = true;
  });
}

/** True when Google OAuth has both credentials configured. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/**
 * Sign in (or sign up) with a verified Google identity.
 *
 * Rules:
 *  - an existing account with the same email is linked to Google instead of
 *    creating a duplicate;
 *  - the reserved admin address may only arrive this way or by bootstrap code;
 *  - suspended accounts are refused before a session is created;
 *  - a brand-new account starts with no roles and is sent to `/welcome`.
 */
export async function signInWithGoogle(
  profile: { sub: string; email: string; name?: string },
  userAgent?: string | null,
): Promise<PublicUser> {
  const email = normalizeEmail(profile.email);
  if (!EMAIL_RE.test(email)) throw new AuthError("Google did not return a usable email address.", 400);

  const db = await readDb();
  const existing =
    db.users.find((user) => user.googleSub === profile.sub) ??
    db.users.find((user) => user.email === email);

  if (existing) {
    assertActive(existing);
    const updated = await mutateDb((state) => {
      const user = state.users.find((entry) => entry.id === existing.id)!;
      user.googleSub = profile.sub;
      user.provider = "google";
      user.lastLoginAt = new Date().toISOString();
      // Google has verified the address, so the account is verified too.
      user.emailVerified = true;
      return user;
    });
    await startSession(updated.id, userAgent);
    return toPublic(updated);
  }

  const created = await mutateDb((state) => {
    const user: User = {
      id: `usr_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      email,
      name: (profile.name ?? email.split("@")[0]).slice(0, 60),
      // No password is set: this account signs in with Google only.
      passwordHash: "",
      role: state.users.length === 0 ? "owner" : "member",
      roles: [],
      handle: null,
      bio: "",
      links: emptyLinks(),
      isAdmin: isAdminEmail(email),
      emailVerified: true,
      provider: "google",
      googleSub: profile.sub,
      suspendedAt: null,
      suspendedReason: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    state.users.push(user);
    if (state.users.length === 1) claimOrphans(state, user.id);
    return user;
  });
  await startSession(created.id, userAgent);
  return toPublic(created);
}

/* ------------------------------------------------------------------ */
/* Admin bootstrap (no Google configured yet)                          */
/* ------------------------------------------------------------------ */

interface BootstrapRecord {
  codeHash: string;
  expiresAt: string;
  usedAt: string | null;
}

/** In-memory bootstrap record; never written to the database or git. */
let bootstrapRecord: BootstrapRecord | null = null;

/**
 * The code the operator can type on `/admin-bootstrap`.
 *
 * `ADMIN_BOOTSTRAP_CODE` wins if set (so it survives a restart and can be read
 * from `.env.local`), otherwise a random code is generated once per process and
 * printed to the server log. It is single-use and expires after 24 hours.
 */
export function currentBootstrapCode(): string | null {
  if (googleConfigured()) return null;
  if (bootstrapRecord?.usedAt) return null;
  if (bootstrapRecord && new Date(bootstrapRecord.expiresAt) > new Date()) return null;

  const fromEnv = process.env.ADMIN_BOOTSTRAP_CODE?.trim();
  const code = fromEnv && fromEnv.length >= 8 ? fromEnv : randomBytes(9).toString("base64url");
  bootstrapRecord = {
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    usedAt: null,
  };
  return code;
}

/**
 * The admin state for the sign-in screen: is Google ready, is there an admin
 * account, and is a bootstrap code still available?
 */
export async function adminSignInState() {
  const db = await readDb();
  const email = adminEmail();
  const account = email ? db.users.find((user) => user.email === email) ?? null : null;
  const google = googleConfigured();
  let bootstrapAvailable = false;
  if (email && !google) {
    if (!bootstrapRecord || new Date(bootstrapRecord.expiresAt) <= new Date()) {
      const code = currentBootstrapCode();
      if (code) {
        // Printing is the only delivery channel when there is no mail service.
        console.info(
          `\n[Elder Mi] Admin bootstrap code for ${email}: ${code}\n` +
            "Open /admin-bootstrap and enter it once. Set ADMIN_BOOTSTRAP_CODE to control it yourself.\n",
        );
      }
    }
    bootstrapAvailable = Boolean(bootstrapRecord && !bootstrapRecord.usedAt);
  }
  return {
    // Masked on purpose: `/api/auth/me` is readable without signing in, and the
    // owner's address should not be published by the sign-in screen.
    adminEmailMasked: maskEmail(email),
    adminExists: Boolean(account),
    googleConfigured: google,
    bootstrapAvailable,
    // True when ADMIN_PASSWORD is set: the admin can use the email + password form.
    passwordConfigured: adminPasswordConfigured(),
  };
}

/** `david@example.com` → `d****@example.com`, for display only. */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(3, Math.min(local.length - 1, 6)))}@${domain}`;
}

/**
 * Redeem the bootstrap code and sign in as the admin.
 *
 * Creates the admin account if it does not exist yet, with every role so the
 * console is usable immediately. There is no password: once Google is
 * configured this route refuses, and the admin signs in with Google instead.
 */
export async function redeemBootstrapCode(
  code: string,
  userAgent?: string | null,
): Promise<PublicUser> {
  const email = adminEmail();
  if (!email) throw new AuthError("No ADMIN_EMAIL is configured on this server.", 400);
  if (googleConfigured()) {
    throw new AuthError("Google sign-in is configured — sign in with Google instead.", 400);
  }
  // A code pinned in `.env.local` must work even if no page has asked for one yet
  // (the record is otherwise created by `adminSignInState()` on the sign-in page).
  if (!bootstrapRecord) {
    const fromEnv = process.env.ADMIN_BOOTSTRAP_CODE?.trim();
    if (fromEnv && fromEnv.length >= 8) {
      bootstrapRecord = {
        codeHash: sha256(fromEnv),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        usedAt: null,
      };
    }
  }
  const current = bootstrapRecord;
  if (!current || current.usedAt) {
    throw new AuthError("No bootstrap code is active. Restart the server to generate one.", 403);
  }
  if (new Date(current.expiresAt) <= new Date()) {
    throw new AuthError("That bootstrap code expired. Restart the server to generate a new one.", 403);
  }
  if (sha256(code.trim()) !== current.codeHash) {
    throw new AuthError("That bootstrap code is not correct.", 401);
  }

  const db = await readDb();
  const existing = db.users.find((user) => user.email === email);
  // A setup password (if configured) is stored with the account, so the admin can
  // sign in again at /login without asking for another one-time code.
  const setupSecret = adminPassword();
  const setupHash = setupSecret ? await hashPassword(setupSecret) : "";

  const user = await mutateDb((state) => {
    if (existing) {
      const record = state.users.find((entry) => entry.id === existing.id)!;
      record.provider = "bootstrap";
      record.emailVerified = true;
      record.lastLoginAt = new Date().toISOString();
      record.roles = ACCOUNT_ROLES.slice();
      if (setupHash && !record.passwordHash) {
        record.passwordHash = setupHash;
        record.passwordSeeded = true;
      }
      return record;
    }
    const created: User = {
      id: `usr_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      email,
      name: "Studio admin",
      passwordHash: setupHash,
      role: state.users.length === 0 ? "owner" : "member",
      roles: ACCOUNT_ROLES.slice(),
      handle: "admin",
      bio: "",
      links: emptyLinks(),
      isAdmin: true,
      emailVerified: true,
      provider: "bootstrap",
      googleSub: null,
      passwordSeeded: Boolean(setupHash),
      suspendedAt: null,
      suspendedReason: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    state.users.push(created);
    if (state.users.length === 1) claimOrphans(state, created.id);
    return created;
  });

  bootstrapRecord = { ...current, usedAt: new Date().toISOString() };
  await startSession(user.id, userAgent);
  return toPublic(user);
}

/* ------------------------------------------------------------------ */
/* Email verification                                                 */
/* ------------------------------------------------------------------ */

/**
 * Issue a verification token and return it in the clear **to the server**.
 *
 * The caller (a route handler) passes it to the email adapter; the database only
 * keeps its SHA-256. That is why a lost link cannot be re-read later.
 */
export async function issueVerificationToken(
  userId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await mutateDb((state) => {
    const user = state.users.find((entry) => entry.id === userId);
    if (!user) throw new AuthError("Account not found.", 404);
    user.verifyTokenHash = sha256(token);
    user.verifyExpiresAt = expiresAt;
  });
  return { token, expiresAt };
}

/** Confirm an address with the token from the verification link. */
export async function confirmEmail(token: string): Promise<PublicUser> {
  const hash = sha256(token.trim());
  const db = await readDb();
  const user = db.users.find((entry) => entry.verifyTokenHash === hash);
  if (!user) throw new AuthError("That verification link is not valid.", 400);
  if (user.verifyExpiresAt && new Date(user.verifyExpiresAt) <= new Date()) {
    throw new AuthError("That verification link expired. Request a new one from your account page.", 400);
  }
  const updated = await mutateDb((state) => {
    const record = state.users.find((entry) => entry.id === user.id)!;
    record.emailVerified = true;
    record.verifyTokenHash = null;
    record.verifyExpiresAt = null;
    return record;
  });
  return toPublic(updated);
}
