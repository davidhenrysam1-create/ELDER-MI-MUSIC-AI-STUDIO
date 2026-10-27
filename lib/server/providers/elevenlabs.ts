/**
 * ElevenLabs Music adapter (songs and vocal hooks, synchronous).
 *
 * The endpoint returns an audio file in the response body. Length is requested
 * in milliseconds and capped to the provider's documented limits.
 *
 * Docs: https://elevenlabs.io/docs/api-reference/music
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

const ID: MusicProviderId = "elevenlabs_music";
const MAX_SECONDS = 300;

function apiKey(): string | null {
  return envString("ELEVENLABS_API_KEY");
}

function endpoint(): string {
  const base = envString("ELEVENLABS_BASE_URL") ?? "https://api.elevenlabs.io";
  return `${base}/v1/music`;
}

export const elevenLabsProvider: MusicProvider = {
  descriptor(): ProviderDescriptor {
    return {
      id: ID,
      name: "ElevenLabs Music",
      vendor: "ElevenLabs",
      kinds: ["song", "vocals"],
      configured: Boolean(apiKey()),
      keyEnv: ["ELEVENLABS_API_KEY"],
      model: envString("ELEVENLABS_MUSIC_MODEL") ?? "music_v1",
      docsUrl: "https://elevenlabs.io/docs/api-reference/music",
      licence:
        "ElevenLabs terms apply. Only generate voices you are licensed to use, and keep the consent record for any real performer.",
      estimateUsdPerSecond: envNumber("ELEVENLABS_USD_PER_SEC", 0.01),
      maxDurationSec: MAX_SECONDS,
      async: false,
      note: "Songs are returned as MP3. Vocal consent rules still apply to any cloned voice.",
    };
  },

  async start(request: GenerationRequest): Promise<ProviderStart> {
    const key = apiKey();
    if (!key) {
      throw new ProviderError("ElevenLabs Music is not configured. Set ELEVENLABS_API_KEY.", {
        providerId: ID,
        status: 400,
      });
    }

    const durationSec = Math.min(MAX_SECONDS, Math.max(3, request.durationSec));
    const modelId = envString("ELEVENLABS_MUSIC_MODEL") ?? "music_v1";

    const { bytes, contentType } = await fetchBytes(endpoint(), {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        // ElevenLabs composes from a free-text brief; the requested kind is
        // stated explicitly so a "beat" request does not come back with vocals.
        prompt:
          request.kind === "vocals"
            ? `Vocal hook only, dry and upfront: ${request.prompt}`
            : request.kind === "song"
              ? `Complete song with sung vocals: ${request.prompt}`
              : request.prompt,
        music_length_ms: Math.round(durationSec * 1000),
        model_id: modelId,
        ...(request.negativePrompt ? { negative_styles: [request.negativePrompt] } : {}),
      }),
      providerId: ID,
      timeoutMs: 240_000,
    });

    const extension = extensionFor(contentType, "mp3");
    return {
      mode: "ready",
      result: {
        audio: { bytes, mimeType: contentType, extension },
        modelId,
        costUsd: durationSec * envNumber("ELEVENLABS_USD_PER_SEC", 0.01),
        licence:
          "Generated with ElevenLabs Music. Follow the ElevenLabs terms and keep consent records for any performer whose voice is referenced.",
        note:
          extension === "mp3"
            ? "MP3 output: the browser builds the waveform envelope when you play it, so the stored peaks may be empty."
            : "Returned as WAV.",
        durationSec,
      },
    };
  },

  async poll(): Promise<ProviderStart> {
    throw new ProviderError("ElevenLabs Music answers synchronously.", {
      providerId: ID,
      status: 400,
    });
  },
};
