"use client";

/**
 * `/admin-bootstrap` — one-time admin sign-in.
 *
 * Needed only while Google is not configured: without it the owner could not get
 * into their own studio at all. The code is printed in the server log by
 * `adminSignInState()` (or set with `ADMIN_BOOTSTRAP_CODE`), works once, and
 * expires after 24 hours. As soon as Google credentials exist this page says so
 * and the server refuses the code.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";

export default function AdminBootstrapPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adminEmailAddress, setAdminEmailAddress] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void api
      .me()
      .then((me) => {
        setAdminEmailAddress(me.adminSignIn?.adminEmailMasked ?? null);
        setGoogleReady(me.adminSignIn?.googleConfigured === true);
        setAvailable(me.adminSignIn?.bootstrapAvailable === true);
      })
      .catch(() => setAvailable(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.bootstrap(code.trim());
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-5 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-500/40 to-violet/50 shadow-glow">
          <Icon name="lock" size={22} className="text-white" />
        </div>
        <h1 className="mt-4 text-xl font-display font-bold tracking-tight">
          <GradientText>Studio admin access</GradientText>
        </h1>
        <p className="mt-1 text-[11px] text-muted">
          One-time code for <span className="mono text-softwhite/80">{adminEmailAddress ?? "the admin address"}</span>
        </p>
      </div>

      <GlassCard>
        {googleReady ? (
          <div className="space-y-2 text-[11px] leading-relaxed text-amber-100">
            <StatusPill tone="success" icon="check">
              Google sign-in is configured
            </StatusPill>
            <p>
              The bootstrap code is disabled now. Sign in with Google using the address in{" "}
              <span className="mono">ADMIN_EMAIL</span> — that address is always the admin.
            </p>
            <Link href="/login" className="btn-primary w-full justify-center text-xs">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <p className="text-[10px] leading-relaxed text-muted">
              Read the code from the terminal running the studio — it is printed on first start when{" "}
              <span className="mono">ADMIN_EMAIL</span> is set. It is single-use and lasts 24 hours.
            </p>
            <div>
              <label className="label mb-1 block" htmlFor="code">
                Bootstrap code
              </label>
              <input
                id="code"
                className="field mono text-xs tracking-[0.2em]"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                autoComplete="one-time-code"
                required
              />
            </div>
            {error ? (
              <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-rose-100">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn-primary w-full text-xs" disabled={busy || available === false}>
              <Icon name="lock" size={12} />
              {busy ? "Checking…" : "Sign in as admin"}
            </button>
            {available === false ? (
              <p className="text-[9px] leading-relaxed text-amber-200/80">
                No bootstrap code is available on this server. Set{" "}
                <span className="mono">ADMIN_EMAIL</span> (and optionally{" "}
                <span className="mono">ADMIN_BOOTSTRAP_CODE</span>) in{" "}
                <span className="mono">.env.local</span>, then restart.
              </p>
            ) : null}
          </form>
        )}

        <p className="mt-3 text-center text-[9px] leading-relaxed text-muted/60">
          The admin password is never stored in this app: the admin signs in with Google, or with this
          code. Change any password that was shared in chat.
        </p>
        <p className="mt-2 text-center text-[10px]">
          <Link href="/login" className="text-cyan-200 underline hover:text-white">
            Back to sign in
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
