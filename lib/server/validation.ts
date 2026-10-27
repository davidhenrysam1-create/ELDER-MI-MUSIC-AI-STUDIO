import type { AssetKind, StemRole } from "@/lib/types";
import { STEM_ROLE_LABEL } from "@/lib/types";

export const KINDS: AssetKind[] = ["source", "stem", "vocal", "mix", "master", "reference"];

export function asNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function asString(value: unknown, fallback = "", max = 400) {
  if (typeof value !== "string") return fallback;
  return value.slice(0, max);
}

export function asRole(value: unknown): StemRole {
  if (typeof value === "string" && value in STEM_ROLE_LABEL) return value as StemRole;
  return "other";
}

export function asKind(value: unknown): AssetKind {
  if (typeof value === "string" && (KINDS as string[]).includes(value)) return value as AssetKind;
  return "source";
}

export function sanitizePeaks(peaks: unknown): number[] {
  if (!Array.isArray(peaks)) return [];
  return peaks
    .slice(0, 2000)
    .map((p) => asNumber(p, 0, 0, 1))
    .filter((p) => Number.isFinite(p));
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
