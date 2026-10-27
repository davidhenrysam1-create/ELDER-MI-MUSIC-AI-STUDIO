"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/components/ui/primitives";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "eldermi.installDismissed";

/**
 * Registers the service worker and offers "install as an app".
 *
 * - Android / desktop Chrome & Edge: uses the real `beforeinstallprompt` event.
 * - iPhone & iPad (Safari): there is no install API, so it explains
 *   Share → Add to Home Screen instead of showing a button that would fail.
 * - Already installed (standalone display mode): renders nothing.
 */
export function PwaBridge() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register the offline/app-shell worker in production builds only, so the
    // dev server never serves stale bundles.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes this non-standard flag.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && "ontouchend" in document);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|android/i.test(ua);
    if (isIos && isSafari) {
      setIosHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage may be blocked */
    }
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setHidden(true);
    else dismiss();
    setPromptEvent(null);
  };

  if (hidden || (!promptEvent && !iosHint)) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-2 bottom-[8.5rem] z-40 mx-auto w-auto max-w-md sm:inset-x-auto sm:right-4 sm:bottom-24",
        "glass-strong animate-rise flex items-start gap-3 rounded-xl px-3 py-2.5",
      )}
      role="region"
      aria-label="Install Elder Mi Music AI Studio"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet via-magenta to-cyan text-white">
        <Icon name="download" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-softwhite">
          {iosHint ? "Add Elder Mi to your Home Screen" : "Install Elder Mi as an app"}
        </p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
          {iosHint
            ? "Tap the Share button, then “Add to Home Screen” to open the studio full-screen on iPhone or iPad."
            : "Runs full-screen, keeps the studio shell available offline and adds it to your dock or home screen."}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          {!iosHint ? (
            <button type="button" onClick={() => void install()} className="btn-primary px-2.5 py-1 text-[10px]">
              Install
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md px-1.5 py-1 text-[10px] text-muted hover:text-softwhite"
          >
            {iosHint ? "Got it" : "Not now"}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="shrink-0 rounded-md p-1 text-muted hover:text-softwhite"
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
