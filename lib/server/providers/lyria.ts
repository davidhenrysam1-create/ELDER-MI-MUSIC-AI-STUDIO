/**
 * Google Lyria 2 adapter (Vertex AI, synchronous `:predict`).
 *
 * Lyria generates instrumental music from a text prompt. Vertex AI requires a
 * Google Cloud project; authentication is either an API key (Vertex "express
 * mode") or an OAuth access token from a service account. Both are read from
 * the server environment only — the browser never sees them.
 *
 * Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music
 */
import {
  ProviderError,
  type GenerationRequest,
  type MusicProvider,
  type ProviderDescriptor,
  type ProviderStart,
  type MusicProviderId,
} from "@/lib/server/providers/types";
import { envNumber, envString, fetchJson } from "@/lib/server/providers/http";

const ID: MusicProviderId = "lyria";

/** Base URL differs by region, so it is derived from the configured location. */
function endpoint(): { url: string; location: string; project: string; model: string } {
  const location = envString("GOOGLE_VERTEX_LOCATION") ?? "us-central1";
  const project = envString("GOOGLE_VERTEX_PROJECT") ?? "";
  const model = envString("LYRIA_MODEL") ?? "lyria-002";
  const base =
    envString("GOOGLE_VERTEX_BASE_URL") ??
    `https://${location}-aiplatform.googleapis.com`;
  return {
    url: `${base}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`,
    location,
    project,
    model,
  };
}

/** Lyria is usable only with credentials *and* a project id. */
function configured(): boolean {
  const hasCredential = Boolean(
    envString("GOOGLE_API_KEY") ?? envString("GOOGLE_VERTEX_ACCESS_TOKEN"),
  );
  return hasCredential && Boolean(envString("GOOGLE_VERTEX_PROJECT"));
}

function authHeaders(): Record<string, string> {
  const token = envString("GOOGLE_VERTEX_ACCESS_TOKEN");
  if (token) return { Authorization: `Bearer ${token}` };
  const key = envString("GOOGLE_API_KEY");
  if (key) return { "x-goog-api-key": key };
  throw new ProviderError(
    "Lyria needs GOOGLE_API_KEY or GOOGLE_VERTEX_ACCESS_TOKEN plus GOOGLE_VERTEX_PROJECT.",
    { providerId: ID, status: 400 },
  );
}

/** Lyria clips are short; the adapter caps requests rather than letting the API fail. */
const MAX_SECONDS = 30;

export const lyriaProvider: MusicProvider = {
  descriptor(): ProviderDescriptor {
    const { model, project, location } = endpoint();
    return {
      id: ID,
      name: "Google Lyria 2",
      vendor: "Google Cloud Vertex AI",
      kinds: ["beat", "instrumental"],
      configured: configured(),
      keyEnv: ["GOOGLE_API_KEY", "GOOGLE_VERTEX_PROJECT"],
      model,
      docsUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music",
      licence:
        "Governed by the Google Cloud/Vertex AI terms for generative music. Check the terms for your region before releasing generated audio commercially.",
      estimateUsdPerSecond: envNumber("LYRIA_USD_PER_SEC", 0.002),
      maxDurationSec: MAX_SECONDS,
      async: false,
      note: project
        ? `Vertex AI project ${project} · ${location}`
        : "Set GOOGLE_VERTEX_PROJECT as well as the API key.",
    };
  },

  async start(request: GenerationRequest): Promise<ProviderStart> {
    if (!configured()) {
      throw new ProviderError(
        "Lyria is not configured. Set GOOGLE_API_KEY (or GOOGLE_VERTEX_ACCESS_TOKEN) and GOOGLE_VERTEX_PROJECT.",
        { providerId: ID, status: 400 },
      );
    }
    if (request.durationSec > MAX_SECONDS) {
      throw new ProviderError(
        `Lyria 2 generates up to ${MAX_SECONDS}s per request (asked for ${Math.round(request.durationSec)}s).`,
        { providerId: ID, status: 400 },
      );
    }

    const { url, model } = endpoint();
    const body = {
      instances: [
        {
          // The provider has no separate negative prompt; the instruction is
          // folded into the prompt so the producer's intent is not silently lost.
          prompt: request.negativePrompt
            ? `${request.prompt}. Avoid: ${request.negativePrompt}.`
            : request.prompt,
        },
      ],
      parameters: {},
    };

    const response = await fetchJson<{
      predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
    }>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
      providerId: ID,
      timeoutMs: 120_000,
    });

    const prediction = response.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      throw new ProviderError("Lyria returned no audio for that prompt.", {
        providerId: ID,
        retryable: true,
      });
    }

    const bytes = new Uint8Array(Buffer.from(prediction.bytesBase64Encoded, "base64"));
    return {
      mode: "ready",
      result: {
        audio: { bytes, mimeType: prediction.mimeType ?? "audio/wav", extension: "wav" },
        modelId: model,
        costUsd: request.durationSec * envNumber("LYRIA_USD_PER_SEC", 0.002),
        licence:
          "Generated with Google Lyria on Vertex AI. Review the Google Cloud generative AI terms before commercial release.",
        note: "Returned as WAV; the exact clip length is reported from the file header.",
      },
    };
  },

  // Lyria answers synchronously, so polling is never needed.
  async poll(): Promise<ProviderStart> {
    throw new ProviderError("Lyria does not use async jobs.", { providerId: ID, status: 400 });
  },
};
