import type {
  AccountRole,
  AssetMeta,
  ExportRecord,
  GenerationJob,
  GenerationKind,
  MusicProviderId,
  ProfileLinks,
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

/** Error carrying the HTTP status, so callers can react to 401/403/402. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
    throw new ApiError(message, res.status);
  }
  return data as T;
}

/* ------------------------------------------------------------------ */
/* Account types                                                       */
/* ------------------------------------------------------------------ */

/** The signed-in account as the API exposes it (never includes a hash). */
export interface AccountUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "member";
  /** Artist / producer / engineer / promoter; empty until chosen on /welcome. */
  roles?: AccountRole[];
  handle?: string | null;
  bio?: string;
  links?: ProfileLinks;
  /** True only for the address in ADMIN_EMAIL. */
  isAdmin?: boolean;
  emailVerified?: boolean;
  // "bootstrap" is legacy: an account created by the old one-time code.
  provider?: "password" | "google" | "bootstrap";
  /** True while the admin still uses the setup password from ADMIN_PASSWORD. */
  passwordSeeded?: boolean;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface SessionSummary {
  id: string;
  device: string;
  createdAt: string;
  expiresAt: string;
}

export interface MeResponse {
  user: AccountUser | null;
  sessions: SessionSummary[];
  signupOpen: boolean;
  allowSignupEnv: boolean;
  /** True when the app runs as one open studio, with no sign-in screen. */
  openStudio?: boolean;
  /** Whether Google OAuth has credentials, with the reason when it does not. */
  google?: { configured: boolean; reason: string };
  adminSignIn?: {
    /** Masked, e.g. `d****@gmail.com` — the raw address is never published. */
    adminEmailMasked: string | null;
    adminExists: boolean;
    googleConfigured: boolean;
    /** True when ADMIN_PASSWORD is set, so the admin can use the form above. */
    passwordConfigured?: boolean;
  };
  email?: { configured: boolean; from: string | null; reason: string };
}

/** One row of the admin console. */
export interface AdminUserRow {
  user: AccountUser;
  stats: { userId: string; projects: number; assets: number; bytes: number; shares: number };
}

/** A creator's public facts, as shown on `/u/<handle>`. */
export interface CreatorSummary {
  id: string;
  name: string;
  handle: string | null;
  roles: AccountRole[];
  isAdmin: boolean;
}

/** One published song, hydrated for the UI. */
export interface ReleaseCard {
  id: string;
  title: string;
  description: string;
  genre: string;
  bpm: number;
  musicalKey: string;
  allowDownload: boolean;
  visibility: "public" | "unlisted";
  plays: number;
  downloads: number;
  likeCount: number;
  likedByViewer: boolean;
  followingCreator: boolean;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
  creator: CreatorSummary;
  audioUrl: string;
  durationSec: number;
}

/** `/api/profile/<handle>` response. */
export interface CreatorPageData {
  profile: CreatorSummary & {
    bio: string;
    links: Record<string, string>;
    joinedAt: string;
  };
  releases: ReleaseCard[];
  followers: number;
  following: number;
  followingViewer: boolean;
  /** Whether the visitor has an account; needs one to like, follow or download. */
  signedIn: boolean;
}

export interface AdminOverview {
  users: AccountUser[];
  stats: { userId: string; projects: number; assets: number; bytes: number; shares: number }[];
  totals: {
    users: number;
    admins: number;
    suspended: number;
    verified: number;
    projects: number;
    storage: { audioBytes: number; exportBytes: number };
  };
}

/** Owner-facing view of a share link (no token, no passcode). */
export interface ShareSummary {
  id: string;
  projectId: string;
  projectName: string;
  ownerId: string;
  label: string;
  allowDownload: boolean;
  requiresPasscode: boolean;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  opens: number;
  downloads: number;
  lastOpenedAt: string | null;
  expired: boolean;
  active: boolean;
}

export const api = {
  /* ---------------- accounts ---------------- */
  me: () => jsonFetch<MeResponse>("/api/auth/me"),
  /** Where the bytes live, plus a live (read-only) Supabase connection test. */
  storage: () =>
    jsonFetch<{
      drivers: {
        warning: string | null;
        blobs: { kind: "local" | "supabase"; label: string; durable: boolean; reason: string };
        database: { kind: "local" | "supabase"; label: string; durable: boolean; reason: string };
      };
      connection: {
        configured: boolean;
        ok: boolean;
        checks: { name: string; ok: boolean; detail: string }[];
      };
    }>("/api/storage"),
  /** Copy this machine's audio and database to the configured remote store. */
  migrateStorage: (confirm: boolean) =>
    jsonFetch<{
      dryRun: boolean;
      blocked: string | null;
      files: { key: string; bytes: number; ok: boolean; error?: string }[];
      totalBytes: number;
      database: { copied: boolean; detail: string };
    }>("/api/storage", {
      method: "POST",
      body: JSON.stringify({ action: "migrate", confirm }),
    }),
  signup: (body: { name: string; email: string; password: string }) =>
    jsonFetch<{ user: AccountUser }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    jsonFetch<{ user: AccountUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => jsonFetch<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  /** Google sign-in needs a full navigation, so this is a URL, not a fetch. */
  googleSignInUrl: "/api/auth/google/start",
  onboarding: (body: { roles: AccountRole[]; handle?: string }) =>
    jsonFetch<{ user: AccountUser }>("/api/auth/onboarding", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  /** Start a password reset. Always answers generically (no account leak). */
  forgotPassword: (email: string) =>
    jsonFetch<{
      ok: true;
      sent: boolean;
      emailConfigured: boolean;
      message: string;
      reason?: string;
      hint?: string;
      expiresAt?: string;
    }>("/api/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) }),
  /** Finish a reset with the token from the email plus the new password. */
  resetPassword: (body: { token: string; password: string }) =>
    jsonFetch<{ ok: true; email: string; signedOut: boolean }>("/api/auth/password/reset", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  sendVerification: () =>
    jsonFetch<{ sent: boolean; reason?: string; hint?: string; expiresAt?: string }>(
      "/api/auth/verify/send",
      { method: "POST" },
    ),
  adminOverview: () => jsonFetch<AdminOverview>("/api/admin/users"),
  adminUpdateUser: (
    id: string,
    patch: {
      roles?: AccountRole[];
      suspended?: boolean;
      suspendedReason?: string;
      emailVerified?: boolean;
      name?: string;
    },
  ) =>
    jsonFetch<{ user: AccountUser }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  adminDeleteUser: (id: string) =>
    jsonFetch<{ ok: true }>(`/api/admin/users/${id}`, { method: "DELETE" }),
  updateMe: (body: {
    name?: string;
    handle?: string | null;
    bio?: string;
    links?: Partial<ProfileLinks>;
    roles?: AccountRole[];
  }) =>
    jsonFetch<{ user: AccountUser }>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    jsonFetch<{ ok: true; signedOut: boolean }>("/api/auth/password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteAccount: (body: { password: string }) =>
    jsonFetch<{ ok: true }>("/api/auth/me", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),

  /* ---------------- publishing, likes and follows ---------------- */
  releases: (options: { scope?: "all" | "following" | "mine"; genre?: string; q?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.scope) params.set("scope", options.scope);
    if (options.genre) params.set("genre", options.genre);
    if (options.q) params.set("q", options.q);
    if (options.limit) params.set("limit", String(options.limit));
    const query = params.toString();
    return jsonFetch<{ releases: ReleaseCard[]; signedIn?: boolean }>(
      `/api/releases${query ? `?${query}` : ""}`,
    );
  },
  publishRelease: (body: {
    projectId: string;
    assetId: string;
    title: string;
    description?: string;
    visibility?: "public" | "unlisted";
    allowDownload?: boolean;
  }) =>
    jsonFetch<{ release: ReleaseCard }>("/api/releases", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRelease: (
    id: string,
    patch: {
      title?: string;
      description?: string;
      visibility?: "public" | "unlisted";
      allowDownload?: boolean;
    },
  ) =>
    jsonFetch<{ release: ReleaseCard }>(`/api/releases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  unpublishRelease: (id: string) =>
    jsonFetch<{ ok: true }>(`/api/releases/${id}`, { method: "DELETE" }),
  likeRelease: (id: string) =>
    jsonFetch<{ liked: boolean; likeCount: number }>(`/api/releases/${id}/like`, {
      method: "POST",
    }),
  followCreator: (handle: string) =>
    jsonFetch<{ following: boolean; followers: number }>(
      `/api/creators/${encodeURIComponent(handle)}/follow`,
      { method: "POST" },
    ),
  creatorPage: (handle: string) =>
    jsonFetch<CreatorPageData>(`/api/profile/${encodeURIComponent(handle)}`),
  downloadUrl: (releaseId: string) => `/api/releases/${releaseId}/download`,

  /* ---------------- sharing ---------------- */
  shares: () => jsonFetch<{ shares: ShareSummary[] }>("/api/shares"),
  createShare: (body: {
    projectId: string;
    label?: string;
    allowDownload?: boolean;
    expiresInDays?: number | null;
    passcode?: string | null;
  }) =>
    jsonFetch<{ share: ShareSummary; token: string; path: string }>("/api/shares", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revokeShare: (id: string) =>
    jsonFetch<{ ok: true }>(`/api/shares/${id}`, { method: "DELETE" }),
  unlockShare: (token: string, passcode: string) =>
    jsonFetch<{ ok: true }>(`/api/share/${token}/unlock`, {
      method: "POST",
      body: JSON.stringify({ passcode }),
    }),

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
      /** The signed-in account, echoed by the server so the shell can greet it. */
      user?: AccountUser;
      settings: StudioSettings;
      storage: { audioBytes: number; exportBytes: number };
      /**
       * Where the bytes physically live: this machine's disk, or Supabase.
       * Settings shows it verbatim so durability is never implied.
       */
      storageDrivers?: {
        durable: boolean;
        /** Set when a requested driver could not start (missing credentials). */
        warning?: string | null;
        /** Live degradation: Supabase configured but unreachable from here. */
        runtime?: {
          degraded: boolean;
          message: string | null;
          failures: { scope: "blobs" | "database"; message: string; at: string }[];
        };
        blobs: {
          kind: "local" | "supabase";
          label: string;
          durable: boolean;
          reason: string;
          warning?: string | null;
        };
        database: {
          kind: "local" | "supabase";
          label: string;
          durable: boolean;
          reason: string;
          warning?: string | null;
        };
      };
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
