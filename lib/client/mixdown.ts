"use client";

import { loadAssetBuffer } from "@/lib/client/audio";
import {
  renderMix,
  type MixRenderResult,
  type RenderTrackInput,
} from "@/lib/audio/render";
import type { Project, Track } from "@/lib/types";

export interface PreparedTracks {
  inputs: RenderTrackInput[];
  skipped: { name: string; reason: string }[];
  sampleRate: number;
}

/**
 * Load every audible track's audio and build the render graph inputs.
 * Tracks with missing audio are reported rather than silently dropped.
 */
export async function prepareTracks(
  project: Project,
  tracks: Track[],
  preferredRate = 48000,
  onProgress?: (pct: number, message: string) => void,
): Promise<PreparedTracks> {
  const usable = tracks.filter((t) => t.assetId);
  const skipped: { name: string; reason: string }[] = tracks
    .filter((t) => !t.assetId)
    .map((t) => ({ name: t.name, reason: "no audio assigned" }));

  const inputs: RenderTrackInput[] = [];
  let rate = preferredRate;
  let loaded = 0;

  for (const track of usable) {
    try {
      const buffer = await loadAssetBuffer(project.id, track.assetId!);
      rate = buffer.sampleRate;
      const group = project.mix.groups?.find((g) => g.id === track.groupId);
      inputs.push({
        buffer,
        role: track.role,
        name: track.name,
        volumeDb: track.volumeDb + (group?.gainDb ?? 0),
        pan: track.pan,
        muted: track.muted || Boolean(group?.muted),
        soloed: track.soloed,
        eqLowDb: track.eqLowDb,
        eqMidDb: track.eqMidDb,
        eqHighDb: track.eqHighDb,
        compThresholdDb: track.compThresholdDb,
        compRatio: track.compRatio,
        reverbSend: track.reverbSend,
        delaySend: track.delaySend,
        width: track.width,
      });
    } catch (err) {
      skipped.push({ name: track.name, reason: (err as Error).message });
    }
    loaded++;
    onProgress?.(
      Math.round((loaded / Math.max(1, usable.length)) * 40),
      `Loading ${track.name}`,
    );
  }

  return { inputs, skipped, sampleRate: rate };
}

export async function renderTrackSubset(
  project: Project,
  tracks: Track[],
  options: {
    sampleRate?: number;
    ceilingDb?: number;
    outputGainDb?: number;
    onProgress?: (pct: number, message: string) => void;
  } = {},
): Promise<MixRenderResult & { skipped: { name: string; reason: string }[] }> {
  const prepared = await prepareTracks(
    project,
    tracks,
    options.sampleRate ?? 48000,
    (pct, msg) => options.onProgress?.(pct * 0.5, msg),
  );
  if (!prepared.inputs.length) {
    throw new Error(
      prepared.skipped.length
        ? `No playable audio: ${prepared.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}`
        : "There are no audio tracks to render yet. Import audio or generate a layer first.",
    );
  }
  const rendered = await renderMix(prepared.inputs, prepared.sampleRate, {
    ceilingDb: options.ceilingDb ?? -1,
    outputGainDb: options.outputGainDb ?? 0,
    onProgress: (pct, msg) => options.onProgress?.(50 + pct * 0.5, msg),
  });
  return { ...rendered, skipped: prepared.skipped };
}
