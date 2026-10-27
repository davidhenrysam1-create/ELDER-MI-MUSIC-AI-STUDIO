/**
 * POST /api/auth/password/forgot
 *
 * Starts a password reset. Three honest outcomes, none of which leaks whether a
 * particular address has an account:
 *
 *  - no mail provider configured → `{ ok: true, sent: false, emailConfigured: false }`
 *    with the reason, so the screen can say "no email was sent" instead of
 *    pretending one is on its way;
 *  - provider configured, address exists → the link is minted and mailed;
 *  - provider configured, address unknown / suspended / Google-only → the same
 *    generic answer as a successful send, with `sent: false`.
 */
import { issuePasswordReset } from "@/lib/server/auth";
import { emailStatus, passwordResetEmail, sendEmail } from "@/lib/server/email";
import { requestOrigin } from "@/lib/server/google";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

/** What every caller is told, whatever happened behind the scenes. */
const GENERIC = "If that address has an account, a reset link is on its way.";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) return jsonError("Enter the email address on the account.");

  const provider = emailStatus();
  // Without a provider nothing can be sent, so do not mint a token at all —
  // say exactly that, and let the screen tell the person who to ask.
  if (!provider.configured) {
    return Response.json({
      ok: true,
      sent: false,
      emailConfigured: false,
      message: GENERIC,
      reason: provider.reason,
      hint: "Ask whoever runs the studio server to reset it, or configure an email provider.",
    });
  }

  const result = await issuePasswordReset(email);
  if (!result.issued) {
    return Response.json({ ok: true, sent: false, emailConfigured: true, message: GENERIC });
  }

  const origin = requestOrigin(request);
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || origin;
  const link = `${base}/reset?token=${encodeURIComponent(result.token)}`;
  const mail = passwordResetEmail(result.name, link);
  const sent = await sendEmail({ to: result.email, ...mail });

  return Response.json({
    ok: true,
    sent: sent.sent,
    emailConfigured: true,
    message: GENERIC,
    expiresAt: result.expiresAt,
    ...(sent.sent ? {} : { reason: sent.reason }),
  });
}
