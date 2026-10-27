/**
 * GET /api/share/[token]/download/[assetId]
 *
 * Download of a shared file. Refused with 403 unless the owner enabled downloads
 * for this link, and counted in the owner's share dashboard when it succeeds.
 */
import { readAudio } from "@/lib/server/storage";
import { assetResponse } from "@/lib/server/stream";
import { findShare, isUnlocked, recordDownload, sharedAsset } from "@/lib/server/shares";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string; assetId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { token, assetId } = await params;
  const share = await findShare(token);
  if (!share) return jsonError("This link is not active.", 404);
  if (!(await isUnlocked(share))) return jsonError("Passcode required.", 401);
  if (!share.allowDownload) {
    return jsonError("The owner shared this session for listening only.", 403);
  }

  const asset = await sharedAsset(share, assetId, "download");
  if (!asset) return jsonError("Audio not found", 404);

  try {
    const { data } = await readAudio(asset.id, asset.extension);
    void recordDownload(share.id);
    return assetResponse(request, data, asset, { download: true, cacheControl: "no-store" });
  } catch {
    return jsonError("Audio file is missing from storage", 410);
  }
}
