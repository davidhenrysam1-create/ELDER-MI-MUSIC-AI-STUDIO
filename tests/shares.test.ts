import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { makeTrack } from "@/lib/projects";

/**
 * Share links: ownership, one-time tokens, expiry, revocation, passcodes and
 * what a visitor is actually allowed to see or download.
 */

let tmpDir: string;
let shares: typeof import("@/lib/server/shares");
let repo: typeof import("@/lib/server/repo");
let db: typeof import("@/lib/server/db");

const OWNER = "usr_share_owner";
const STRANGER = "usr_share_stranger";

let projectId = "";
let assetId = "";

/** Add an audio object to the project's mixer so it becomes shareable. */
async function addTrackedAsset(project: string, id: string) {
  await repo.addAsset(project, {
    id,
    projectId: project,
    name: `${id}.wav`,
    kind: "stem",
    mimeType: "audio/wav",
    extension: "wav",
    sizeBytes: 4,
    durationSec: 3,
    sampleRate: 48000,
    channels: 2,
    bitDepth: 16,
    peaks: [],
    engine: "test",
    derivedFromId: null,
    createdAt: new Date().toISOString(),
    sha256: "0".repeat(64),
  });
  await repo.patchProject(project, (state) => {
    state.tracks.push(makeTrack(id, "Kick", "drums", state.tracks.length));
  });
}

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "eldermi-shares-"));
  process.env.DATA_DIR = tmpDir;
  vi.resetModules();
  shares = await import("@/lib/server/shares");
  repo = await import("@/lib/server/repo");
  db = await import("@/lib/server/db");

  const project = await repo.createProject({ name: "Shared session" }, OWNER);
  projectId = project.id;
  assetId = "ast_shared_1";
  await addTrackedAsset(projectId, assetId);
  // A file that is stored but not on the mixer must stay hidden.
  await repo.addAsset(projectId, {
    id: "ast_private_ref",
    projectId,
    name: "reference.wav",
    kind: "stem",
    mimeType: "audio/wav",
    extension: "wav",
    sizeBytes: 4,
    durationSec: 3,
    sampleRate: 48000,
    channels: 2,
    bitDepth: 16,
    peaks: [],
    engine: "test",
    derivedFromId: null,
    createdAt: new Date().toISOString(),
    sha256: "1".repeat(64),
  });
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("creating links", () => {
  it("stores only a hash of the token", async () => {
    const created = await shares.createShare(OWNER, { projectId, label: "Ada" });
    expect(created.token.length).toBeGreaterThan(20);
    expect(created.path).toBe(`/s/${created.token}`);

    const state = await db.readDb();
    const stored = state.shares.find((share) => share.id === created.share.id)!;
    expect(JSON.stringify(stored)).not.toContain(created.token);
    expect(stored.tokenHash).toHaveLength(64);
    // The public shape never exposes the token or the passcode hash.
    expect(JSON.stringify(created.share)).not.toContain("tokenHash");
    expect((created.share as { passcodeHash?: string }).passcodeHash).toBeUndefined();
  });

  it("refuses a project the caller does not own", async () => {
    await expect(
      shares.createShare(STRANGER, { projectId }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("validates passcode length and expiry range", async () => {
    await expect(shares.createShare(OWNER, { projectId, passcode: "12" })).rejects.toThrow(
      /passcode/i,
    );
    await expect(
      shares.createShare(OWNER, { projectId, expiresInDays: 400 }),
    ).rejects.toThrow(/expiry/i);
  });

  it("lists only the caller's links with their state", async () => {
    const mine = await shares.listShares(OWNER);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((share) => share.ownerId === OWNER)).toBe(true);
    expect(await shares.listShares(STRANGER)).toHaveLength(0);
  });
});

describe("visiting a link", () => {
  it("resolves a live token and rejects unknown ones", async () => {
    const created = await shares.createShare(OWNER, { projectId, allowDownload: true });
    const found = await shares.findShare(created.token);
    expect(found?.id).toBe(created.share.id);
    expect(await shares.findShare("not-a-real-token-at-all")).toBeNull();
  });

  it("stops working when revoked", async () => {
    const created = await shares.createShare(OWNER, { projectId });
    expect(await shares.findShare(created.token)).not.toBeNull();
    // A stranger cannot revoke it.
    expect(await shares.revokeShare(STRANGER, created.share.id)).toBe(false);
    expect(await shares.findShare(created.token)).not.toBeNull();
    expect(await shares.revokeShare(OWNER, created.share.id)).toBe(true);
    expect(await shares.findShare(created.token)).toBeNull();
  });

  it("stops working when expired", async () => {
    const created = await shares.createShare(OWNER, { projectId, expiresInDays: 1 });
    // Move the expiry into the past, as if a day had passed.
    await db.mutateDb((state) => {
      const share = state.shares.find((entry) => entry.id === created.share.id)!;
      share.expiresAt = new Date(Date.now() - 1000).toISOString();
    });
    expect(await shares.findShare(created.token)).toBeNull();
    const listed = (await shares.listShares(OWNER)).find((share) => share.id === created.share.id)!;
    expect(listed.expired).toBe(true);
    expect(listed.active).toBe(false);
  });

  it("shares mixer audio only — not every stored file", async () => {
    const created = await shares.createShare(OWNER, { projectId });
    const share = await shares.findShare(created.token);
    const view = await shares.sharedProjectView(share!);
    expect(view?.tracks.map((track) => track.assetId)).toEqual([assetId]);
    expect(view?.ownerName).toBe("A producer"); // no user record in this fixture
    // The private reference asset is not reachable through the link.
    expect(await shares.sharedAsset(share!, "ast_private_ref", "stream")).toBeNull();
  });

  it("blocks downloads unless the owner enabled them", async () => {
    const listenOnly = await shares.createShare(OWNER, { projectId, allowDownload: false });
    const listening = (await shares.findShare(listenOnly.token))!;
    expect(await shares.sharedAsset(listening, assetId, "download")).toBeNull();
    expect(await shares.sharedAsset(listening, assetId, "stream")).not.toBeNull();

    const downloadable = await shares.createShare(OWNER, { projectId, allowDownload: true });
    const download = (await shares.findShare(downloadable.token))!;
    expect(await shares.sharedAsset(download, assetId, "download")).not.toBeNull();
  });
});

describe("passcodes", () => {
  it("locks the page until the right passcode is supplied", async () => {
    const created = await shares.createShare(OWNER, { projectId, passcode: "1234" });
    const share = (await shares.findShare(created.token))!;
    expect(share.passcodeHash).not.toBeNull();
    // No cookie in this unit test: still locked.
    expect(await shares.isUnlocked(share)).toBe(false);
    expect(await shares.unlockShare(created.token, "9999")).toBe(false);
    expect(await shares.unlockShare(created.token, "1234")).toBe(true);
  });

  it("does not count opens for a link that no longer exists", async () => {
    const created = await shares.createShare(OWNER, { projectId });
    const before = (await db.readDb()).shares.length;
    await shares.recordOpen("shr_missing");
    expect((await db.readDb()).shares.length).toBe(before);
  });
});
