"use client";

/**
 * `/reset?token=…` — choose a new password from the emailed link.
 *
 * The token is checked by the server, burnt on success, and every device is
 * signed out. The page says what happened instead of redirecting into a form
 * that would fail next time.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";

const PASSWORD_MIN = 8;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword({ token, password });
      setDone(true);
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
          <GradientText>Choose a new password</GradientText>
        </h1>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-softwhite">Reset password</h2>
          <StatusPill tone={done ? "success" : "info"} icon={done ? "check" : "lock"}>
            {done ? "Changed" : "One use only"}
          </StatusPill>
        </div>

        {!token ? (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100">
            This link has no reset token in it. Open the link from the email again, or{" "}
            <Link href="/forgot" className="underline">
              ask for a new one
            </Link>
            .
          </p>
        ) : done ? (
          <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-2.5 py-2 text-[10px] leading-relaxed text-emerald-100">
            <span className="font-semibold">Password changed.</span> Every device was signed out. Sign in
            with the new password —{" "}
            <Link href="/login" className="underline">
              go to sign in
            </Link>
            .
          </div>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={submit}>
            <div>
              <label className="label mb-1 block" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                type="password"
                className="field text-xs"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label mb-1 block" htmlFor="confirm">
                Repeat the password
              </label>
              <input
                id="confirm"
                type="password"
                className="field text-xs"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-100">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn-primary w-full justify-center text-xs" disabled={busy}>
              {busy ? "Saving…" : "Save the new password"}
            </button>
          </form>
        )}
      </GlassCard>
    </div>
  );
}
