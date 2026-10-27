/**
 * GET /api/releases/<id>/download
 *
 * Downloads a published file. Requires a signed-in account and the creator's
 * permission; the creator sees the same rules. Every successful download is
 * counted once.
 */
import { guard } from "@/lib/server/auth";
import { SocialError, recordDownload, releaseAudio } from "@/lib/server/social";
import { assetResponse } from "@/lib/server/stream";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;

  try {
    const found = await releaseAudio(id, { intent: "download", viewerId: auth.user.id });
    if (!found) return jsonError("Release not found.", 404);
    await recordDownload(id);
    // The downloaded file is named after the song, not the internal asset name.
    return assetResponse(
      request,
      found.data,
      { ...found.asset, name: `${found.release.title}.${found.asset.extension}` },
      { download: true, cacheControl: "private, no-store" },
    );
  } catch (err) {
    if (err instanceof SocialError) return jsonError(err.message, err.status);
    return jsonError("Could not prepare the download.", 500);
  }
}
