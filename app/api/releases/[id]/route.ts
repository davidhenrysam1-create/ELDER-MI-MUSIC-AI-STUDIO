/**
 * /api/releases/<id>
 *
 * GET    one release (public; unlisted songs stay hidden from other listeners)
 * PATCH  edit title, description, visibility or downloads — owner only
 * DELETE unpublish, leaving the project and its audio untouched
 */
import { currentUser, guard } from "@/lib/server/auth";
import {
  SocialError,
  releaseCard,
  unpublishRelease,
  updateRelease,
} from "@/lib/server/social";
import { asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function socialError(err: unknown) {
  if (err instanceof SocialError) return jsonError(err.message, err.status);
  return jsonError(err instanceof Error ? err.message : "Something went wrong.", 500);
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const viewer = await currentUser();
  const release = await releaseCard(id, viewer?.id ?? null);
  if (!release) return jsonError("Release not found.", 404);
  return Response.json({ release });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  try {
    const release = await updateRelease(auth.user.id, id, {
      title: body.title === undefined ? undefined : asString(body.title, "", 80),
      description: body.description === undefined ? undefined : asString(body.description, "", 400),
      visibility: body.visibility === "unlisted" ? "unlisted" : body.visibility === "public" ? "public" : undefined,
      allowDownload: typeof body.allowDownload === "boolean" ? body.allowDownload : undefined,
    });
    return Response.json({ release });
  } catch (err) {
    return socialError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    await unpublishRelease(auth.user.id, id);
    return Response.json({ ok: true });
  } catch (err) {
    return socialError(err);
  }
}
