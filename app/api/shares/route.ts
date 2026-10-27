/**
 * /api/shares
 *
 * GET   links owned by the signed-in account (no secrets, only their state)
 * POST  create a read-only link for one of your projects
 *
 * The full link is returned exactly once, because only a hash of its token is
 * stored. If it is lost, revoke it and create another.
 */
import { AuthError, guard } from "@/lib/server/auth";
import { createShare, listShares } from "@/lib/server/shares";
import { asNumber, asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guard();
  if (auth.response) return auth.response;
  return Response.json({ shares: await listShares(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  const projectId = asString(body.projectId, "", 60);
  if (!projectId) return jsonError("projectId is required");

  const days =
    body.expiresInDays == null || body.expiresInDays === ""
      ? null
      : Math.round(asNumber(body.expiresInDays, 0, 0, 90));

  try {
    const created = await createShare(auth.user.id, {
      projectId,
      label: asString(body.label, "", 60),
      allowDownload: body.allowDownload === true,
      expiresInDays: days,
      passcode: asString(body.passcode, "", 12) || null,
    });
    return Response.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, err.status);
    return jsonError((err as Error).message || "Could not create the link", 500);
  }
}
