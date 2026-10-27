"use client";

/**
 * Passcode gate for a shared link.
 *
 * Submits to `/api/share/[token]/unlock`, which validates the passcode against a
 * salted scrypt hash and sets a link-specific cookie. On success the page is
 * refreshed server-side so the player appears without a client-side audio hack.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/client/api";

export function SharePasscodeForm({ token }: { token: string }) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.unlockShare(token, passcode);
      // The server component re-renders with the unlock cookie in place.
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "That passcode is not correct.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-3 space-y-2" onSubmit={submit}>
      <label className="label block" htmlFor="share-passcode">
        Enter the passcode
      </label>
      <input
        id="share-passcode"
        className="field text-sm tracking-[0.3em]"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        inputMode="text"
        autoComplete="off"
        maxLength={12}
        autoFocus
      />
      {error ? (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-100">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary w-full text-xs" disabled={busy || !passcode}>
        <Icon name="lock" size={13} />
        {busy ? "Checking…" : "Unlock this session"}
      </button>
      <p className="text-[9px] leading-relaxed text-muted/70">
        The producer sent this passcode separately. It is checked on the server, then remembered for
        this link in this browser.
      </p>
    </form>
  );
}
