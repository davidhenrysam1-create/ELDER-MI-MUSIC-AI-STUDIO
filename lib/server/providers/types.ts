/**
 * Provider contracts for third-party music generation.
 *
 * The studio ships with local DSP for vocal layering and a real mastering
 * chain, but *generating* new music (a beat, a sung hook) is something only a
 * hosted model can do. Rather than simulate it, every provider is behind this
 * one interface so the UI can show, honestly, whether a provider is usable.
 *
 * Design rules:
 *  - A provider never invents success. If a key is missing or a call fails, the
 *    adapter throws a `ProviderError` with the vendor's own message.
 *  - Two execution shapes exist: `ready` (audio returned in the same response,
 *    e.g. ElevenLabs) and `pending` (an operation id to poll, e.g. Replicate and
 *    Vertex long-running jobs).
 *  - Costs are *estimates* from a configurable table; the actual invoice is the
 *    vendor's. They are tracked so a spend cap can refuse new jobs.
 */

import type { GenerationKind, MusicProviderId } from "@/lib/types";

// The domain types live in `lib/types.ts` so the browser can label generated
// assets without importing anything server-side; they are re-exported here for
// the adapters' convenience.
export type { GenerationKind, MusicProviderId };
export { GENERATION_KIND_LABEL, GENERATION_KIND_NOTE } from "@/lib/types";

/** Per-provider public information (safe to send to the browser). */
export interface ProviderDescriptor {
  /** Stable id used by the API and stored on the generated asset. */
  id: MusicProviderId;
  /** Human name, e.g. "Google Lyria 2". */
  name: string;
  /** Vendor, e.g. "Google Cloud Vertex AI". */
  vendor: string;
  /** Kinds this provider can produce. */
  kinds: GenerationKind[];
  /** True only when the required environment variables are present. */
  configured: boolean;
  /** Environment variable(s) that must be set, e.g. ["GOOGLE_API_KEY"]. */
  keyEnv: string[];
  /** Model identifier sent to the vendor. */
  model: string;
  /** Where to read the vendor's own documentation. */
  docsUrl: string;
  /** Licensing summary shown next to the prompt box. */
  licence: string;
  /** Rough cost per second of generated audio, in USD. */
  estimateUsdPerSecond: number;
  /** Maximum audio length this adapter will request. */
  maxDurationSec: number;
  /** True when the provider returns an operation to poll. */
  async: boolean;
  /** Extra guidance shown in the UI (rate limits, endpoint overrides, …). */
  note: string;
}

/** A validated generation request (see `lib/server/generation.ts`). */
export interface GenerationRequest {
  kind: GenerationKind;
  /** Producer's description of the music. */
  prompt: string;
  /** Optional "avoid this" text; ignored by providers that do not support it. */
  negativePrompt?: string;
  /** Requested length in seconds. */
  durationSec: number;
  /** Optional deterministic seed where the provider supports it. */
  seed?: number;
}

/** Encoded audio returned by a provider. */
export interface ProviderAudio {
  bytes: Uint8Array;
  mimeType: string;
  extension: "wav" | "mp3";
}

/** A finished provider result. */
export interface ProviderResult {
  audio: ProviderAudio;
  /** Exact model/version string used, stored for provenance. */
  modelId: string;
  /** Vendor-side operation id, kept for support and debugging. */
  providerJobId?: string;
  /** Estimated cost charged to the studio's spend tracker. */
  costUsd: number;
  /** Licence text shown with the asset. */
  licence: string;
  /** Non-fatal remarks, e.g. "provider returned 44.1 kHz audio". */
  note?: string;
  /** Duration reported by the provider, when it differs from the request. */
  durationSec?: number;
}

/** Either finished audio or an operation that still needs polling. */
export type ProviderStart =
  | { mode: "ready"; result: ProviderResult }
  | { mode: "pending"; providerJobId: string; note?: string };

/** The contract every adapter implements. */
export interface MusicProvider {
  /** Public description, recalculated on each call so env changes are picked up. */
  descriptor(): ProviderDescriptor;
  /** Begin a generation. Throws `ProviderError` on immediate failure. */
  start(request: GenerationRequest): Promise<ProviderStart>;
  /** Poll a pending operation created by `start`. */
  poll(providerJobId: string, request: GenerationRequest): Promise<ProviderStart>;
  /** Best-effort cancellation of a pending operation. */
  cancel?(providerJobId: string): Promise<void>;
}

/**
 * Error raised by provider adapters.
 *
 * `status` mirrors the vendor's HTTP status when there is one, and `retryable`
 * tells the orchestrator whether the job may be polled again.
 */
export class ProviderError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly providerId: MusicProviderId | null;

  constructor(
    message: string,
    options: { status?: number; retryable?: boolean; providerId?: MusicProviderId } = {},
  ) {
    super(message);
    this.name = "ProviderError";
    this.status = options.status ?? 502;
    this.retryable = options.retryable ?? false;
    this.providerId = options.providerId ?? null;
  }
}
