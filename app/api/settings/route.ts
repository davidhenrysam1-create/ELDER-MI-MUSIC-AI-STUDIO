import { guard } from "@/lib/server/auth";
import { getSettings, purgeAllData, updateSettings } from "@/lib/server/repo";
import { storageUsage } from "@/lib/server/db";
import { asNumber, asString, jsonError } from "@/lib/server/validation";
import type { StudioSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guard();
  if (auth.response) return auth.response;
  return Response.json({
    settings: await getSettings(),
    storage: await storageUsage(),
  });
}

export async function PATCH(request: Request) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");
  const patch: Partial<StudioSettings> = {};
  if (typeof body.defaultExportFormat === "string") {
    const f = asString(body.defaultExportFormat, "wav24");
    if (!["wav24", "wav16", "mp3_320"].includes(f)) return jsonError("Unknown export format");
    patch.defaultExportFormat = f as StudioSettings["defaultExportFormat"];
  }
  if (typeof body.autoSave === "boolean") patch.autoSave = body.autoSave;
  // Paid generation is a two-part control: the switch plus a hard ceiling.
  if (typeof body.allowPaidGeneration === "boolean") {
    patch.allowPaidGeneration = body.allowPaidGeneration;
  }
  if (body.spendCapUsd != null) {
    patch.spendCapUsd = Math.round(asNumber(body.spendCapUsd, 5, 0, 500) * 100) / 100;
  }
  if (typeof body.dither16Bit === "boolean") patch.dither16Bit = body.dither16Bit;
  if (typeof body.processingQuality === "string") {
    const q = asString(body.processingQuality, "balanced");
    if (!["fast", "balanced", "high"].includes(q)) return jsonError("Unknown quality level");
    patch.processingQuality = q as StudioSettings["processingQuality"];
  }
  if (body.maxUploadMb != null) patch.maxUploadMb = Math.round(asNumber(body.maxUploadMb, 80, 5, 500));
  const settings = await updateSettings(patch);
  return Response.json({ settings });
}

/**
 * Data deletion control: wipes the signed-in account's projects, audio,
 * exports, voice profiles and share links. Other accounts are untouched.
 */
export async function DELETE() {
  const auth = await guard();
  if (auth.response) return auth.response;
  await purgeAllData(auth.user.id);
  return Response.json({ ok: true });
}
