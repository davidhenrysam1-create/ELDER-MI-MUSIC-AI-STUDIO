/**
 * GET /api/share/[token]/audio/[assetId]
 *
 * Streams one audio object from a shared project. Requires a live link, and a
 * passcode cookie when the link has a passcode. Only assets that sit on the
 * project's mixer are served, so unrelated private files stay private.
 */
import { readAudio } from "@/lib/server/storage";
import { assetResponse } from "@/lib/server/stream";
import { findShare, isUnlocked, recordOpen, sharedAsset } from "@/lib/server/shares";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string; assetId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { token, assetId } = await params;
  const share = await findShare(token);
  if (!share) return jsonError("This link is not active.", 404);
  if (!(await isUnlocked(share))) return jsonError("Passcode required.", 401);

  const asset = await sharedAsset(share, assetId, "stream");
  if (!asset) return jsonError("Audio not found", 404);

  try {
    const { data } = await readAudio(asset.id, asset.extension);
    // Count the visit once per stream start; range requests are not double-counted
    // because browsers ask for the initial bytes without a Range header.
    if (!request.headers.get("range")) void recordOpen(share.id);
    return assetResponse(request, data, asset, { cacheControl: "no-store" });
  } catch {
    return jsonError("Audio file is missing from storage", 410);
  }
}
