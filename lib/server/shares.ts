/**
 * Share links.
 *
 * A share exposes **one project, read-only**, to anyone holding the link — no
 * account needed. It never exposes the mixer, mastering chain, versions, jobs
 * or other projects.
 *
 * Security choices worth knowing:
 *  - The link token is random (192 bits) and is stored **only as a SHA-256
 *    hash**. That means the full link is shown once, when it is created. If it
 *    is lost, revoke it and make a new one — a stolen `db.json` cannot be turned
 *    into a working link.
 *  - Links can expire (`expiresAt`), be revoked (`revokedAt`, immediate) and be
 *    protected by an optional passcode (salted scrypt hash).
 *  - Downloads are off unless the owner enables them.
 *  - Play and download counters are recorded for the owner, and nothing else:
 *    no IP addresses, no user agents, no tracking pixels.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { mutateDb, readDb } from "@/lib/server/db";
import { AuthError, hashPassword, sha256, verifyPassword } from "@/lib/server/auth";
import type { AssetMeta, Project, ShareLink, SharedProjectView, Track } from "@/lib/types";

/** Longest supported expiry, in days. */
export const SHARE_MAX_DAYS = 90;
/** Passcodes are short by design (they are typed on a phone). */
export const PASSCODE_LENGTH = { min: 4, max: 12 } as const;

export interface CreateShareInput {
  projectId: string;
  label?: string;
  allowDownload?: boolean;
  /** Days until the link stops working; 0 or null means "no expiry". */
  expiresInDays?: number | null;
  passcode?: string | null;
}

export interface CreatedShare {
  share: PublicShare;
  /** Full token — returned exactly once, because only its hash is stored. */
  token: string;
  /** Path the owner can paste into a message. */
  path: string;
}

/** Share link without its secret material, safe for the owner's dashboard. */
export type PublicShare = Omit<ShareLink, "tokenHash" | "passcodeHash"> & {
  requiresPasscode: boolean;
  /** True when a passcode exists, without revealing it. */
  projectName: string;
  /** True when the link is past its expiry (server clock). */
  expired: boolean;
  active: boolean;
};

const nowIso = () => new Date().toISOString();

/** Cookie name for a share's passcode proof. Unique per link. */
function unlockCookie(shareId: string): string {
  return `eldermi_share_${shareId.slice(0, 12)}`;
}

/** The value stored in the unlock cookie: proof that the passcode was entered. */
function unlockValue(share: ShareLink): string {
  return sha256(`${share.id}:${share.passcodeHash ?? "open"}:${share.tokenHash}`);
}

/* ------------------------------------------------------------------ */
/* Owner-side operations                                               */
/* ------------------------------------------------------------------ */

/** Create a link for a project the caller owns. */
export async function createShare(
  ownerId: string,
  input: CreateShareInput,
): Promise<CreatedShare> {
  const label = (input.label ?? "").trim().slice(0, 60);
  const passcode = (input.passcode ?? "").trim();
  if (passcode && (passcode.length < PASSCODE_LENGTH.min || passcode.length > PASSCODE_LENGTH.max)) {
    throw new AuthError(
      `A passcode must be ${PASSCODE_LENGTH.min}–${PASSCODE_LENGTH.max} characters.`,
    );
  }

  const days = input.expiresInDays ?? null;
  if (days !== null && (!Number.isFinite(days) || days < 0 || days > SHARE_MAX_DAYS)) {
    throw new AuthError(`An expiry must be between 0 and ${SHARE_MAX_DAYS} days.`);
  }

  const passcodeHash = passcode ? await hashPassword(passcode) : null;
  const token = randomBytes(24).toString("base64url");
  const tokenHash = sha256(token);

  const share = await mutateDb((db) => {
    const project = db.projects.find((entry) => entry.id === input.projectId);
    if (!project) throw new AuthError("Project not found.", 404);
    if (project.ownerId !== ownerId) throw new AuthError("Project not found.", 404);

    const record: ShareLink = {
      id: `shr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      tokenHash,
      projectId: project.id,
      ownerId,
      label: label || `${project.name} — listening link`,
      allowDownload: input.allowDownload === true,
      passcodeHash,
      expiresAt:
        days && days > 0
          ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
          : null,
      createdAt: nowIso(),
      revokedAt: null,
      opens: 0,
      downloads: 0,
      lastOpenedAt: null,
    };
    db.shares.unshift(record);
    // Keep the list bounded; the owner can always make a new link.
    db.shares = db.shares.slice(0, 200);
    return record;
  });

  return {
    share: toPublic(share, await projectName(share.projectId)),
    token,
    path: `/s/${token}`,
  };
}

/** Links owned by the caller, newest first. */
export async function listShares(ownerId: string): Promise<PublicShare[]> {
  const db = await readDb();
  const names = new Map(db.projects.map((project) => [project.id, project.name]));
  return db.shares
    .filter((share) => share.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((share) => toPublic(share, names.get(share.projectId) ?? "Deleted project"));
}

/** Revoke a link immediately. Returns false when it does not belong to the caller. */
export async function revokeShare(ownerId: string, shareId: string): Promise<boolean> {
  return mutateDb((db) => {
    const share = db.shares.find((entry) => entry.id === shareId);
    if (!share || share.ownerId !== ownerId) return false;
    share.revokedAt = nowIso();
    return true;
  });
}

/** Links belonging to a project, so the studio can show their state. */
export async function sharesForProject(ownerId: string, projectId: string): Promise<PublicShare[]> {
  const all = await listShares(ownerId);
  return all.filter((share) => share.projectId === projectId);
}

function toPublic(share: ShareLink, projectNameValue: string): PublicShare {
  const { tokenHash: _tokenHash, passcodeHash: _passcodeHash, ...rest } = share;
  const expired = Boolean(share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now());
  return {
    ...rest,
    requiresPasscode: Boolean(share.passcodeHash),
    projectName: projectNameValue,
    expired,
    active: !share.revokedAt && !expired,
  };
}

async function projectName(projectId: string): Promise<string> {
  const db = await readDb();
  return db.projects.find((project) => project.id === projectId)?.name ?? "Deleted project";
}

/* ------------------------------------------------------------------ */
/* Visitor-side operations                                             */
/* ------------------------------------------------------------------ */

/** Look up a live link by token. Returns null for unknown, revoked or expired. */
export async function findShare(token: string): Promise<ShareLink | null> {
  if (!token || token.length < 16) return null;
  const db = await readDb();
  const share = db.shares.find((entry) => entry.tokenHash === sha256(token));
  if (!share || share.revokedAt) return null;
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) return null;
  return share;
}

/**
 * The public view of a shared project.
 *
 * Only audio objects attached to the project's mixer channels are exposed, so a
 * private reference file that was never placed in the session stays private.
 */
export async function sharedProjectView(share: ShareLink): Promise<SharedProjectView | null> {
  const db = await readDb();
  const project = db.projects.find((entry) => entry.id === share.projectId);
  if (!project) return null;
  const owner = db.users.find((user) => user.id === share.ownerId);

  const byId = new Map<string, AssetMeta>(project.assets.map((asset) => [asset.id, asset]));
  const tracks: SharedProjectView["tracks"] = [];
  for (const track of project.tracks as Track[]) {
    if (!track.assetId) continue;
    const asset = byId.get(track.assetId);
    if (!asset) continue;
    tracks.push({
        id: track.id,
        name: track.name?.trim() || asset.name,
        role: track.role,
        assetId: asset.id,
        mimeType: asset.mimeType,
      durationSec: asset.durationSec,
      sizeBytes: asset.sizeBytes,
    });
  }

  return {
    projectId: project.id,
    name: project.name,
    ownerName: owner?.name ?? "A producer",
    genre: project.genre,
    bpm: project.bpm,
    musicalKey: project.musicalKey,
    notes: project.notes.slice(0, 400),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    label: share.label,
    allowDownload: share.allowDownload,
    expiresAt: share.expiresAt,
    requiresPasscode: Boolean(share.passcodeHash),
    tracks,
  };
}

/** `cookies()` throws outside a request scope (unit tests); treat that as locked. */
async function cookieValue(name: string): Promise<string | undefined> {
  try {
    const store = await cookies();
    return store.get(name)?.value;
  } catch {
    return undefined;
  }
}

/** True when this browser has already entered the passcode (or none is needed). */
export async function isUnlocked(share: ShareLink): Promise<boolean> {
  if (!share.passcodeHash) return true;
  return (await cookieValue(unlockCookie(share.id))) === unlockValue(share);
}

/** Check a passcode and, on success, remember the visitor for this link. */
export async function unlockShare(token: string, passcode: string): Promise<boolean> {
  const share = await findShare(token);
  if (!share) return false;
  if (!share.passcodeHash) return true;
  const ok = await verifyPassword(passcode.trim(), share.passcodeHash);
  if (!ok) return false;
  // `cookies()` throws synchronously outside a request scope (unit tests), so
  // this is a try/catch rather than a promise rejection handler.
  try {
    const store = await cookies();
    store.set(unlockCookie(share.id), unlockValue(share), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: share.expiresAt ? new Date(share.expiresAt) : undefined,
    });
  } catch {
    // Verification still succeeded; the cookie is only unavailable in tests.
  }
  return true;
}

/** Count (and timestamp) a visit. Best effort: never blocks playback. */
export async function recordOpen(shareId: string): Promise<void> {
  await mutateDb((db) => {
    const share = db.shares.find((entry) => entry.id === shareId);
    if (!share) return;
    share.opens += 1;
    share.lastOpenedAt = nowIso();
  });
}

/** Count a download. Only called after the download is actually allowed. */
export async function recordDownload(shareId: string): Promise<void> {
  await mutateDb((db) => {
    const share = db.shares.find((entry) => entry.id === shareId);
    if (!share) return;
    share.downloads += 1;
  });
}

/**
 * Resolve an asset for streaming/download after checking the share rules.
 *
 * Returns null rather than throwing so callers can answer 404 without revealing
 * whether an asset exists in some other project.
 */
export async function sharedAsset(
  share: ShareLink,
  assetId: string,
  intent: "stream" | "download",
): Promise<AssetMeta | null> {
  if (intent === "download" && !share.allowDownload) return null;
  const db = await readDb();
  const project = db.projects.find((entry) => entry.id === share.projectId);
  if (!project) return null;
  const onMixer = project.tracks.some((track) => track.assetId === assetId);
  if (!onMixer) return null;
  return project.assets.find((asset) => asset.id === assetId) ?? null;
}

/** Remove every link for a project (used when the project is deleted). */
export async function revokeSharesForProject(projectId: string): Promise<void> {
  await mutateDb((db) => {
    for (const share of db.shares) {
      if (share.projectId === projectId && !share.revokedAt) share.revokedAt = nowIso();
    }
  });
}

/** Short human summary used by the project page badge. */
export function describeShare(share: PublicShare): string {
  if (share.revokedAt) return "Revoked";
  if (share.expired) return "Expired";
  if (!share.active) return "Inactive";
  const bits = [share.requiresPasscode ? "passcode" : "no passcode"];
  if (share.expiresAt) bits.push(`expires ${new Date(share.expiresAt).toLocaleDateString()}`);
  else bits.push("no expiry");
  bits.push(share.allowDownload ? "downloads on" : "listen only");
  return bits.join(" · ");
}

/** The project a link belongs to (for the share page header). */
export async function shareProjectName(share: ShareLink): Promise<string> {
  const db = await readDb();
  return db.projects.find((entry) => entry.id === share.projectId)?.name ?? "Shared session";
}

/** Convenience for routes that need the project's owner display name. */
export async function ownerName(ownerId: string): Promise<string> {
  const db = await readDb();
  return db.users.find((user) => user.id === ownerId)?.name ?? "A producer";
}

export type { ShareLink, Project };
