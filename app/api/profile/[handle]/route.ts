/**
 * GET /api/profile/<handle>
 *
 * A creator's public page: name, roles, bio, social links, follower counts and
 * their published songs. Never an email address, a session or a moderation
 * field — see `creatorPage()`.
 *
 * Signed-in listeners also get `likedByViewer` / `followingViewer`, so the page
 * can show the real state of the Like and Follow buttons.
 */
import { currentUser } from "@/lib/server/auth";
import { creatorPage } from "@/lib/server/social";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { handle } = await params;
  const viewer = await currentUser();
  const page = await creatorPage(decodeURIComponent(handle), viewer?.id ?? null);
  if (!page) return jsonError("No creator with that handle.", 404);
  // `signedIn` lets the page label Like/Follow honestly instead of failing on click.
  return Response.json({ ...page, signedIn: Boolean(viewer) });
}
