/**
 * Transactional email.
 *
 * The studio has **no mail provider by default**, and it never pretends to have
 * sent something. `emailConfigured()` is false until `RESEND_API_KEY` is set, and
 * every caller surfaces the real reason:
 *
 *   { sent: false, reason: "No email provider is configured (set RESEND_API_KEY)." }
 *
 * Only Resend is wired up (a single HTTPS POST, no SDK). SMTP would need a
 * dependency; it is listed as planned rather than half-implemented.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export type EmailResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: string };

/** True when an API key and a from-address are both present. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

/** The address mail would come from (shown in Settings). */
export function emailFrom(): string | null {
  return process.env.EMAIL_FROM?.trim() || null;
}

/** Why email is unavailable, in words a producer can act on. */
export function emailStatus(): { configured: boolean; from: string | null; reason: string } {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return {
      configured: false,
      from: null,
      reason: "No email provider is configured. Set RESEND_API_KEY and EMAIL_FROM in .env.local.",
    };
  }
  if (!emailFrom()) {
    return {
      configured: false,
      from: null,
      reason: "RESEND_API_KEY is set but EMAIL_FROM is missing, so there is no sender address.",
    };
  }
  return { configured: true, from: emailFrom(), reason: "Email is configured." };
}

/** Send one message. Never throws for a missing provider; returns the reason. */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const status = emailStatus();
  if (!status.configured) return { sent: false, reason: status.reason };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: status.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      return { sent: false, reason: `The email provider refused it (${response.status}): ${detail}` };
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id ?? null };
  } catch (err) {
    return { sent: false, reason: `Could not reach the email provider: ${(err as Error).message}` };
  }
}

/** The verification message. Plain text plus a very small HTML body. */
export function verificationEmail(name: string, link: string): { subject: string; html: string; text: string } {
  const subject = "Verify your Elder Mi Music AI Studio email";
  const text =
    `Hi ${name},\n\n` +
    `Confirm this address to finish setting up your Elder Mi Music AI Studio account:\n${link}\n\n` +
    "The link expires in 24 hours. If you did not create this account, ignore this message.\n" +
    "Your Sound. Your Culture. Your Studio.";
  const html =
    `<p>Hi ${escapeHtml(name)},</p>` +
    `<p>Confirm this address to finish setting up your <strong>Elder Mi Music AI Studio</strong> account:</p>` +
    `<p><a href="${escapeHtml(link)}">Verify my email</a></p>` +
    `<p>The link expires in 24 hours. If you did not create this account, ignore this message.</p>` +
    `<p style="color:#888">Your Sound. Your Culture. Your Studio.</p>`;
  return { subject, html, text };
}

/** The password-reset message. Same shape as the verification mail. */
export function passwordResetEmail(name: string, link: string, minutes = 60): { subject: string; html: string; text: string } {
  const subject = "Reset your Elder Mi Music AI Studio password";
  const text =
    `Hi ${name},\n\n` +
    `Someone asked to reset the password on your Elder Mi Music AI Studio account.\n${link}\n\n` +
    `The link works once and expires in ${minutes} minutes. If this was not you, ignore this message — ` +
    "your password has not changed.\n" +
    "Your Sound. Your Culture. Your Studio.";
  const html =
    `<p>Hi ${escapeHtml(name)},</p>` +
    `<p>Someone asked to reset the password on your <strong>Elder Mi Music AI Studio</strong> account.</p>` +
    `<p><a href="${escapeHtml(link)}">Choose a new password</a></p>` +
    `<p>The link works once and expires in ${minutes} minutes. If this was not you, ignore this message — ` +
    "your password has not changed.</p>" +
    `<p style="color:#888">Your Sound. Your Culture. Your Studio.</p>`;
  return { subject, html, text };
}

/** Minimal HTML escaping for values interpolated into the mail body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
