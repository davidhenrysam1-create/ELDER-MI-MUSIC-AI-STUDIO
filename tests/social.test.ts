import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AssetMeta } from "@/lib/types";

/**
 * Publishing, likes and follows.
 *
 * These run against a real temporary data directory: real accounts, real
 * projects, real files. The interesting assertions are the refusals — an
 * engineer cannot publish, nobody can publish another account's file, an
 * unlisted song stays out of Discover, and a download needs both permission and
 * an account.
 */

let tmpDir: string;
let auth: typeof import("@/lib/server/auth");
let repo: typeof import("@/lib/server/repo");
let social: typeof import("@/lib/server/social");
let storage: typeof import("@/lib/server/storage");
let dbModule: typeof import("@/lib/server/db");

const PASSWORD = "publish test password";

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-social-"));
  process.env.DATA_DIR = tmpDir;
  delete process.env.ALLOW_SIGNUP;
  vi.resetModules();
  auth = await import("@/lib/server/auth");
  repo = await import("@/lib/server/repo");
  social = await import("@/lib/server/social");
  storage = await import("@/lib/server/storage");
  dbModule = await import("@/lib/server/db");
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

/** A tiny but real WAV-ish byte blob, so streaming paths have a file to read. */
const BYTES = Buffer.from("RIFF----WAVEfmt " + "0".repeat(64));

async function makeAsset(projectId: string, name = "Master.wav"): Promise<AssetMeta> {
  const asset: AssetMeta = {
    id: `ast_${Math.random().toString(36).slice(2, 12)}`,
    projectId,
    name,
    kind: "master",
    mimeType: "audio/wav",
    extension: "wav",
    sizeBytes: BYTES.byteLength,
    durationSec: 42,
    sampleRate: 48000,
    channels: 2,
    bitDepth: 24,
    peaks: [0.1, 0.4, 0.9],
    engine: "test",
    createdAt: new Date().toISOString(),
  };
  await storage.writeAudio(asset.id, asset.extension, BYTES);
  await repo.addAsset(projectId, asset);
  return asset;
}

async function creator(
  suffix: string,
  roles: ("artist" | "producer" | "engineer" | "promoter")[],
): Promise<{ user: Awaited<ReturnType<typeof auth.signup>>; projectId: string; assetId: string }> {
  const user = await auth.signup(
    {
      name: `Creator ${suffix}`,
      email: `${suffix}@studio.test`,
      password: PASSWORD,
      roles,
      handle: `creator_${suffix}`,
    },
    "vitest",
  );
  const project = await repo.createProject(
    { name: `${suffix} song`, genre: "Afrobeats", bpm: 100, musicalKey: "A minor" },
    user.id,
  );
  const asset = await makeAsset(project.id);
  return { user, projectId: project.id, assetId: asset.id };
}

describe("publishing", () => {
  it("creates a release and shows it in Discover", async () => {
    const { user, projectId, assetId } = await creator("publisher", ["artist"]);
    const release = await social.publishRelease(user, {
      projectId,
      assetId,
      title: "First Light",
      description: "Recorded at home.",
      visibility: "public",
      allowDownload: true,
    });

    expect(release.title).toBe("First Light");
    expect(release.genre).toBe("Afrobeats");
    expect(release.creator.handle).toBe("creator_publisher");
    expect(release.plays).toBe(0);
    expect(release.likeCount).toBe(0);

    const feed = await social.discover({ viewerId: null });
    expect(feed.some((entry) => entry.id === release.id)).toBe(true);
  });

  it("refuses an engineer, and says why", async () => {
    const { user, projectId, assetId } = await creator("engineer", ["engineer"]);
    await expect(
      social.publishRelease(user, { projectId, assetId, title: "Mix only" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses an account without a handle", async () => {
    const user = await auth.signup(
      { name: "No Handle", email: "nohandle@studio.test", password: PASSWORD, roles: ["artist"] },
      "vitest",
    );
    const project = await repo.createProject({ name: "Hidden" }, user.id);
    const asset = await makeAsset(project.id);
    await expect(
      social.publishRelease(user, { projectId: project.id, assetId: asset.id, title: "Nameless" }),
    ).rejects.toThrow(/handle/i);
  });

  it("cannot publish another account's file", async () => {
    const owner = await creator("owner", ["producer"]);
    const stranger = await creator("stranger", ["producer"]);
    await expect(
      social.publishRelease(stranger.user, {
        projectId: owner.projectId,
        assetId: owner.assetId,
        title: "Stolen",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("requires a title of at least two characters", async () => {
    const { user, projectId, assetId } = await creator("titles", ["artist"]);
    await expect(
      social.publishRelease(user, { projectId, assetId, title: " " }),
    ).rejects.toThrow(/title/i);
  });

  it("updates the existing release instead of duplicating the project", async () => {
    const { user, projectId, assetId } = await creator("republish", ["artist"]);
    const first = await social.publishRelease(user, { projectId, assetId, title: "Take one" });
    const second = await social.publishRelease(user, { projectId, assetId, title: "Take two" });
    expect(second.id).toBe(first.id);
    const mine = await social.listOwnReleases(user.id);
    expect(mine.filter((entry) => entry.title === "Take two")).toHaveLength(1);
  });

  it("keeps an unlisted song out of Discover but on the creator's page", async () => {
    const { user, projectId, assetId } = await creator("unlisted", ["artist"]);
    const release = await social.publishRelease(user, {
      projectId,
      assetId,
      title: "Not announced",
      visibility: "unlisted",
    });

    expect((await social.discover({ viewerId: null })).some((r) => r.id === release.id)).toBe(false);
    expect((await social.discover({ viewerId: user.id })).some((r) => r.id === release.id)).toBe(true);

    const page = await social.creatorPage("creator_unlisted", null);
    expect(page?.releases.some((r) => r.id === release.id)).toBe(true);
  });

  it("lets the owner unpublish without touching the project", async () => {
    const { user, projectId, assetId } = await creator("unpublish", ["artist"]);
    const release = await social.publishRelease(user, { projectId, assetId, title: "Gone soon" });
    await social.unpublishRelease(user.id, release.id);
    expect(await social.releaseCard(release.id, user.id)).toBeNull();
    expect(await repo.getProject(projectId, user.id)).not.toBeNull();
  });

  it("refuses to unpublish somebody else's release", async () => {
    const owner = await creator("own1", ["artist"]);
    const other = await creator("own2", ["artist"]);
    const release = await social.publishRelease(owner.user, {
      projectId: owner.projectId,
      assetId: owner.assetId,
      title: "Mine",
    });
    await expect(social.unpublishRelease(other.user.id, release.id)).rejects.toMatchObject({ status: 403 });
  });
});

describe("likes and follows", () => {
  it("toggles a like and keeps one row per account", async () => {
    const { user, projectId, assetId } = await creator("liked", ["artist"]);
    const release = await social.publishRelease(user, { projectId, assetId, title: "Likeable" });
    const listener = await creator("listener", ["artist"]);

    const on = await social.toggleLike(release.id, listener.user.id);
    expect(on).toEqual({ liked: true, likeCount: 1 });
    const off = await social.toggleLike(release.id, listener.user.id);
    expect(off).toEqual({ liked: false, likeCount: 0 });
  });

  it("follows and unfollows with a real follower count", async () => {
    const target = await creator("target", ["artist"]);
    const fan = await creator("fan", ["artist"]);

    const follow = await social.toggleFollow(fan.user.id, "creator_target");
    expect(follow.following).toBe(true);

    const page = await social.creatorPage("creator_target", fan.user.id);
    expect(page?.followers).toBe(1);
    expect(page?.followingViewer).toBe(true);

    const unfollow = await social.toggleFollow(fan.user.id, "creator_target");
    expect(unfollow.following).toBe(false);
    expect(unfollow.followers).toBe(0);
  });

  it("refuses following yourself", async () => {
    const { user } = await creator("narcissus", ["artist"]);
    await expect(social.toggleFollow(user.id, "creator_narcissus")).rejects.toThrow(/yourself/i);
  });

  it("builds the following feed from the creators you follow", async () => {
    const followed = await creator("feedtarget", ["artist"]);
    const other = await creator("feedother", ["artist"]);
    await social.publishRelease(followed.user, {
      projectId: followed.projectId,
      assetId: followed.assetId,
      title: "Followed song",
    });
    await social.publishRelease(other.user, {
      projectId: other.projectId,
      assetId: other.assetId,
      title: "Other song",
    });

    const fan = await creator("feedfan", ["artist"]);
    await social.toggleFollow(fan.user.id, "creator_feedtarget");

    const feed = await social.discover({ viewerId: fan.user.id, scope: "following" });
    const titles = feed.map((entry) => entry.title);
    expect(titles).toContain("Followed song");
    expect(titles).not.toContain("Other song");

    // Without an account the feed is refused rather than silently empty.
    await expect(social.discover({ scope: "following" })).rejects.toMatchObject({ status: 401 });
  });
});

describe("listening and downloading", () => {
  it("streams a public song for a visitor and counts the play", async () => {
    const { user, projectId, assetId } = await creator("streamer", ["artist"]);
    const release = await social.publishRelease(user, { projectId, assetId, title: "Stream me" });

    const found = await social.releaseAudio(release.id, { intent: "stream", viewerId: null });
    expect(found?.data.byteLength).toBe(BYTES.byteLength);

    await social.recordPlay(release.id);
    const after = await social.releaseCard(release.id, null);
    expect(after?.plays).toBe(1);
  });

  it("refuses a download when the creator said listen-only", async () => {
    const { user, projectId, assetId } = await creator("nodl", ["artist"]);
    const release = await social.publishRelease(user, {
      projectId,
      assetId,
      title: "Listen only",
      allowDownload: false,
    });
    await expect(
      social.releaseAudio(release.id, { intent: "download", viewerId: user.id }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a download to a visitor without an account", async () => {
    const { user, projectId, assetId } = await creator("anon", ["artist"]);
    const release = await social.publishRelease(user, {
      projectId,
      assetId,
      title: "Free but gated",
      allowDownload: true,
    });
    await expect(
      social.releaseAudio(release.id, { intent: "download", viewerId: null }),
    ).rejects.toMatchObject({ status: 401 });

    const listener = await creator("dl", ["artist"]);
    const allowed = await social.releaseAudio(release.id, {
      intent: "download",
      viewerId: listener.user.id,
    });
    expect(allowed?.release.id).toBe(release.id);
  });

  it("hides the music of a suspended creator", async () => {
    const { user, projectId, assetId } = await creator("banned", ["artist"]);
    const release = await social.publishRelease(user, { projectId, assetId, title: "Banned song" });
    await auth.adminUpdateUser("admin", user.id, { suspended: true, suspendedReason: "Test" });

    expect(await social.releaseCard(release.id, null)).toBeNull();
    expect(await social.creatorPage("creator_banned", null)).toBeNull();
    expect((await social.discover({ viewerId: null })).some((r) => r.id === release.id)).toBe(false);
  });

  it("reports an account's own numbers honestly, including zeros", async () => {
    const { user, projectId, assetId } = await creator("stats", ["artist"]);
    const release = await social.publishRelease(user, { projectId, assetId, title: "Counting" });

    const before = await social.accountSocialSummary(user.id);
    expect(before).toMatchObject({ published: 1, plays: 0, likes: 0, downloads: 0, followers: 0 });

    await social.toggleLike(release.id, user.id);
    await social.recordPlay(release.id);
    await social.recordDownload(release.id);
    const after = await social.accountSocialSummary(user.id);
    expect(after).toMatchObject({ published: 1, plays: 1, likes: 1, downloads: 1 });

    // Nothing invented for an account that published nothing.
    const empty = await social.accountSocialSummary("usr_nobody");
    expect(empty).toMatchObject({ published: 0, plays: 0, likes: 0, followers: 0 });
  });

  it("stores the publishing tables in the same JSON database", async () => {
    const state = await dbModule.readDb();
    expect(state.version).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(state.releases)).toBe(true);
    expect(Array.isArray(state.follows)).toBe(true);
    expect(Array.isArray(state.likes)).toBe(true);
  });
});
