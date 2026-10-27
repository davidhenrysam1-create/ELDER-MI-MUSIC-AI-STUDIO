"use client";

/**
 * Sign in.
 *
 * Three ways in, each shown honestly:
 *  - email + password for ordinary accounts;
 *  - **Continue with Google** only when `GOOGLE_CLIENT_ID` / `SECRET` exist
 *    (otherwise the button says "awaiting configuration" and does not pretend);
 *  - a one-time **admin bootstrap code** while Google is not configured yet, so
 *    the owner is never locked out of their own studio.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { ApiError, api, type MeResponse } from "@/lib/client/api";

const GOOGLE_REASONS: Record<string, string> = {
  unconfigured:
    "Google sign-in is not configured on this server yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then restart.",
  cancelled: "Google sign-in was cancelled.",
  state: "That sign-in attempt expired. Please try again.",
  unverified_email: "Your Google account's email address is not verified with Google.",
  error: "Google sign-in could not be completed. Try again, or use your email and password.",
  suspended: "This account is suspended.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";
  const googleError = params.get("google");
  const reasonParam = params.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<MeResponse | null>(null);

  useEffect(() => {
    void api
      .me()
      .then(setConfig)
      .catch(() => undefined);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user } = await api.login({ email, password });
      // Accounts without roles finish onboarding first.
      const target = (user.roles ?? []).length === 0 ? "/welcome" : nextPath;
      router.replace(target.startsWith("/") ? target : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const googleReady = config?.google?.configured === true;
  const bootstrapAvailable = config?.adminSignIn?.bootstrapAvailable === true;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-violet/70 via-magenta/60 to-cyan/60 shadow-glow">
          <Icon name="waveform" size={22} className="text-white" />
        </div>
        <h1 className="mt-4 text-fluid-title font-display font-bold tracking-tight">
          <GradientText>Elder Mi Music</GradientText>
        </h1>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">AI Studio</p>
        <p className="mt-2 text-xs italic text-muted/80">“Your Sound. Your Culture. Your Studio.”</p>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-softwhite">Sign in</h2>
          <StatusPill tone="info" icon="lock">
            Private studio
          </StatusPill>
        </div>

        {googleError ? (
          <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100">
            {GOOGLE_REASONS[googleError] ?? "Google sign-in could not be completed."}
            {reasonParam ? ` ${decodeURIComponent(reasonParam)}` : ""}
          </p>
        ) : null}

        {/* Google */}
        <div className="mt-3">
          {googleReady ? (
            <a href={api.googleSignInUrl} className="btn-ghost w-full justify-center text-xs">
              <Icon name="user" size={13} /> Continue with Google
            </a>
          ) : (
            <div
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-muted/70"
              title={config?.google?.reason ?? "Checking configuration…"}
            >
              <Icon name="user" size={13} /> Continue with Google
              <span className="rounded border border-amber-400/30 px-1 py-0.5 text-[8px] uppercase tracking-wide text-amber-200">
                awaiting configuration
              </span>
            </div>
          )}
        </div>

        <div className="my-3 flex items-center gap-2 text-[9px] uppercase tracking-wider text-muted/50">
          <span className="h-px flex-1 bg-white/10" /> or use email <span className="h-px flex-1 bg-white/10" />
        </div>

        <form className="space-y-3" onSubmit={submit}>
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
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="field pr-16 text-xs"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] text-muted hover:text-softwhite"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-rose-100">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full text-xs" disabled={busy}>
            <Icon name="check" size={13} />
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted">
          No account yet?{" "}
          <Link href="/signup" className="text-cyan-200 underline hover:text-white">
            Create one
          </Link>
          . The first account on a new studio owns the projects already saved here.
        </p>

        {/* Admin */}
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-softwhite">
            <Icon name="lock" size={11} className="text-amber-300" /> Studio admin
          </div>
          {googleReady ? (
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
              The admin account signs in with Google, using the address in{" "}
              <span className="mono">ADMIN_EMAIL</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
              Google sign-in is not configured yet, so the admin uses a one-time bootstrap code.{" "}
              {bootstrapAvailable ? (
                <Link href="/admin-bootstrap" className="text-cyan-200 underline hover:text-white">
                  Enter the bootstrap code →
                </Link>
              ) : (
                <span>
                  Set <span className="mono">ADMIN_EMAIL</span> and restart to generate one.
                </span>
              )}
            </p>
          )}
        </div>

        <p className="mt-2 text-center text-[9px] leading-relaxed text-muted/60">
          No password reset email is sent:{" "}
          {config?.email?.configured
            ? "email is configured, but reset links are not implemented yet."
            : "this build has no mail provider. A forgotten password is reset by whoever runs the server."}
        </p>
      </GlassCard>
    </div>
  );
}
