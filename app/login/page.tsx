"use client";

/**
 * Sign in.
 *
 * Deliberately a plain form: email + password, nothing to configure. Errors are
 * shown from the server's own wording. On success the browser returns to the
 * page it was heading for (`?next=`), defaulting to the dashboard.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";

/**
 * `useSearchParams()` forces client-side rendering, so the form lives inside a
 * Suspense boundary; the fallback is the same card without data.
 */
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.login({ email, password });
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
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
          <Icon name="waveform" size={22} className="text-white" />
        </div>
        <h1 className="mt-4 text-fluid-title font-display font-bold tracking-tight">
          <GradientText>Elder Mi Music</GradientText>
        </h1>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          AI Studio
        </p>
        <p className="mt-2 text-xs italic text-muted/80">“Your Sound. Your Culture. Your Studio.”</p>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-softwhite">Sign in</h2>
          <StatusPill tone="info" icon="lock">
            Private studio
          </StatusPill>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Your projects, audio and share links are tied to your account on this studio server.
        </p>

        <form className="mt-4 space-y-3" onSubmit={submit}>
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
        <p className="mt-2 text-center text-[9px] leading-relaxed text-muted/60">
          No password reset email is sent: there is no mail service in this build. If you forget the
          password, the server owner can reset it from the machine that runs the studio.
        </p>
      </GlassCard>
    </div>
  );
}
