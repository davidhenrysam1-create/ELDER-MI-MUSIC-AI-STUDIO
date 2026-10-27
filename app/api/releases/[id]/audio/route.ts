/**
 * GET /api/releases/<id>/audio
 *
 * Streams the published file with Range support so listeners can seek. Public:
 * hearing a published song needs no account. A play is counted only when the
 * request is a fresh start, never on a seek.
 */
import { currentUser } from "@/lib/server/auth";
import { recordPlay, releaseAudio } from "@/lib/server/social";
import { assetResponse, isFirstFetch } from "@/lib/server/stream";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const viewer = await currentUser();
  const found = await releaseAudio(id, { intent: "stream", viewerId: viewer?.id ?? null });
  if (!found) return jsonError("Release not found.", 404);

  if (isFirstFetch(request)) {
    // Best effort: a counter must never stop the music from playing.
    await recordPlay(id).catch(() => undefined);
  }
  return assetResponse(request, found.data, found.asset, {
    cacheControl:
      found.release.visibility === "public" ? "public, max-age=3600" : "private, max-age=300",
  });
}
