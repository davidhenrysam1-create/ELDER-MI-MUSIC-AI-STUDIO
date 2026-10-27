/**
 * Publishing: releases, likes and follows.
 *
 * This is the social layer of the studio — the part a listener meets. It is
 * deliberately small and honest:
 *
 *  - A **release** is one finished audio object copied out of a project into the
 *    public site. The project itself (mixer, mastering chain, stems, versions)
 *    is never exposed.
 *  - **Plays** are counted when a player starts the file (not on every seek).
 *  - **Downloads** require a signed-in account *and* the creator's permission.
 *  - **Likes** and **follows** are single rows, so repeating an action toggles it
 *    instead of inflating a counter.
 *
 * Counters are real numbers from the database. Nothing here invents activity.
 */
import { randomUUID } from "node:crypto";
import { mutateDb, readDb } from "@/lib/server/db";
import { getProject } from "@/lib/server/repo";
import { readAudio } from "@/lib/server/storage";
import { canPublish } from "@/lib/roles";
import type {
  AccountRole,
  AssetMeta,
  Genre,
  Release,
  ReleaseVisibility,
} from "@/lib/types";

/** Anything that can act: the session's public user, narrowed. */
export interface Actor {
  id: string;
  roles?: AccountRole[];
  isAdmin?: boolean;
  handle?: string | null;
}

export interface CreatorSummary {
  id: string;
  name: string;
  handle: string | null;
  roles: AccountRole[];
  isAdmin: boolean;
}

/** A release plus everything the UI needs in one object. */
export interface ReleaseCard {
  id: string;
  title: string;
  description: string;
  genre: Genre;
  bpm: number;
  musicalKey: string;
  allowDownload: boolean;
  visibility: ReleaseVisibility;
  plays: number;
  downloads: number;
  likeCount: number;
  likedByViewer: boolean;
  followingCreator: boolean;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
  creator: CreatorSummary;
  /** Streaming URL; the file itself is only served after the checks in the route. */
  audioUrl: string;
  durationSec: number;
}

/** A typed failure the routes turn into a status code. */
export class SocialError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "SocialError";
    this.status = status;
  }
}

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 400;

/** Public creator summary, or null when the account is suspended. */
function creatorOf(
  userId: string,
  users: { id: string; name: string; handle?: string | null; roles?: AccountRole[]; suspendedAt?: string | null }[],
  adminIds: Set<string>,
): CreatorSummary | null {
  const user = users.find((entry) => entry.id === userId);
  if (!user || user.suspendedAt) return null;
  return {
    id: user.id,
    name: user.name,
    handle: user.handle ?? null,
    roles: user.roles ?? [],
    isAdmin: adminIds.has(user.id),
  };
}

/**
 * Create or update a release.
 *
 * Ownership is checked against the real project (and the asset inside it), not
 * against anything the client sends. A creator must have a handle first, so
 * every published song has a page to live on.
 */
export async function publishRelease(
  actor: Actor,
  input: {
    projectId: string;
    assetId: string;
    title: string;
    description?: string;
    visibility?: ReleaseVisibility;
    allowDownload?: boolean;
  },
): Promise<ReleaseCard> {
  if (!canPublish(actor.roles, actor.isAdmin)) {
    throw new SocialError(
      "Your dashboard does not include publishing. Artists, producers and promoters can publish; change your roles in My account.",
      403,
    );
  }
  if (!actor.handle) {
    throw new SocialError(
      "Choose a public handle in My account first — every published song links back to your page.",
      400,
    );
  }

  const project = await getProject(input.projectId, actor.id);
  if (!project) throw new SocialError("Project not found.", 404);
  const asset = project.assets.find((entry) => entry.id === input.assetId);
  if (!asset) throw new SocialError("That audio file is not in this project.", 404);
  if (!Number.isFinite(asset.durationSec) || asset.durationSec <= 0) {
    throw new SocialError("That file has no measurable audio, so it cannot be published.", 400);
  }

  const title = (input.title ?? "").trim().slice(0, MAX_TITLE);
  if (title.length < 2) throw new SocialError("Give the song a title (at least 2 characters).");

  const now = new Date().toISOString();
  const id = `rel_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

  const release = await mutateDb((db) => {
    // One release per project: publishing again updates the same entry instead of
    // filling the feed with duplicates of the same song.
    const existing = db.releases.find(
      (entry) => entry.ownerId === actor.id && entry.projectId === input.projectId,
    );
    if (existing) {
      existing.assetId = asset.id;
      existing.title = title;
      existing.description = (input.description ?? existing.description ?? "").slice(0, MAX_DESCRIPTION);
      existing.visibility = input.visibility ?? existing.visibility;
      existing.allowDownload = input.allowDownload ?? existing.allowDownload;
      existing.updatedAt = now;
      return existing;
    }
    const created: Release = {
      id,
      ownerId: actor.id,
      projectId: project.id,
      assetId: asset.id,
      title,
      genre: project.genre,
      bpm: project.bpm,
      musicalKey: project.musicalKey,
      description: (input.description ?? "").slice(0, MAX_DESCRIPTION),
      allowDownload: input.allowDownload === true,
      visibility: input.visibility === "unlisted" ? "unlisted" : "public",
      plays: 0,
      downloads: 0,
      createdAt: now,
      updatedAt: now,
    };
    db.releases.push(created);
    return created;
  });

  const card = await releaseCard(release.id, actor.id);
  if (!card) throw new SocialError("Could not read the release back.", 500);
  return card;
}

/** Releases owned by one account, published or not (never cached). */
export async function listOwnReleases(actorId: string): Promise<ReleaseCard[]> {
  const db = await readDb();
  const ids = db.releases
    .filter((release) => release.ownerId === actorId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((release) => release.id);
  const cards = await Promise.all(ids.map((id) => releaseCard(id, actorId, { includeUnlisted: true })));
  return cards.filter((card): card is ReleaseCard => card !== null);
}

/** Change the text, visibility or download permission of a release you own. */
export async function updateRelease(
  actorId: string,
  releaseId: string,
  patch: {
    title?: string;
    description?: string;
    visibility?: ReleaseVisibility;
    allowDownload?: boolean;
  },
): Promise<ReleaseCard> {
  await mutateDb((db) => {
    const release = db.releases.find((entry) => entry.id === releaseId);
    if (!release) throw new SocialError("Release not found.", 404);
    if (release.ownerId !== actorId) throw new SocialError("That release is not yours.", 403);
    if (patch.title !== undefined) {
      const title = patch.title.trim().slice(0, MAX_TITLE);
      if (title.length < 2) throw new SocialError("Give the song a title (at least 2 characters).");
      release.title = title;
    }
    if (patch.description !== undefined) {
      release.description = patch.description.slice(0, MAX_DESCRIPTION);
    }
    if (patch.visibility !== undefined) {
      release.visibility = patch.visibility === "unlisted" ? "unlisted" : "public";
    }
    if (patch.allowDownload !== undefined) release.allowDownload = patch.allowDownload;
    release.updatedAt = new Date().toISOString();
  });
  const card = await releaseCard(releaseId, actorId);
  if (!card) throw new SocialError("Release not found.", 404);
  return card;
}

/**
 * Remove a release from the public site.
 *
 * The project and its audio are untouched — this only unpublishes.
 */
export async function unpublishRelease(actorId: string, releaseId: string): Promise<void> {
  await mutateDb((db) => {
    const release = db.releases.find((entry) => entry.id === releaseId);
    if (!release) throw new SocialError("Release not found.", 404);
    if (release.ownerId !== actorId) throw new SocialError("That release is not yours.", 403);
    db.releases = db.releases.filter((entry) => entry.id !== releaseId);
    // Likes point at the released song, so they go with it.
    db.likes = db.likes.filter((like) => like.releaseId !== releaseId);
  });
}

/** Build the public view of one release, or null when it is not visible. */
export async function releaseCard(
  releaseId: string,
  viewerId?: string | null,
  options: { includeUnlisted?: boolean } = {},
): Promise<ReleaseCard | null> {
  const db = await readDb();
  const release = db.releases.find((entry) => entry.id === releaseId);
  if (!release) return null;
  if (release.visibility === "unlisted" && !options.includeUnlisted && viewerId !== release.ownerId) {
    return null;
  }

  const creator = creatorOf(
    release.ownerId,
    db.users,
    new Set(db.users.filter((user) => user.isAdmin).map((user) => user.id)),
  );
  if (!creator) return null;

  // The asset is read from the owner's project: a stale release whose file was
  // deleted is reported as missing rather than served as a broken player.
  const project = db.projects.find((entry) => entry.id === release.projectId);
  const asset = project?.assets.find((entry) => entry.id === release.assetId);

  return {
    id: release.id,
    title: release.title,
    description: release.description,
    genre: release.genre,
    bpm: release.bpm,
    musicalKey: release.musicalKey,
    allowDownload: release.allowDownload,
    visibility: release.visibility,
    plays: release.plays,
    downloads: release.downloads,
    likeCount: db.likes.filter((like) => like.releaseId === release.id).length,
    likedByViewer: Boolean(viewerId && db.likes.some((like) => like.releaseId === release.id && like.userId === viewerId)),
    followingCreator: Boolean(
      viewerId &&
        viewerId !== release.ownerId &&
        db.follows.some((follow) => follow.followerId === viewerId && follow.followingId === release.ownerId),
    ),
    isOwn: viewerId === release.ownerId,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
    creator,
    audioUrl: `/api/releases/${release.id}/audio`,
    durationSec: asset?.durationSec ?? 0,
  };
}

/**
 * Discover / feed.
 *
 * `scope: "following"` needs a signed-in account and returns songs from the
 * creators that account follows, plus their own. Everything else is public.
 */
export async function discover(
  options: {
    viewerId?: string | null;
    scope?: "all" | "following" | "creator";
    handle?: string;
    genre?: string;
    query?: string;
    limit?: number;
  } = {},
): Promise<ReleaseCard[]> {
  const db = await readDb();
  const scope = options.scope ?? "all";
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 100);

  let releases = db.releases.filter((release) => {
    // Unlisted songs are visible to their owner and on the creator's own page.
    if (release.visibility !== "public" && options.viewerId !== release.ownerId && scope !== "creator") {
      return false;
    }
    return true;
  });

  if (scope === "following") {
    if (!options.viewerId) {
      throw new SocialError("Sign in to see the creators you follow.", 401);
    }
    const following = new Set(
      db.follows
        .filter((follow) => follow.followerId === options.viewerId)
        .map((follow) => follow.followingId),
    );
    following.add(options.viewerId);
    releases = releases.filter((release) => following.has(release.ownerId));
  }

  if (scope === "creator" && options.handle) {
    const wanted = options.handle.replace(/^@/, "").toLowerCase();
    const owner = db.users.find((user) => (user.handle ?? "").toLowerCase() === wanted);
    if (!owner) return [];
    releases = releases.filter((release) => release.ownerId === owner.id);
  }

  if (options.genre) {
    releases = releases.filter((release) => release.genre === options.genre);
  }
  if (options.query) {
    const needle = options.query.trim().toLowerCase();
    releases = releases.filter((release) => {
      const creator = db.users.find((user) => user.id === release.ownerId);
      return (
        release.title.toLowerCase().includes(needle) ||
        (creator?.name ?? "").toLowerCase().includes(needle) ||
        (creator?.handle ?? "").toLowerCase().includes(needle) ||
        release.genre.toLowerCase().includes(needle)
      );
    });
  }

  releases = releases.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  const cards = await Promise.all(releases.map((release) => releaseCard(release.id, options.viewerId, { includeUnlisted: true })));
  return cards.filter((card): card is ReleaseCard => card !== null);
}

/** Like or unlike; returns the resulting state instead of a bare success. */
export async function toggleLike(
  releaseId: string,
  userId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const result = await mutateDb((db) => {
    const release = db.releases.find((entry) => entry.id === releaseId);
    if (!release) throw new SocialError("Release not found.", 404);
    const existing = db.likes.find((like) => like.releaseId === releaseId && like.userId === userId);
    if (existing) {
      db.likes = db.likes.filter((like) => !(like.releaseId === releaseId && like.userId === userId));
    } else {
      db.likes.push({
        id: `like_${randomUUID().replace(/-/g, "").slice(0, 18)}`,
        userId,
        releaseId,
        createdAt: new Date().toISOString(),
      });
    }
    return {
      liked: !existing,
      likeCount: db.likes.filter((like) => like.releaseId === releaseId).length,
    };
  });
  return result;
}

/** Follow or unfollow a creator by id or handle. */
export async function toggleFollow(
  followerId: string,
  target: string,
): Promise<{ following: boolean; followers: number }> {
  return mutateDb((db) => {
    const wanted = target.replace(/^@/, "").toLowerCase();
    const creator = db.users.find(
      (user) => user.id === target || (user.handle ?? "").toLowerCase() === wanted,
    );
    if (!creator) throw new SocialError("Creator not found.", 404);
    if (creator.id === followerId) throw new SocialError("You cannot follow yourself.", 400);
    if (creator.suspendedAt) throw new SocialError("That account is suspended.", 403);

    const existing = db.follows.find(
      (follow) => follow.followerId === followerId && follow.followingId === creator.id,
    );
    if (existing) {
      db.follows = db.follows.filter((follow) => follow.id !== existing.id);
    } else {
      db.follows.push({
        id: `fol_${randomUUID().replace(/-/g, "").slice(0, 18)}`,
        followerId,
        followingId: creator.id,
        createdAt: new Date().toISOString(),
      });
    }
    return {
      following: !existing,
      followers: db.follows.filter((follow) => follow.followingId === creator.id).length,
    };
  });
}

/** A creator's public page: profile facts, counts and their releases. */
export async function creatorPage(
  handle: string,
  viewerId?: string | null,
): Promise<{
  profile: CreatorSummary & { bio: string; links: Record<string, string>; joinedAt: string };
  releases: ReleaseCard[];
  followers: number;
  following: number;
  followingViewer: boolean;
} | null> {
  const db = await readDb();
  const wanted = handle.replace(/^@/, "").toLowerCase();
  const user = db.users.find((entry) => (entry.handle ?? "").toLowerCase() === wanted);
  if (!user || user.suspendedAt) return null;

  const releases = await discover({ viewerId, scope: "creator", handle: wanted, limit: 100 });
  return {
    profile: {
      id: user.id,
      name: user.name,
      handle: user.handle ?? null,
      roles: user.roles ?? [],
      isAdmin: db.users.some((entry) => entry.id === user.id && entry.isAdmin === true),
      bio: user.bio ?? "",
      links: {
        audiomack: user.links?.audiomack ?? "",
        instagram: user.links?.instagram ?? "",
        facebook: user.links?.facebook ?? "",
      },
      joinedAt: user.createdAt,
    },
    releases,
    followers: db.follows.filter((follow) => follow.followingId === user.id).length,
    following: db.follows.filter((follow) => follow.followerId === user.id).length,
    followingViewer: Boolean(
      viewerId && db.follows.some((follow) => follow.followerId === viewerId && follow.followingId === user.id),
    ),
  };
}

/** Count one listen. Called only for a fresh start, never for a seek. */
export async function recordPlay(releaseId: string): Promise<void> {
  await mutateDb((db) => {
    const release = db.releases.find((entry) => entry.id === releaseId);
    if (release) release.plays += 1;
  });
}

/** Count one download, after the permission check has already passed. */
export async function recordDownload(releaseId: string): Promise<void> {
  await mutateDb((db) => {
    const release = db.releases.find((entry) => entry.id === releaseId);
    if (release) release.downloads += 1;
  });
}

/**
 * The file behind a release, with its permission check.
 *
 * Returns the asset plus bytes when the release exists, the project still owns
 * the file, and (for a download) the creator allowed it and the caller is a
 * signed-in account.
 */
export async function releaseAudio(
  releaseId: string,
  options: { intent: "stream" | "download"; viewerId?: string | null },
): Promise<{ release: Release; asset: AssetMeta; data: Buffer } | null> {
  const db = await readDb();
  const release = db.releases.find((entry) => entry.id === releaseId);
  if (!release) return null;
  // An unlisted song can still be streamed by a listener holding the link, but
  // only the owner can download it before it is public.
  if (release.visibility === "unlisted" && options.viewerId !== release.ownerId && options.intent === "download") {
    return null;
  }
  if (options.intent === "download") {
    if (!release.allowDownload) throw new SocialError("The creator has download switched off for this song.", 403);
    if (!options.viewerId) throw new SocialError("Sign in to download a song.", 401);
  }

  const project = db.projects.find((entry) => entry.id === release.projectId);
  const asset = project?.assets.find((entry) => entry.id === release.assetId);
  if (!asset) return null;
  try {
    const { data } = await readAudio(asset.id, asset.extension);
    return { release, asset, data };
  } catch {
    return null;
  }
}

/**
 * One screen's worth of numbers for the dashboard: what an account has
 * published and who is listening. Real counts only — zeros are allowed.
 */
export async function accountSocialSummary(userId: string): Promise<{
  published: number;
  plays: number;
  likes: number;
  downloads: number;
  followers: number;
  following: number;
}> {
  const db = await readDb();
  const mine = db.releases.filter((release) => release.ownerId === userId);
  const ids = new Set(mine.map((release) => release.id));
  return {
    published: mine.length,
    plays: mine.reduce((sum, release) => sum + release.plays, 0),
    likes: db.likes.filter((like) => ids.has(like.releaseId)).length,
    downloads: mine.reduce((sum, release) => sum + release.downloads, 0),
    followers: db.follows.filter((follow) => follow.followingId === userId).length,
    following: db.follows.filter((follow) => follow.followerId === userId).length,
  };
}
