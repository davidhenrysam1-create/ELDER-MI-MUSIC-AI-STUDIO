/**
 * /api/releases
 *
 * GET  published songs. `?scope=all` (Discover, default) works without an
 *      account; `?scope=following` needs one and returns only the creators that
 *      account follows; `?scope=mine` returns your own, including unlisted.
 * POST publish a finished file from one of your projects (roles: artist,
 *      producer or promoter; a handle is required first).
 */
import { currentUser, guard } from "@/lib/server/auth";
import { SocialError, discover, listOwnReleases, publishRelease } from "@/lib/server/social";
import { asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

function socialError(err: unknown) {
  if (err instanceof SocialError) return jsonError(err.message, err.status);
  return jsonError(err instanceof Error ? err.message : "Something went wrong.", 500);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scopeParam = url.searchParams.get("scope") ?? "all";
  const viewer = await currentUser();

  try {
    if (scopeParam === "mine") {
      if (!viewer) return jsonError("Sign in to see your releases.", 401);
      return Response.json({ releases: await listOwnReleases(viewer.id) });
    }
    const releases = await discover({
      viewerId: viewer?.id ?? null,
      scope: scopeParam === "following" ? "following" : "all",
      genre: url.searchParams.get("genre") ?? undefined,
      query: url.searchParams.get("q") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 40),
    });
    return Response.json({ releases, signedIn: Boolean(viewer) });
  } catch (err) {
    return socialError(err);
  }
}

export async function POST(request: Request) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  try {
    const release = await publishRelease(auth.user, {
      projectId: asString(body.projectId, "", 60),
      assetId: asString(body.assetId, "", 60),
      title: asString(body.title, "", 80),
      description: asString(body.description, "", 400),
      visibility: body.visibility === "unlisted" ? "unlisted" : "public",
      allowDownload: body.allowDownload === true,
    });
    return Response.json({ release }, { status: 201 });
  } catch (err) {
    return socialError(err);
  }
}
