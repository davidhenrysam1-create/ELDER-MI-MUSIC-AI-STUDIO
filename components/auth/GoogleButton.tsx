"use client";

/**
 * "Continue with Google" — the same button in both states.
 *
 * The button used to be a greyed-out box labelled *awaiting configuration*,
 * which made Google sign-in look broken and pushed people into filling in a
 * form they did not want. It is now always a live, clickable Google button:
 *
 *  - **Configured** (`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set): a plain
 *    link to `/api/auth/google/start`. One tap, no form, and the address comes
 *    back already verified by Google.
 *  - **Not configured yet**: clicking opens a short, self-contained set-up
 *    panel right here — the exact redirect URI to paste into Google Cloud
 *    Console, with a copy button, and a "use email instead" way out. Nothing
 *    is faked: we never send anyone to a Google error page.
 *
 * The redirect URI is read from `window.location.origin`, so it matches
 * whatever address the studio is actually open on (localhost, a preview URL, or
 * a real domain) instead of a hardcoded string.
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/client/api";

/** The four-colour Google "G". Decorative, so it is hidden from screen readers. */
function GoogleMark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.28-3.14.76-4.59l-7.98-6.19A24 24 0 0 0 0 24c0 3.88.92 7.54 2.55 10.78l7.98-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.9l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}

const BUTTON_CLASS =
  "flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";

export function GoogleButton({
  /** `true` when the server has both Google credentials. */
  configured,
  /** Open the set-up panel on first render (used after `?google=unconfigured`). */
  defaultOpen = false,
  /** Called by the "use email instead" link. */
  onUseEmail,
  className = "",
}: {
  configured: boolean;
  defaultOpen?: boolean;
  onUseEmail?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [redirectUri, setRedirectUri] = useState("/api/auth/google/callback");
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  // window is unavailable during the server render, so fill this in on mount.
  useEffect(() => {
    setRedirectUri(`${window.location.origin}/api/auth/google/callback`);
  }, []);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied("done");
      setTimeout(() => setCopied("idle"), 2500);
    } catch {
      // Clipboard access can be blocked inside an iframe; the text is selectable
      // so say so rather than pretending the copy worked.
      setCopied("failed");
    }
  };

  if (configured) {
    return (
      <a href={api.googleSignInUrl} className={`${BUTTON_CLASS} ${className}`}>
        <GoogleMark />
        Continue with Google
      </a>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="google-setup"
        className={BUTTON_CLASS}
      >
        <GoogleMark />
        Continue with Google
      </button>

      {open ? (
        <div
          id="google-setup"
          className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 text-left"
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/10 text-cyan-200">
              <Icon name="info" size={12} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-softwhite">
                Google sign-in needs a one-time set-up
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                It stays off until this server has a Google OAuth client. Nothing was sent to
                Google, and no account was created. Email and password below work right now.
              </p>
            </div>
          </div>

          <ol className="mt-2.5 space-y-1.5 text-[10px] leading-relaxed text-muted">
            <li>
              <span className="font-semibold text-softwhite">1.</span> Open{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer noopener"
                className="text-violet-200 underline decoration-violet/30 underline-offset-2 hover:text-white"
              >
                Google Cloud Console → Credentials
              </a>{" "}
              and create an <span className="mono">OAuth client ID</span> of type{" "}
              <span className="mono">Web application</span>.
            </li>
            <li>
              <span className="font-semibold text-softwhite">2.</span> Paste this as an{" "}
              <span className="mono">Authorised redirect URI</span> (exact, no trailing slash):
            </li>
          </ol>

          <div className="mt-1.5 flex items-stretch gap-1.5">
            <code className="mono min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-cyan-100">
              {redirectUri}
            </code>
            <button
              type="button"
              onClick={copy}
              className="btn-subtle shrink-0 px-2 py-1 text-[10px]"
              title="Copy the redirect URI"
            >
              <Icon name={copied === "done" ? "check" : "copy"} size={12} />
              {copied === "done" ? "Copied" : "Copy"}
            </button>
          </div>
          {copied === "failed" ? (
            <p className="mt-1 text-[9px] text-amber-200">
              The clipboard is blocked here — select the address above and copy it by hand.
            </p>
          ) : null}

          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            <span className="font-semibold text-softwhite">3.</span> Put the Client ID and Client
            secret in <span className="mono">.env.local</span> as{" "}
            <span className="mono">GOOGLE_CLIENT_ID</span> and{" "}
            <span className="mono">GOOGLE_CLIENT_SECRET</span>, then restart the server. This
            button becomes a one-tap sign-in (and the email arrives verified by Google).
          </p>

          {onUseEmail ? (
            <button
              type="button"
              onClick={onUseEmail}
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-violet-200 hover:text-white"
            >
              <Icon name="chevron" size={11} />
              Use email and password instead
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
