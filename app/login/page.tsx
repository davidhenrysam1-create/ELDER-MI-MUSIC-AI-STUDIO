"use client";

/**
 * Sign in.
 *
 * Three ways in, each shown honestly:
 *  - **Continue with Google** — always a real, clickable button. It is a one-tap
 *    sign-in as soon as `GOOGLE_CLIENT_ID` / `SECRET` exist, and until then it
 *    opens the one-time set-up panel (`components/auth/GoogleButton.tsx`)
 *    instead of pretending or sending anyone to a Google error page;
 *  - email + password for ordinary accounts;
 *  - a one-time **admin bootstrap code** while Google is not configured yet, so
 *    the owner is never locked out of their own studio.
 *
 * It also detects the one failure that looks like a wrong password but is not:
 * a browser that refuses to store the session cookie (a third-party iframe with
 * strict cookie blocking). Sign-in succeeds, the cookie is dropped, and the
 * next page bounces straight back here. Rather than looping silently we say so
 * and offer a new tab, where the cookie is first-party.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { ApiError, api, type MeResponse } from "@/lib/client/api";
import { GoogleButton } from "@/components/auth/GoogleButton";

const GOOGLE_REASONS: Record<string, string> = {
  unconfigured:
    "Google sign-in needs a one-time set-up on this server (see the panel below).",
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
  const [cookieBlocked, setCookieBlocked] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void api
      .me()
      .then(setConfig)
      .catch(() => undefined);
  }, []);

  /**
   * Was this page reached straight after a sign-in that *looked* successful?
   *
   * `submit()` records the moment it happens. If we are rendered again with a
   * `?next=` (which only the middleware adds when it cannot see a session) and
   * that record is seconds old, the browser threw the cookie away. Say it out
   * loud instead of letting the person retype their password forever.
   */
  useEffect(() => {
    try {
      const at = Number(window.sessionStorage.getItem("eldermi_signed_in_at") ?? 0);
      const fresh = at > 0 && Date.now() - at < 30_000;
      if (fresh && params.get("next")) setCookieBlocked(true);
      window.sessionStorage.removeItem("eldermi_signed_in_at");
    } catch {
      // sessionStorage can be blocked in a sandboxed frame; not worth an error.
    }
  }, [params]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user } = await api.login({ email, password });
      try {
        window.sessionStorage.setItem("eldermi_signed_in_at", String(Date.now()));
      } catch {
        // Ignored: the loop detector is a nicety, the sign-in itself succeeded.
      }
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
  const adminPasswordReady = config?.adminSignIn?.passwordConfigured === true;

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

        {googleError && googleError !== "unconfigured" ? (
          <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100">
            {GOOGLE_REASONS[googleError] ?? "Google sign-in could not be completed."}
            {reasonParam ? ` ${decodeURIComponent(reasonParam)}` : ""}
          </p>
        ) : null}

        {/* Cookie refused by the browser — the one loop that is not a bad password. */}
        {cookieBlocked ? (
          <div className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/[0.08] px-2.5 py-2 text-[10px] leading-relaxed text-rose-100">
            <span className="font-semibold">Your browser did not keep the sign-in.</span> This page
            is inside another site&apos;s frame, and the browser refused the session cookie.{" "}
            <a
              href={nextPath}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-white underline"
            >
              Open the studio in its own tab
            </a>{" "}
            and sign in there — that fixes it.
          </div>
        ) : null}

        {/* Google: always a real button; a panel explains the one-time set-up. */}
        <GoogleButton
          className="mt-3"
          configured={googleReady}
          defaultOpen={googleError === "unconfigured"}
          onUseEmail={() => emailRef.current?.focus()}
        />

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
              ref={emailRef}
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
            <div className="mb-1 flex items-center justify-between">
              <label className="label block" htmlFor="password">
                Password
              </label>
              <Link
                href="/forgot"
                className="text-[10px] font-semibold text-violet-200 underline decoration-violet/30 underline-offset-2 hover:text-white"
              >
                Forgot password?
              </Link>
            </div>
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
          {adminPasswordReady ? (
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
              Sign in above with the admin email and the password from{" "}
              <span className="mono">ADMIN_PASSWORD</span>. Once you are in, change it in My account —
              the setup password is only a way back in.
            </p>
          ) : null}

          {googleReady ? (
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
              The admin account also signs in with Google, using the address in{" "}
              <span className="mono">ADMIN_EMAIL</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
              Google sign-in is not configured yet, so besides a password the admin has a one-time
              bootstrap code.{" "}
              {bootstrapAvailable ? (
                <Link href="/admin-bootstrap" className="text-cyan-200 underline hover:text-white">
                  Enter the bootstrap code →
                </Link>
              ) : (
                <span>
                  No code is active right now — restart the server (or set{" "}
                  <span className="mono">ADMIN_BOOTSTRAP_CODE</span>) to issue one.
                </span>
              )}
            </p>
          )}
        </div>

        <p className="mt-2 text-center text-[9px] leading-relaxed text-muted/60">
          {config?.email?.configured
            ? "Forgotten passwords are reset by email: a one-use link that expires in an hour."
            : "No mail provider is configured, so reset links cannot be emailed. A forgotten password is reset by whoever runs the server."}
        </p>
      </GlassCard>
    </div>
  );
}
