"use client";

/**
 * `/welcome` — choose your roles.
 *
 * Reached after a Google sign-in (which cannot ask the question) or by visiting
 * it directly. Artists, producers, engineers and promoters get different
 * dashboards, so nothing else is unlocked until at least one role is picked.
 * Multiple roles are allowed — that is what "Both" means in practice.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill, cn } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";
import { ACCOUNT_ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import type { AccountRole } from "@/lib/types";

export default function WelcomePage() {
  const router = useRouter();
  const [roles, setRoles] = useState<AccountRole[]>([]);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .me()
      .then((me) => {
        if (!me.user) {
          router.replace("/login?next=%2Fwelcome");
          return;
        }
        setName(me.user.name);
        setRoles((me.user.roles ?? []) as AccountRole[]);
        setHandle(me.user.handle ?? "");
      })
      .catch(() => undefined);
  }, [router]);

  const toggle = (role: AccountRole) =>
    setRoles((current) =>
      current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role],
    );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (roles.length === 0) {
      setError("Pick at least one role — it decides which studio tools you get.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.onboarding({ roles, handle: handle.trim() || undefined });
      // Reload the studio data so the navigation reflects the new roles at once.
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-5">
        <StatusPill tone="info" icon="user">
          Step 1 of 1 · {name || "New account"}
        </StatusPill>
        <h1 className="mt-3 text-fluid-title font-display font-bold tracking-tight">
          <GradientText>What do you do?</GradientText>
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          This is the only thing that changes your dashboard. Choose every role that fits — you can
          edit it later in My account.
        </p>
      </div>

      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {ACCOUNT_ROLES.map((role) => {
            const active = roles.includes(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggle(role)}
                aria-pressed={active}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  active
                    ? "border-violet/50 bg-violet/[0.12] shadow-inner1"
                    : "border-white/10 bg-black/25 hover:border-white/25",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-lg border text-[10px]",
                      active
                        ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
                        : "border-white/10 bg-white/[0.03] text-muted",
                    )}
                  >
                    <Icon name={active ? "check" : "plus"} size={11} />
                  </span>
                  <span className="text-xs font-semibold text-softwhite">{ROLE_LABEL[role]}</span>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                  {ROLE_DESCRIPTION[role]}
                </p>
              </button>
            );
          })}
        </div>

        <GlassCard>
          <label className="label mb-1 block" htmlFor="handle">
            Your public handle (optional)
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted">/u/</span>
            <input
              id="handle"
              className="field text-xs"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="eldermi"
              maxLength={20}
            />
          </div>
          <p className="mt-1 text-[9px] leading-relaxed text-muted/70">
            Letters, numbers and underscores. This becomes your public page — other accounts will find
            you there once publishing is enabled.
          </p>
        </GlassCard>

        {error ? (
          <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-100">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full text-xs" disabled={busy}>
          <Icon name="check" size={13} />
          {busy ? "Saving…" : "Save and open my studio"}
        </button>
      </form>
    </div>
  );
}
