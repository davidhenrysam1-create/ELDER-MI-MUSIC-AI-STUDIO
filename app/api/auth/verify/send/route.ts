/**
 * POST /api/auth/verify/send
 *
 * Issues a verification token and tries to mail it. With no email provider
 * configured the answer is an honest `{ sent: false, reason }` — the token is
 * still issued, so the admin can verify the account from the console.
 */
import { guard, issueVerificationToken } from "@/lib/server/auth";
import { emailStatus, sendEmail, verificationEmail } from "@/lib/server/email";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await guard();
  if (auth.response) return auth.response;
  if (auth.user.emailVerified) {
    return Response.json({ sent: false, reason: "This address is already verified." });
  }

  const { token, expiresAt } = await issueVerificationToken(auth.user.id);
  const origin = new URL(request.url).origin;
  const link = `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || origin}/api/auth/verify/confirm?token=${token}`;
  const message = verificationEmail(auth.user.name, link);
  const result = await sendEmail({ to: auth.user.email, ...message });

  if (result.sent) {
    return Response.json({ sent: true, expiresAt });
  }
  return Response.json({
    sent: false,
    reason: result.reason,
    // Says exactly what to do instead of pretending an email is on its way.
    hint: "Ask the studio admin to verify the account from the admin console, or configure an email provider.",
    emailConfigured: emailStatus().configured,
  });
}
