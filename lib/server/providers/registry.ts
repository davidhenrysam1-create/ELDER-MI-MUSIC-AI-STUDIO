/**
 * Provider registry.
 *
 * One place that knows which adapters exist, whether each is configured, and
 * which of them can satisfy a given generation kind. The UI and the API both
 * read from here, so a provider can never appear "available" in one place and
 * fail silently in another.
 */
import {
  ProviderError,
  type GenerationKind,
  type MusicProvider,
  type MusicProviderId,
  type ProviderDescriptor,
} from "@/lib/server/providers/types";
import { lyriaProvider } from "@/lib/server/providers/lyria";
import { stableAudioProvider } from "@/lib/server/providers/stableAudio";
import { elevenLabsProvider } from "@/lib/server/providers/elevenlabs";
import { replicateMusicgenProvider } from "@/lib/server/providers/replicate";

/** Every adapter this build ships. Order is the order shown in the UI. */
export const PROVIDERS: MusicProvider[] = [
  lyriaProvider,
  stableAudioProvider,
  elevenLabsProvider,
  replicateMusicgenProvider,
];

/** Look up an adapter by id. Throws a 400 `ProviderError` for unknown ids. */
export function getProvider(id: string): MusicProvider {
  const provider = PROVIDERS.find((entry) => entry.descriptor().id === id);
  if (!provider) {
    throw new ProviderError(`Unknown provider "${id}".`, { status: 400 });
  }
  return provider;
}

/** Public descriptors for every adapter (safe to serialise to the browser). */
export function listDescriptors(): ProviderDescriptor[] {
  return PROVIDERS.map((provider) => provider.descriptor());
}

/** Descriptors that can produce the requested kind of audio. */
export function descriptorsForKind(kind: GenerationKind): ProviderDescriptor[] {
  return listDescriptors().filter((descriptor) => descriptor.kinds.includes(kind));
}

/** A short, honest summary of what is and is not usable right now. */
export function providerSummary() {
  const descriptors = listDescriptors();
  const configured = descriptors.filter((descriptor) => descriptor.configured);
  return {
    total: descriptors.length,
    configured: configured.length,
    /** Providers with a key present, grouped by capability. */
    usableKinds: Array.from(
      new Set(configured.flatMap((descriptor) => descriptor.kinds)),
    ) as GenerationKind[],
    note:
      configured.length === 0
        ? "No music-generation provider is configured. Add a key in .env.local to enable beat, song and vocal generation."
        : `${configured.length} of ${descriptors.length} providers configured.`,
  };
}

/** Round a cost estimate to cents so the UI never shows false precision. */
export function estimateCost(descriptor: ProviderDescriptor, durationSec: number): number {
  const raw = descriptor.estimateUsdPerSecond * Math.max(0, durationSec);
  return Math.round(raw * 100) / 100;
}

/** Type guard used when validating untrusted request bodies. */
export function isProviderId(value: unknown): value is MusicProviderId {
  return typeof value === "string" && PROVIDERS.some((p) => p.descriptor().id === value);
}
