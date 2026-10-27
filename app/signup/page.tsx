"use client";

/**
 * Create an account.
 *
 * The first account on a fresh studio becomes the owner and adopts any projects
 * that were saved before accounts existed, so nothing is stranded after an
 * upgrade. Logins are local to this server: no email is sent, nothing is shared
 * with a third party.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";

const PASSWORD_MIN = 8;

/** Very small strength hint — honest about what it measures. */
function strength(password: string): { label: string; tone: string; width: string } {
  if (password.length < PASSWORD_MIN) return { label: "Too short", tone: "bg-rose-400", width: "w-1/5" };
  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score >= 4) return { label: "Strong", tone: "bg-emerald-400", width: "w-full" };
  if (score === 3) return { label: "Good", tone: "bg-cyan-400", width: "w-3/4" };
  return { label: "Weak", tone: "bg-amber-400", width: "w-2/5" };
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupOpen, setSignupOpen] = useState(true);
  const [checking, setChecking] = useState(true);

  // Ask the server whether sign-up is open before showing a form that would fail.
  useEffect(() => {
    let cancelled = false;
    void api
      .me()
      .then((me) => {
        if (!cancelled) setSignupOpen(me.signupOpen);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.signup({ name, email, password });
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const meter = strength(password);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-violet/70 via-magenta/60 to-cyan/60 shadow-glow">
          <Icon name="user" size={22} className="text-white" />
        </div>
        <h1 className="mt-4 text-fluid-title font-display font-bold tracking-tight">
          <GradientText>Create your account</GradientText>
        </h1>
        <p className="mt-1 text-xs text-muted">
          One account keeps your projects, audio and share links separate from everyone else on this
          studio.
        </p>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-softwhite">New account</h2>
          <StatusPill tone={signupOpen ? "success" : "warning"} icon={signupOpen ? "check" : "lock"}>
            {checking ? "Checking…" : signupOpen ? "Sign-up open" : "Sign-up closed"}
          </StatusPill>
        </div>

        {!signupOpen ? (
          <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-[10px] leading-relaxed text-amber-100/85">
            This studio has closed new sign-ups (<span className="mono">ALLOW_SIGNUP=false</span>). Ask
            the owner to create an account for you, or{" "}
            <Link href="/login" className="underline">
              sign in
            </Link>
            .
          </div>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={submit}>
            <div>
              <label className="label mb-1 block" htmlFor="name">
                Display name
              </label>
              <input
                id="name"
                className="field text-xs"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The name friends will see on a shared link"
                required
              />
            </div>

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
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label mb-1 block" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="field text-xs"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={PASSWORD_MIN}
                required
              />
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full ${meter.width} ${meter.tone} transition-all`} />
                </div>
                <span className="text-[9px] text-muted">{meter.label}</span>
              </div>
              <p className="mt-1 text-[9px] text-muted/70">
                At least {PASSWORD_MIN} characters. Stored only as a salted scrypt hash on this server.
              </p>
            </div>

            <div>
              <label className="label mb-1 block" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                className="field text-xs"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-rose-100">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn-primary w-full text-xs" disabled={busy}>
              <Icon name="user" size={13} />
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-[10px] text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-cyan-200 underline hover:text-white">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-[9px] leading-relaxed text-muted/60">
          No verification email is sent — this build has no mail service, and it does not pretend to.
          Only upload audio you have the rights to use, and get consent before saving someone
          else&apos;s voice as a profile.
        </p>
      </GlassCard>
    </div>
  );
}
