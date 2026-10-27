/**
 * POST /api/releases/<id>/like
 *
 * Toggles a like and answers with the real resulting count, so the button never
 * shows an optimistic number that the database disagrees with.
 */
import { guard } from "@/lib/server/auth";
import { SocialError, toggleLike } from "@/lib/server/social";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    return Response.json(await toggleLike(id, auth.user.id));
  } catch (err) {
    if (err instanceof SocialError) return jsonError(err.message, err.status);
    return jsonError("Could not update the like.", 500);
  }
}
