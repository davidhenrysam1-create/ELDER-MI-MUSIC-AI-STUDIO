/**
 * Replicate adapter for MusicGen (asynchronous predictions).
 *
 * Replicate runs a model in the background: `POST /v1/models/{owner}/{name}/predictions`
 * returns a prediction with a status, and the studio polls
 * `GET /v1/predictions/{id}` until it succeeds, then downloads the audio URL.
 * That URL is temporary, so the bytes are copied into the studio's own storage.
 *
 * Docs: https://replicate.com/docs/reference/http
 */
import {
  ProviderError,
  type GenerationRequest,
  type MusicProvider,
  type ProviderDescriptor,
  type ProviderStart,
  type MusicProviderId,
} from "@/lib/server/providers/types";
import { envNumber, envString, extensionFor, fetchBytes, fetchJson } from "@/lib/server/providers/http";

const ID: MusicProviderId = "replicate_musicgen";
const MAX_SECONDS = 120;

function token(): string | null {
  return envString("REPLICATE_API_TOKEN");
}

function baseUrl(): string {
  return envString("REPLICATE_BASE_URL") ?? "https://api.replicate.com/v1";
}

function modelRef(): string {
  // Model-name predictions avoid pinning a version hash, which changes often.
  return envString("REPLICATE_MUSICGEN_MODEL") ?? "meta/musicgen";
}

type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string | null;
  urls?: { get?: string; cancel?: string };
};

/** Normalise Replicate's `output` field, which may be a string or an array. */
function outputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === "string" && item.startsWith("http"));
    return typeof first === "string" ? first : null;
  }
  if (output && typeof output === "object") {
    const url = (output as { url?: unknown }).url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }
  return null;
}

/** Build the poll result from a prediction, or report that it is still running. */
async function interpret(prediction: Prediction, request: GenerationRequest): Promise<ProviderStart> {
  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new ProviderError(
      `Replicate ${prediction.status}: ${prediction.error ?? "the model did not return a reason"}`,
      { providerId: ID, status: 502, retryable: false },
    );
  }
  if (prediction.status !== "succeeded") {
    // Still running: hand the id back so the caller polls again.
    return { mode: "pending", providerJobId: prediction.id };
  }

  const url = outputUrl(prediction.output);
  if (!url) {
    throw new ProviderError("Replicate finished without an audio file.", {
      providerId: ID,
      status: 502,
    });
  }

  const { bytes, contentType } = await fetchBytes(url, {
    providerId: ID,
    timeoutMs: 120_000,
  });
  const extension = extensionFor(contentType, "mp3");

  return {
    mode: "ready",
    result: {
      audio: { bytes, mimeType: contentType, extension },
      modelId: modelRef(),
      providerJobId: prediction.id,
      costUsd: request.durationSec * envNumber("REPLICATE_MUSICGEN_USD_PER_SEC", 0.0009),
      licence:
        "Model output follows the model's own licence (MusicGen weights are CC-BY-NC 4.0 unless you run a licensed variant). Verify before commercial release.",
      note:
        extension === "mp3"
          ? "MP3 output copied into studio storage; the waveform envelope fills in after playback."
          : "Audio copied into studio storage from the temporary Replicate URL.",
    },
  };
}

export const replicateMusicgenProvider: MusicProvider = {
  descriptor(): ProviderDescriptor {
    return {
      id: ID,
      name: "MusicGen (Replicate)",
      vendor: "Replicate · Meta MusicGen",
      kinds: ["beat", "instrumental"],
      configured: Boolean(token()),
      keyEnv: ["REPLICATE_API_TOKEN"],
      model: modelRef(),
      docsUrl: "https://replicate.com/meta/musicgen",
      licence:
        "MusicGen weights are released under CC-BY-NC 4.0 (non-commercial) unless you use a licensed variant — check before releasing.",
      estimateUsdPerSecond: envNumber("REPLICATE_MUSICGEN_USD_PER_SEC", 0.0009),
      maxDurationSec: MAX_SECONDS,
      async: true,
      note: "Runs asynchronously; the studio polls the prediction and copies the audio to private storage.",
    };
  },

  async start(request: GenerationRequest): Promise<ProviderStart> {
    const apiToken = token();
    if (!apiToken) {
      throw new ProviderError("Replicate is not configured. Set REPLICATE_API_TOKEN.", {
        providerId: ID,
        status: 400,
      });
    }

    const duration = Math.min(MAX_SECONDS, Math.max(2, request.durationSec));
    const prediction = await fetchJson<Prediction>(
      `${baseUrl()}/models/${modelRef()}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Prefer: "wait=5",
        },
        body: JSON.stringify({
          input: {
            prompt: request.negativePrompt
              ? `${request.prompt}, avoid ${request.negativePrompt}`
              : request.prompt,
            duration,
            model_version: envString("REPLICATE_MUSICGEN_VERSION") ?? "stereo-large",
            output_format: "mp3",
            normalization_strategy: "peak",
            ...(typeof request.seed === "number" ? { seed: Math.round(request.seed) } : {}),
          },
        }),
        providerId: ID,
        timeoutMs: 60_000,
      },
    );

    // `Prefer: wait` often returns a finished prediction straight away.
    return interpret(prediction, request);
  },

  async poll(providerJobId: string, request: GenerationRequest): Promise<ProviderStart> {
    const apiToken = token();
    if (!apiToken) {
      throw new ProviderError("Replicate is not configured. Set REPLICATE_API_TOKEN.", {
        providerId: ID,
        status: 400,
      });
    }
    const prediction = await fetchJson<Prediction>(`${baseUrl()}/predictions/${providerJobId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      providerId: ID,
    });
    return interpret(prediction, request);
  },

  async cancel(providerJobId: string): Promise<void> {
    const apiToken = token();
    if (!apiToken) return;
    // Cancellation is best-effort: a finished prediction returns 409, which is
    // not an error for us because the job has already stopped running.
    await fetchJson<Prediction>(`${baseUrl()}/predictions/${providerJobId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
      providerId: ID,
      acceptStatus: [409],
    }).catch(() => undefined);
  },
};
