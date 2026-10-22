import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { mutateDb, readDb } from "@/lib/server/db";
import { EXPORT_DIR } from "@/lib/server/db";
import { deleteAudio } from "@/lib/server/storage";
import type {
  AssetMeta,
  Database,
  ExportRecord,
  Genre,
  Project,
  ProjectVersion,
  StudioId,
  VoiceProfile,
} from "@/lib/types";
import { emptyProject, nowIso } from "@/lib/projects";

export async function listProjects() {
  const db = await readDb();
  return [...db.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string) {
  const db = await readDb();
  return db.projects.find((p) => p.id === id) ?? null;
}

export async function createProject(input: {
  name: string;
  genre?: Genre;
  bpm?: number;
  musicalKey?: string;
}) {
  return mutateDb((db) => {
    const project = emptyProject(
      input.name,
      input.genre ?? "Afrobeats",
      input.bpm ?? 104,
      input.musicalKey ?? "F# minor",
    );
    db.projects.unshift(project);
    return project;
  });
}

const PROTECTED_KEYS: (keyof Project)[] = ["id", "createdAt"];

/**
 * Patch a project. Accepts partial state for tracks, mix, vocal, mastering and
 * generic metadata. Unknown/blocked keys are ignored.
 */
export async function patchProject(
  id: string,
  patch: Partial<Project> | ((p: Project) => void),
): Promise<Project | null> {
  return mutateDb((db) => {
    const project = db.projects.find((p) => p.id === id);
    if (!project) return null;
    if (typeof patch === "function") {
      patch(project);
    } else {
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        if (PROTECTED_KEYS.includes(key as keyof Project)) continue;
        (project as unknown as Record<string, unknown>)[key] = value;
      }
    }
    project.updatedAt = nowIso();
    return project;
  });
}

export async function deleteProject(id: string) {
  return mutateDb(async (db) => {
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    const [project] = db.projects.splice(idx, 1);
    // Remove every private audio object owned by this project.
    await Promise.allSettled(
      project.assets.map((a) => deleteAudio(a.id, a.extension)),
    );
    const removedExports = db.exports.filter((e) => e.projectId === id);
    db.exports = db.exports.filter((e) => e.projectId !== id);
    await Promise.allSettled(
      removedExports.map((e) =>
        fs.unlink(path.join(EXPORT_DIR, path.basename(e.storedName))).catch(() => {}),
      ),
    );
    return true;
  });
}

export async function duplicateProject(id: string) {
  const source = await getProject(id);
  if (!source) return null;
  const copy: Project = {
    ...structuredClone(source),
    id: `prj_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    name: `${source.name} (copy)`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    versions: [],
    jobs: [],
  };
  // Re-use the same audio objects; deletion is reference-counted below.
  return mutateDb((db) => {
    db.projects.unshift(copy);
    return copy;
  });
}

/** Only delete an audio object when no other project references it. */
export async function deleteAsset(projectId: string, assetId: string) {
  return mutateDb(async (db) => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return false;
    const asset = project.assets.find((a) => a.id === assetId);
    if (!asset) return false;
    project.assets = project.assets.filter((a) => a.id !== assetId);
    project.tracks = project.tracks
      .map((t) => (t.assetId === assetId ? { ...t, assetId: null } : t))
      .filter((t) => t.assetId || t.name);
    if (project.mastering.sourceAssetId === assetId) {
      project.mastering.sourceAssetId = null;
      project.mastering.lastMasterAssetId = null;
    }
    if (project.mastering.lastMasterAssetId === assetId) {
      project.mastering.lastMasterAssetId = null;
    }
    if (project.mix.lastMixAssetId === assetId) project.mix.lastMixAssetId = null;
    if (project.vocal.sourceAssetId === assetId) project.vocal.sourceAssetId = null;
    project.vocal.generatedAssetIds = project.vocal.generatedAssetIds.filter(
      (v) => v !== assetId,
    );
    project.updatedAt = nowIso();
    const stillReferenced = db.projects.some(
      (p) => p.id !== projectId && p.assets.some((a) => a.id === assetId),
    );
    if (!stillReferenced) await deleteAudio(assetId, asset.extension);
    return true;
  });
}

export async function addAsset(projectId: string, asset: AssetMeta) {
  return mutateDb((db) => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return null;
    project.assets.unshift(asset);
    project.updatedAt = nowIso();
    return project;
  });
}

export async function saveVersion(
  projectId: string,
  note: string,
  studio: StudioId,
  label?: string,
): Promise<ProjectVersion | null> {
  return mutateDb((db) => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return null;
    const version: ProjectVersion = {
      id: `ver_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      label: label?.trim() || `Version ${project.versions.length + 1}`,
      note: note.slice(0, 400),
      createdAt: nowIso(),
      studio,
      tracks: structuredClone(project.tracks),
      mix: structuredClone(project.mix),
      vocal: structuredClone(project.vocal),
      mastering: structuredClone(project.mastering),
      masterAssetId: project.mastering.lastMasterAssetId,
    };
    project.versions.unshift(version);
    project.versions = project.versions.slice(0, 40);
    project.updatedAt = nowIso();
    return version;
  });
}

export async function restoreVersion(projectId: string, versionId: string) {
  return mutateDb((db) => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return null;
    const version = project.versions.find((v) => v.id === versionId);
    if (!version) return null;
    project.tracks = structuredClone(version.tracks);
    project.mix = structuredClone(version.mix);
    project.vocal = structuredClone(version.vocal);
    project.mastering = structuredClone(version.mastering);
    project.updatedAt = nowIso();
    return project;
  });
}

export async function recordJob(
  projectId: string,
  job: Project["jobs"][number],
) {
  return mutateDb((db) => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return null;
    const existing = project.jobs.findIndex((j) => j.id === job.id);
    if (existing >= 0) project.jobs[existing] = job;
    else project.jobs.unshift(job);
    project.jobs = project.jobs.slice(0, 40);
    project.updatedAt = nowIso();
    return job;
  });
}

export async function listExports() {
  const db = await readDb();
  return [...db.exports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addExport(record: ExportRecord) {
  return mutateDb((db) => {
    db.exports.unshift(record);
    db.exports = db.exports.slice(0, 200);
    return record;
  });
}

export async function deleteExport(id: string) {
  return mutateDb(async (db) => {
    const idx = db.exports.findIndex((e) => e.id === id);
    if (idx < 0) return false;
    const [rec] = db.exports.splice(idx, 1);
    await fs
      .unlink(path.join(EXPORT_DIR, path.basename(rec.storedName)))
      .catch(() => {});
    return true;
  });
}

export async function listVoiceProfiles() {
  const db = await readDb();
  return [...db.voiceProfiles].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addVoiceProfile(profile: VoiceProfile) {
  return mutateDb((db) => {
    db.voiceProfiles.unshift(profile);
    return profile;
  });
}

export async function deleteVoiceProfile(id: string) {
  return mutateDb((db) => {
    const idx = db.voiceProfiles.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    db.voiceProfiles.splice(idx, 1);
    return true;
  });
}

export async function getSettings() {
  const db = await readDb();
  return db.settings;
}

export async function updateSettings(patch: Partial<Database["settings"]>) {
  return mutateDb((db) => {
    db.settings = { ...db.settings, ...patch };
    return db.settings;
  });
}

export async function purgeAllData() {
  return mutateDb(async (db) => {
    db.projects = [];
    db.exports = [];
    db.voiceProfiles = [];
    await fs.rm(EXPORT_DIR, { recursive: true, force: true });
    await fs.mkdir(EXPORT_DIR, { recursive: true });
    return true;
  });
}
