/**
 * Small HTTP helpers shared by the provider adapters.
 *
 * Every call is bounded by a timeout so a hung vendor cannot pin a route
 * handler open, and every error message keeps the vendor's own wording — that
 * is what the producer sees in the job status instead of a generic failure.
 */
import { ProviderError, type MusicProviderId } from "@/lib/server/providers/types";

const DEFAULT_TIMEOUT_MS = 60_000;

type FetchOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: BodyInit;
  timeoutMs?: number;
  providerId: MusicProviderId;
  /** Treat these statuses as success even though they are not 2xx. */
  acceptStatus?: number[];
};

/** Read an error body without assuming it is JSON. */
async function describeError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return `${response.status} ${response.statusText}`;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const detail =
      (parsed.error as { message?: string } | string | undefined) ??
      parsed.message ??
      parsed.detail ??
      (parsed.errors as unknown);
    if (typeof detail === "string") return `${response.status}: ${detail}`;
    if (detail && typeof detail === "object") {
      const message = (detail as { message?: string }).message;
      if (message) return `${response.status}: ${message}`;
    }
    return `${response.status}: ${text.slice(0, 240)}`;
  } catch {
    return `${response.status}: ${text.slice(0, 240)}`;
  }
}

/** Shared fetch wrapper with timeout + typed errors. */
async function call(url: string, options: FetchOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
      cache: "no-store",
    });
    const accepted = options.acceptStatus ?? [];
    if (!response.ok && !accepted.includes(response.status)) {
      const detail = await describeError(response);
      // 429 and 5xx are worth retrying; 4xx (bad key, bad prompt) are not.
      const retryable = response.status === 429 || response.status >= 500;
      throw new ProviderError(`[${options.providerId}] ${detail}`, {
        status: response.status === 429 ? 429 : 502,
        retryable,
        providerId: options.providerId,
      });
    }
    return response;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    const aborted = message.toLowerCase().includes("abort");
    throw new ProviderError(
      `[${options.providerId}] ${aborted ? "the provider did not answer in time" : message}`,
      { status: aborted ? 504 : 502, retryable: true, providerId: options.providerId },
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Perform a request and parse the JSON body. */
export async function fetchJson<T>(url: string, options: FetchOptions): Promise<T> {
  const response = await call(url, options);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ProviderError(`[${options.providerId}] the provider returned invalid JSON`, {
      retryable: true,
      providerId: options.providerId,
    });
  }
}

/** Perform a request and return the raw bytes (used for direct audio responses). */
export async function fetchBytes(
  url: string,
  options: FetchOptions,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await call(url, options);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new ProviderError(`[${options.providerId}] the provider returned an empty file`, {
      retryable: true,
      providerId: options.providerId,
    });
  }
  return {
    bytes: new Uint8Array(buffer),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

/** Pick an audio extension from a MIME type, defaulting to the requested one. */
export function extensionFor(contentType: string, fallback: "wav" | "mp3"): "wav" | "mp3" {
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  return fallback;
}

/** Read a numeric environment variable, falling back when unset or invalid. */
export function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Read a trimmed environment variable, or null when empty. */
export function envString(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}
