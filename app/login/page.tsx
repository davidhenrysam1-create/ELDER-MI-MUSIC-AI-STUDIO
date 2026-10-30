"use client";

/**
 * Sign in.
 *
 * Two ways in, each shown honestly:
 *  - **Continue with Google** — always a real, clickable button. It is a one-tap
 *    sign-in as soon as `GOOGLE_CLIENT_ID` / `SECRET` exist, and until then it
 *    opens the one-time set-up panel (`components/auth/GoogleButton.tsx`)
 *    instead of pretending or sending anyone to a Google error page;
 *  - **email + password**. For the owner this is simply `ADMIN_EMAIL` and
 *    `ADMIN_PASSWORD`: the account is created from them on the first successful
 *    sign-in, so there is no one-time code to look up in a server log.
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
  signup_closed:
    "New accounts are closed on this studio. Use an existing account, or ask the owner for access.",
  // Rendered by the dedicated block above, which can name both addresses.
  host_mismatch: "Google sign-in is set up for a different address.",
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
  // Set by /api/auth/google/start when the studio is configured for a different
  // address than the one this browser is on.
  const configuredHost = params.get("configured");
  const currentHost = params.get("current");

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
  const adminPasswordReady = config?.adminSignIn?.passwordConfigured === true;
  const adminExists = config?.adminSignIn?.adminExists === true;

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

        {googleError === "host_mismatch" ? (
          /*
           * The exact cause of Google's "403. That's an error." page: the button
           * asked Google for a callback on one address while the browser is on
           * another. Google only accepts addresses registered for this client, so
           * the sign-in has to happen on the registered one.
           */
          <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100">
            <span className="font-semibold">Google sign-in is set up for a different address.</span>{" "}
            This studio is configured for{" "}
            <span className="mono">{configuredHost ?? "another address"}</span>, but you opened it at{" "}
            <span className="mono">{currentHost ?? "this address"}</span>. Google only accepts the
            address registered for it, so it refused — nothing is wrong with your password.
            <br />
            Open the studio at{" "}
            <span className="mono">https://{configuredHost ?? "your registered address"}</span> and
            press Continue with Google there. Email and password work on every address, including
            this one.
          </div>
        ) : googleError && googleError !== "unconfigured" ? (
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

        {/*
          A real button, not a footnote. Creating an account was reachable only
          through a small "Create one" link, which is easy to miss on a phone —
          and on a public site it is the first thing a new visitor needs.
        */}
        <Link
          href="/signup"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-softwhite transition-colors hover:border-white/30 hover:bg-white/[0.08]"
        >
          <Icon name="plus" size={13} /> Create an account
        </Link>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-muted">
          The first account on a new studio owns the projects already saved here.
        </p>

        {/*
          The owner's way in, stated plainly. No one-time code: ADMIN_EMAIL plus
          ADMIN_PASSWORD is the account, and it is created on first sign-in.
        */}
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-softwhite">
            <Icon name="lock" size={11} className="text-amber-300" /> Studio admin
          </div>
          {adminPasswordReady ? (
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
              Sign in above with <span className="mono">ADMIN_EMAIL</span> and{" "}
              <span className="mono">ADMIN_PASSWORD</span> — the two values set on the server.{" "}
              {adminExists
                ? "Once you are in, change the password in My account."
                : "The owner account is created on the first successful sign-in."}
            </p>
          ) : (
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
              No <span className="mono">ADMIN_PASSWORD</span> is set on this server yet. Add it to the
              host&apos;s environment settings (8+ characters), then sign in with that password.
            </p>
          )}
          {googleReady ? (
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
              The admin account also signs in with Google, using the address in{" "}
              <span className="mono">ADMIN_EMAIL</span>.
            </p>
          ) : null}
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
