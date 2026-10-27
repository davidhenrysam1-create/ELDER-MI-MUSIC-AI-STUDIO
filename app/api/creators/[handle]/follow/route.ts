/**
 * POST /api/creators/<handle>/follow
 *
 * Follow or unfollow a creator. Answers with the resulting state and their real
 * follower count.
 */
import { guard } from "@/lib/server/auth";
import { SocialError, toggleFollow } from "@/lib/server/social";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const { handle } = await params;
  try {
    return Response.json(
      await toggleFollow(auth.user.id, decodeURIComponent(handle)),
    );
  } catch (err) {
    if (err instanceof SocialError) return jsonError(err.message, err.status);
    return jsonError("Could not update the follow.", 500);
  }
}
