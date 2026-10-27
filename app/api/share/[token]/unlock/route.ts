/**
 * POST /api/share/[token]/unlock
 *
 * Checks a share passcode and, on success, sets a link-specific cookie so the
 * visitor is not asked again for that link. Wrong codes are rate-limited by the
 * short passcode space only — which is why links also expire.
 */
import { findShare, unlockShare } from "@/lib/server/shares";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const share = await findShare(token);
  if (!share) return jsonError("This link is not active.", 404);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";
  if (!passcode) return jsonError("Enter the passcode.");

  const ok = await unlockShare(token, passcode);
  if (!ok) return jsonError("That passcode is not correct.", 401);
  return Response.json({ ok: true });
}
