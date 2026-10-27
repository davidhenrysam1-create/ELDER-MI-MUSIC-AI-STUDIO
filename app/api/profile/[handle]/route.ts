/**
 * GET /api/profile/<handle>
 *
 * Public profile for `/u/<handle>`: name, roles, bio and social links only.
 * No email, sessions or moderation fields — see `getPublicProfile()`.
 *
 * Published songs will be added to this response in the publishing phase; until
 * then the response says `published: []` rather than inventing a discography.
 */
import { getPublicProfile } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { handle } = await params;
  const profile = await getPublicProfile(decodeURIComponent(handle));
  if (!profile) return jsonError("No creator with that handle.", 404);
  return Response.json({
    profile,
    published: [],
    publishingAvailable: false,
    note: "Published songs and follower counts are not implemented yet; this build shows the profile only.",
  });
}
