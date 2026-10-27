"use client";

import { assetAudioUrl } from "@/lib/client/api";
import { extractPeaks } from "@/lib/audio/peaks";
import { readWavInfo } from "@/lib/audio/wav";
import type { AssetMeta } from "@/lib/types";

let decodeContext: AudioContext | null = null;

export function getAudioContext() {
  if (typeof window === "undefined") throw new Error("AudioContext is browser-only");
  if (!decodeContext) {
    decodeContext = new AudioContext({ sampleRate: 48000 });
  }
  return decodeContext;
}

/** Decode any browser-supported audio file into PCM channels. */
export async function decodeFile(file: Blob): Promise<{
  buffer: AudioBuffer;
  channels: Float32Array[];
  peaks: number[];
  wavInfo: ReturnType<typeof readWavInfo>;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const wavInfo = readWavInfo(new Uint8Array(arrayBuffer.slice(0, 512)));
  const ctx = getAudioContext();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  return { buffer, channels, peaks: extractPeaks(channels), wavInfo };
}

const bufferCache = new Map<string, AudioBuffer>();

export function cacheBuffer(assetId: string, buffer: AudioBuffer) {
  bufferCache.set(assetId, buffer);
}

export function getCachedBuffer(assetId: string) {
  return bufferCache.get(assetId) ?? null;
}

/** Fetch + decode an asset from the studio API (cached per session). */
export async function loadAssetBuffer(
  projectId: string,
  assetId: string,
): Promise<AudioBuffer> {
  const cached = bufferCache.get(assetId);
  if (cached) return cached;
  const res = await fetch(assetAudioUrl(projectId, assetId));
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Could not load audio (${res.status})`);
  }
  const bytes = await res.arrayBuffer();
  const ctx = getAudioContext();
  const buffer = await ctx.decodeAudioData(bytes);
  bufferCache.set(assetId, buffer);
  return buffer;
}

export function assetChannels(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
}

export function assetBuffersToChannels(buffer: AudioBuffer): Float32Array[] {
  const out: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.push(Float32Array.from(buffer.getChannelData(c)));
  }
  return out;
}

export function assetMetaFromBuffer(buffer: AudioBuffer, peaks: number[]): Pick<
  AssetMeta,
  "durationSec" | "sampleRate" | "channels" | "peaks"
> {
  return {
    durationSec: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    peaks,
  };
}

export function blobToWavInfo(bytes: Uint8Array) {
  return readWavInfo(bytes);
}
