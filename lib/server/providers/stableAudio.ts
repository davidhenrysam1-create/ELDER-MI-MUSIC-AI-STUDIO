/**
 * Stability AI Stable Audio adapter (text-to-audio, synchronous).
 *
 * Returns raw audio bytes in the response body, so no polling is involved.
 * The endpoint path changed between model generations; it is configurable via
 * `STABLE_AUDIO_PATH` so a new model can be adopted without a code change.
 *
 * Docs: https://platform.stability.ai/docs/api-reference#tag/audio
 */
import {
  ProviderError,
  type GenerationRequest,
  type MusicProvider,
  type ProviderDescriptor,
  type ProviderStart,
  type MusicProviderId,
} from "@/lib/server/providers/types";
import { envNumber, envString, extensionFor, fetchBytes } from "@/lib/server/providers/http";

const ID: MusicProviderId = "stable_audio";
const DEFAULT_PATH = "v2beta/audio/stable-audio-2/text-to-audio";
const MAX_SECONDS = 190;

function apiKey(): string | null {
  return envString("STABILITY_API_KEY");
}

function endpoint(): string {
  const base = envString("STABILITY_BASE_URL") ?? "https://api.stability.ai";
  const path = envString("STABLE_AUDIO_PATH") ?? DEFAULT_PATH;
  return `${base}/${path.replace(/^\/+/, "")}`;
}

export const stableAudioProvider: MusicProvider = {
  descriptor(): ProviderDescriptor {
    return {
      id: ID,
      name: "Stable Audio",
      vendor: "Stability AI",
      kinds: ["beat", "instrumental"],
      configured: Boolean(apiKey()),
      keyEnv: ["STABILITY_API_KEY"],
      // The model name shown to the producer, not a path fragment.
      model: envString("STABLE_AUDIO_MODEL") ?? "stable-audio-2",
      docsUrl: "https://platform.stability.ai/docs/api-reference#tag/audio",
      licence:
        "Stability AI terms apply; commercial use depends on your plan (Community vs. Enterprise). Generated audio is yours to use under those terms.",
      estimateUsdPerSecond: envNumber("STABLE_AUDIO_USD_PER_SEC", 0.0015),
      maxDurationSec: MAX_SECONDS,
      async: false,
      note: "Endpoint path is configurable with STABLE_AUDIO_PATH if Stability publishes a newer model.",
    };
  },

  async start(request: GenerationRequest): Promise<ProviderStart> {
    const key = apiKey();
    if (!key) {
      throw new ProviderError("Stable Audio is not configured. Set STABILITY_API_KEY.", {
        providerId: ID,
        status: 400,
      });
    }

    // Stability takes multipart form data, not JSON.
    const form = new FormData();
    form.append("prompt", request.prompt);
    form.append("duration", String(Math.min(MAX_SECONDS, Math.max(1, request.durationSec))));
    // WAV keeps the file editable without a decode step; MP3 would need lamejs
    // in Node, which this build deliberately avoids.
    form.append("output_format", "wav");
    if (request.negativePrompt) form.append("negative_prompt", request.negativePrompt);
    if (typeof request.seed === "number") form.append("seed", String(Math.round(request.seed)));

    const { bytes, contentType } = await fetchBytes(endpoint(), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, Accept: "audio/*" },
      body: form,
      providerId: ID,
      timeoutMs: 180_000,
    });

    const extension = extensionFor(contentType, "wav");
    return {
      mode: "ready",
      result: {
        audio: { bytes, mimeType: contentType, extension },
        modelId: envString("STABLE_AUDIO_MODEL") ?? "stable-audio-2",
        costUsd: request.durationSec * envNumber("STABLE_AUDIO_USD_PER_SEC", 0.0015),
        licence:
          "Generated with Stability AI Stable Audio. Commercial use follows your Stability plan terms.",
        note:
          extension === "wav"
            ? "Returned as WAV."
            : "Provider returned a compressed file; the waveform envelope will be empty until it is decoded in the browser.",
      },
    };
  },

  async poll(): Promise<ProviderStart> {
    throw new ProviderError("Stable Audio answers synchronously.", { providerId: ID, status: 400 });
  },
};
