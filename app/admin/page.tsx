"use client";

/**
 * `/admin` — the admin console.
 *
 * Every registered account in one place, with what the studio knows about it:
 * roles, provider, verification, suspension, project/track counts, storage and
 * live share links. From here the admin can set roles, mark an address verified,
 * suspend (which ends that account's sessions immediately) or delete an account
 * with everything it owns.
 *
 * The page is a thin client over `/api/admin/users`, which re-checks
 * `ADMIN_EMAIL` on every request — hiding the nav link is convenience, not
 * security.
 */
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  ConfirmButton,
  GlassCard,
  GradientText,
  SectionHeading,
  StatusPill,
  cn,
} from "@/components/ui/primitives";
import { ApiError, api, type AccountUser, type AdminOverview } from "@/lib/client/api";
import { useStudio } from "@/lib/client/studio";
import { formatBytes, relativeTime } from "@/lib/format";
import { ACCOUNT_ROLES, ROLE_SHORT, describeRoles } from "@/lib/roles";
import type { AccountRole } from "@/lib/types";

export default function AdminPage() {
  const { user, notify, refresh } = useStudio();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api.adminOverview());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, label: string, run: () => Promise<unknown>) => {
    setBusy(`${id}:${label}`);
    try {
      await run();
      await load();
      notify("success", "Account updated", label);
    } catch (err) {
      notify("error", "That did not work", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const statsFor = (id: string) => data?.stats.find((row) => row.userId === id);

  const rows = (data?.users ?? []).filter((entry) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return (
      entry.name.toLowerCase().includes(needle) ||
      entry.email.toLowerCase().includes(needle) ||
      (entry.handle ?? "").toLowerCase().includes(needle) ||
      (entry.roles ?? []).some((role) => role.includes(needle))
    );
  });

  if (error) {
    return (
      <div className="space-y-5">
        <GlassCard>
          <SectionHeading
            title="Admin console"
            description="Only the studio admin account can open this page."
            eyebrow="Restricted"
          />
          <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100">
            {error}
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Admin console"
        description="Every registered account on this studio, and what it owns."
        eyebrow="Owner tools"
        action={
          <div className="flex items-center gap-1.5">
            <StatusPill tone="success" icon="user">
              {user?.email ?? ""}
            </StatusPill>
            <button type="button" className="btn-ghost text-[11px]" onClick={() => void load()}>
              <Icon name="refresh" size={11} /> Refresh
            </button>
          </div>
        }
      />

      {/* Totals */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Accounts", value: data?.totals.users ?? 0, icon: "user" as const },
          { label: "Verified emails", value: data?.totals.verified ?? 0, icon: "check" as const },
          { label: "Suspended", value: data?.totals.suspended ?? 0, icon: "lock" as const },
          { label: "Projects", value: data?.totals.projects ?? 0, icon: "folder" as const },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted">
              <Icon name={card.icon} size={11} /> {card.label}
            </div>
            <div className="mt-1 font-display text-lg font-bold text-softwhite">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px] text-muted">
        Audio stored:{" "}
        <span className="mono text-softwhite/80">
          {formatBytes((data?.totals.storage.audioBytes ?? 0) + (data?.totals.storage.exportBytes ?? 0))}
        </span>{" "}
        · uploaded files and exports on this machine. Admin account:{" "}
        <span className="mono text-softwhite/80">{data?.totals.admins ?? 0}</span>
      </div>

      {/* Search */}
      <div className="mt-4 flex items-center gap-2">
        <input
          className="field flex-1 text-xs"
          placeholder="Search name, email, handle or role…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Accounts */}
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <GlassCard>
            <p className="text-[11px] text-muted">
              {data ? "No account matches that search." : "Loading accounts…"}
            </p>
          </GlassCard>
        ) : null}

        {rows.map((entry) => {
          const stats = statsFor(entry.id);
          const suspended = Boolean(entry.suspendedAt);
          const isSelf = entry.id === user?.id;
          return (
            <GlassCard key={entry.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-violet/70 to-cyan/60 text-[10px] font-bold text-white">
                      {entry.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-softwhite">{entry.name}</span>
                    {isSelf ? <StatusPill tone="info">you</StatusPill> : null}
                    {entry.isAdmin ? (
                      <StatusPill tone="warning" icon="lock">
                        admin
                      </StatusPill>
                    ) : null}
                    {entry.emailVerified ? (
                      <StatusPill tone="success" icon="check">
                        verified
                      </StatusPill>
                    ) : (
                      <StatusPill tone="warning">unverified</StatusPill>
                    )}
                    {suspended ? <StatusPill tone="danger">suspended</StatusPill> : null}
                  </div>
                  <div className="mono mt-1 truncate text-[10px] text-muted">{entry.email}</div>
                  <div className="mt-0.5 text-[9px] text-muted/70">
                    {describeRoles(entry.roles as AccountRole[])} ·{" "}
                    {entry.provider ?? "password"} sign-in
                    {entry.handle ? ` · /u/${entry.handle}` : ""} · joined{" "}
                    {relativeTime(entry.createdAt)}
                    {entry.lastLoginAt ? ` · last seen ${relativeTime(entry.lastLoginAt)}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-muted/70">
                    <span>{stats?.projects ?? 0} projects</span>
                    <span>{stats?.assets ?? 0} files</span>
                    <span>{formatBytes(stats?.bytes ?? 0)}</span>
                    <span>{stats?.shares ?? 0} live shares</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {entry.emailVerified ? (
                    <button
                      type="button"
                      className="btn-ghost text-[10px]"
                      disabled={busy === `${entry.id}:Unverified`}
                      onClick={() =>
                        void act(entry.id, "Unverified", () =>
                          api.adminUpdateUser(entry.id, { emailVerified: false }),
                        )
                      }
                    >
                      <Icon name="x" size={10} /> Unverify
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost text-[10px]"
                      disabled={busy === `${entry.id}:Verified by hand`}
                      onClick={() =>
                        void act(entry.id, "Verified by hand", () =>
                          api.adminUpdateUser(entry.id, { emailVerified: true }),
                        )
                      }
                    >
                      <Icon name="check" size={10} /> Verify
                    </button>
                  )}

                  {suspended ? (
                    <button
                      type="button"
                      className="btn-ghost text-[10px]"
                      disabled={busy === `${entry.id}:Reinstated`}
                      onClick={() =>
                        void act(entry.id, "Reinstated", () =>
                          api.adminUpdateUser(entry.id, { suspended: false, suspendedReason: "" }),
                        )
                      }
                    >
                      <Icon name="undo" size={10} /> Reinstate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost text-[10px]"
                      disabled={isSelf || busy === `${entry.id}:Suspended`}
                      title={isSelf ? "You cannot suspend the admin account." : "End their sessions and block sign-in"}
                      onClick={() =>
                        void act(entry.id, "Suspended", () =>
                          api.adminUpdateUser(entry.id, {
                            suspended: true,
                            suspendedReason: "Suspended by the studio admin.",
                          }),
                        )
                      }
                    >
                      <Icon name="lock" size={10} /> Suspend
                    </button>
                  )}

                  <ConfirmButton
                    label="Delete"
                    confirmLabel="Delete account"
                    title={`Delete ${entry.name}?`}
                    description="This removes the account and every project, audio file, export and share link it owns. It cannot be undone."
                    danger
                    icon="trash"
                    onConfirm={async () => {
                      setBusy(`${entry.id}:Deleted`);
                      try {
                        await api.adminDeleteUser(entry.id);
                        await load();
                        await refresh();
                        notify("success", "Account deleted", `${entry.name} and its projects were removed.`);
                      } catch (err) {
                        notify("error", "Could not delete", (err as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Roles */}
              <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-white/[0.06] pt-2">
                <span className="text-[9px] uppercase tracking-wider text-muted/60">Roles</span>
                {ACCOUNT_ROLES.map((role) => {
                  const active = (entry.roles ?? []).includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={active}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[9px] transition-colors",
                        active
                          ? "border-violet/50 bg-violet/20 text-softwhite"
                          : "border-white/10 bg-white/[0.03] text-muted hover:text-softwhite",
                      )}
                      onClick={() => {
                        const next = active
                          ? (entry.roles ?? []).filter((r) => r !== role)
                          : [...(entry.roles ?? []), role];
                        void act(entry.id, `Roles: ${next.map((r) => ROLE_SHORT[r]).join(", ") || "none"}`, () =>
                          api.adminUpdateUser(entry.id, { roles: next as AccountRole[] }),
                        );
                      }}
                    >
                      {ROLE_SHORT[role]}
                    </button>
                  );
                })}
                {suspended && entry.suspendedReason ? (
                  <span className="ml-1 text-[9px] text-rose-200/80">{entry.suspendedReason}</span>
                ) : null}
              </div>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="mt-4">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-softwhite">
          <Icon name="info" size={11} /> What this console controls
        </div>
        <ul className="mt-1.5 space-y-1 text-[10px] leading-relaxed text-muted">
          <li>
            <span className="text-softwhite/90">Roles</span> decide which studios and dashboards an
            account gets. Changing them takes effect on that account&apos;s next page load.
          </li>
          <li>
            <span className="text-softwhite/90">Verify</span> is the manual fallback while no email
            provider is configured — nothing is emailed yet.
          </li>
          <li>
            <span className="text-softwhite/90">Suspend</span> blocks sign-in and kills existing
            sessions immediately, without deleting the account&apos;s work.
          </li>
          <li>
            <span className="text-softwhite/90">Delete</span> removes the account and all of its
            projects, audio, exports and share links from this server.
          </li>
        </ul>
        <p className="mt-2 text-[9px] leading-relaxed text-muted/60">
          The admin is always the address in <span className="mono">ADMIN_EMAIL</span>; it is derived on
          every request rather than stored, so it cannot be granted to another account by accident.
        </p>
      </GlassCard>
    </div>
  );
}
