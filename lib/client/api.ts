import type {
  AssetMeta,
  ExportRecord,
  GenerationJob,
  GenerationKind,
  MusicProviderId,
  Project,
  ProjectVersion,
  StudioId,
  StudioSettings,
  VoiceProfile,
} from "@/lib/types";
import type { ProviderDescriptor } from "@/lib/server/providers/types";

/** Shape of `GET /api/providers`. */
export interface ProviderCatalogue {
  providers: ProviderDescriptor[];
  summary: {
    total: number;
    configured: number;
    usableKinds: GenerationKind[];
    note: string;
  };
  spend: {
    lifetimeUsd: number;
    capUsd: number;
    allowPaidGeneration: boolean;
    remainingUsd: number;
  };
  settings: { allowPaidGeneration: boolean; spendCapUsd: number };
}

/** Result of creating or polling a generation. */
export interface GenerationOutcome {
  job: GenerationJob;
  asset: AssetMeta | null;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  projects: () => jsonFetch<{ projects: Project[] }>("/api/projects"),
  project: (id: string) => jsonFetch<{ project: Project }>(`/api/projects/${id}`),
  createProject: (body: { name: string; genre: string; bpm: number; musicalKey: string }) =>
    jsonFetch<{ project: Project }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchProject: (id: string, patch: Partial<Project>) =>
    jsonFetch<{ project: Project }>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteProject: (id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  duplicateProject: (id: string) =>
    jsonFetch<{ project: Project }>(`/api/projects/${id}/duplicate`, { method: "POST" }),
  saveVersion: (id: string, body: { note: string; studio: StudioId; label?: string }) =>
    jsonFetch<{ version: ProjectVersion }>(`/api/projects/${id}/versions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  restoreVersion: (id: string, versionId: string) =>
    jsonFetch<{ project: Project }>(`/api/projects/${id}/versions`, {
      method: "PUT",
      body: JSON.stringify({ versionId }),
    }),
  recordJob: (id: string, job: unknown) =>
    jsonFetch<{ project: Project }>(`/api/projects/${id}/jobs`, {
      method: "POST",
      body: JSON.stringify(job),
    }),
  deleteAsset: (projectId: string, assetId: string) =>
    jsonFetch<{ ok: boolean }>(`/api/assets/${assetId}?projectId=${projectId}`, {
      method: "DELETE",
    }),
  exports: () => jsonFetch<{ exports: ExportRecord[] }>("/api/exports"),
  deleteExport: (id: string) => jsonFetch<{ ok: boolean }>(`/api/exports/${id}`, { method: "DELETE" }),
  voiceProfiles: () => jsonFetch<{ voiceProfiles: VoiceProfile[] }>("/api/voice-profiles"),
  createVoiceProfile: (body: unknown) =>
    jsonFetch<{ voiceProfile: VoiceProfile }>("/api/voice-profiles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteVoiceProfile: (id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/voice-profiles/${id}`, { method: "DELETE" }),
  system: () =>
    jsonFetch<{
      version: string;
      settings: StudioSettings;
      storage: { audioBytes: number; exportBytes: number };
      providers: {
        gemini: { configured: boolean; model: string };
        voiceConversion: { configured: boolean; note: string };
        /** One entry per generation adapter; empty is fine. */
        generation?: ProviderDescriptor[];
        generationSummary?: {
          total: number;
          configured: number;
          usableKinds: GenerationKind[];
          note: string;
        };
      };
      spend?: {
        lifetimeUsd: number;
        capUsd: number;
        allowPaidGeneration: boolean;
        remainingUsd: number;
      };
      engines: Record<string, string>;
    }>("/api/system"),
  providers: () => jsonFetch<ProviderCatalogue>("/api/providers"),
  /** Start a generation. Provider failures come back as a failed job. */
  createGeneration: (body: {
    projectId: string;
    providerId: MusicProviderId;
    kind: GenerationKind;
    prompt: string;
    negativePrompt?: string;
    durationSec: number;
    seed?: number;
  }) =>
    jsonFetch<GenerationOutcome>("/api/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  /** Advance a pending job by one provider poll. */
  generation: (id: string) => jsonFetch<GenerationOutcome>(`/api/generate/${id}`),
  cancelGeneration: (id: string) =>
    jsonFetch<{ job: GenerationJob }>(`/api/generate/${id}`, { method: "DELETE" }),
  generations: (projectId?: string) =>
    jsonFetch<{ jobs: GenerationJob[] }>(
      `/api/generate${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
    ),
  updateSettings: (patch: Partial<StudioSettings>) =>
    jsonFetch<{ settings: StudioSettings }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  purge: () => jsonFetch<{ ok: boolean }>("/api/settings", { method: "DELETE" }),
  saveExport: async (blob: Blob, meta: Record<string, unknown>) => {
    const form = new FormData();
    form.append("file", blob);
    form.append("meta", JSON.stringify(meta));
    return jsonFetch<{ export: ExportRecord }>("/api/exports", { method: "POST", body: form });
  },
};

export type UploadAssetInput = {
  file: Blob;
  name: string;
  kind: string;
  role?: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  bitDepth: number | null;
  peaks: number[];
  engine?: string;
  derivedFromId?: string | null;
  createTrack?: boolean;
  trackName?: string;
};

export async function uploadAsset(
  projectId: string,
  input: UploadAssetInput,
): Promise<{ asset: AssetMeta; project: Project }> {
  const form = new FormData();
  const fileName = input.name.match(/\.[a-z0-9]+$/i) ? input.name : `${input.name}.wav`;
  form.append("file", input.file, fileName);
  form.append(
    "meta",
    JSON.stringify({
      name: fileName,
      kind: input.kind,
      role: input.role,
      durationSec: input.durationSec,
      sampleRate: input.sampleRate,
      channels: input.channels,
      bitDepth: input.bitDepth,
      peaks: input.peaks,
      engine: input.engine,
      derivedFromId: input.derivedFromId ?? null,
      trackName: input.trackName,
    }),
  );
  if (input.createTrack) form.append("createTrack", "true");

  const res = await fetch(`/api/projects/${projectId}/assets`, { method: "POST", body: form });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Upload failed (${res.status})`,
    );
  }
  return data as { asset: AssetMeta; project: Project };
}

export function assetAudioUrl(projectId: string, assetId: string, download = false) {
  return `/api/assets/${assetId}/audio?projectId=${encodeURIComponent(projectId)}${download ? "&download=1" : ""}`;
}
