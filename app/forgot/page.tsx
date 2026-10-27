"use client";

/**
 * `/forgot` — ask for a password-reset link.
 *
 * The screen never claims more than the server did. Three outcomes:
 *
 *  - no mail provider → says so, and who to ask instead;
 *  - provider configured → the same generic sentence whether or not that address
 *    has an account (so the form cannot be used to discover who is registered);
 *  - the provider itself failed → its actual reason, because "check your email"
 *    would be a lie.
 */
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";

type Result = {
  sent: boolean;
  emailConfigured: boolean;
  message: string;
  reason?: string;
  hint?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setResult(await api.forgotPassword(email.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-violet/70 via-magenta/60 to-cyan/60 shadow-glow">
          <Icon name="lock" size={22} className="text-white" />
        </div>
        <h1 className="mt-4 text-fluid-title font-display font-bold tracking-tight">
          <GradientText>Forgotten password</GradientText>
        </h1>
        <p className="mt-2 text-xs text-muted">
          Enter the address on your account and we will email a link to choose a new password.
        </p>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-softwhite">Send a reset link</h2>
          <StatusPill tone="info" icon="clock">
            Expires in 1 hour
          </StatusPill>
        </div>

        <form className="mt-3 space-y-3" onSubmit={submit}>
          <div>
            <label className="label mb-1 block" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="field text-xs"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-100">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full justify-center text-xs" disabled={busy}>
            {busy ? "Checking…" : "Send reset link"}
          </button>
        </form>

        {result ? (
          <div
            className={`mt-3 rounded-xl border p-2.5 text-[10px] leading-relaxed ${
              result.sent
                ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-100"
                : "border-amber-400/30 bg-amber-400/[0.08] text-amber-100"
            }`}
          >
            {result.sent ? (
              <>
                <span className="font-semibold">Check your email.</span> {result.message} The link
                works once and expires in one hour.
              </>
            ) : !result.emailConfigured ? (
              <>
                <span className="font-semibold">No email was sent.</span> {result.reason}
                {result.hint ? ` ${result.hint}` : ""}
              </>
            ) : (
              <>
                {result.message}
                {result.reason ? ` The mail provider said: ${result.reason}` : ""}
              </>
            )}
          </div>
        ) : null}

        <p className="mt-3 text-center text-[10px] text-muted">
          <Link href="/login" className="text-violet-200 underline decoration-violet/30 underline-offset-2 hover:text-white">
            Back to sign in
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
