"use client";

/**
 * Account settings.
 *
 * Shows who is signed in, lets them change their display name and password,
 * lists active sessions (device + dates, no IP addresses) and closes the
 * account for a non-owner member. The owner account cannot delete itself —
 * that would strand every other account and every project.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  ConfirmButton,
  GlassCard,
  SectionHeading,
  StatusPill,
} from "@/components/ui/primitives";
import { ApiError, api, type SessionSummary } from "@/lib/client/api";
import { useStudio } from "@/lib/client/studio";
import { relativeTime } from "@/lib/format";

export default function AccountPage() {
  const { user, signOut, notify } = useStudio();
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await api.me();
      setSessions(me.sessions);
      if (me.user) setName(me.user.name);
    } catch {
      /* The provider already redirects on 401. */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveName = async () => {
    setBusy("name");
    try {
      await api.updateMe({ name });
      await load();
      notify("success", "Name updated", "Friends will see this name on any link you share.");
    } catch (err) {
      notify("error", "Could not save your name", (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async () => {
    setBusy("password");
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      notify(
        "success",
        "Password changed",
        "Every device was signed out. Sign in again with the new password.",
      );
      await signOut();
    } catch (err) {
      notify("error", "Could not change the password", (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    setBusy("delete");
    try {
      await api.deleteAccount({ password: deletePassword });
      notify("success", "Account deleted", "Your projects, audio and share links were removed.");
      await signOut();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : (err as Error).message;
      notify("error", "Could not delete the account", message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-fluid-title font-display font-bold tracking-tight">My account</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            This account lives on your own studio server. There is no third-party sign-in and no
            verification email, because this build does not send mail.
          </p>
        </div>
        <StatusPill tone={user?.role === "owner" ? "info" : "neutral"} icon="user">
          {user?.role === "owner" ? "Studio owner" : "Member"}
        </StatusPill>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard accent="vocal">
          <SectionHeading
            eyebrow="Identity"
            title="Your details"
            description="The display name is what friends see on a shared listening page."
          />
          <div className="space-y-3">
            <div>
              <label className="label mb-1 block" htmlFor="account-name">
                Display name
              </label>
              <input
                id="account-name"
                className="field text-xs"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <div className="label mb-1">Email</div>
              <div className="mono rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[11px] text-softwhite">
                {user?.email ?? "—"}
              </div>
              <p className="mt-1 text-[9px] text-muted/70">
                Changing the email needs a real verification system; it is not offered yet rather than
                offered badly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-primary text-xs"
                onClick={() => void saveName()}
                disabled={busy === "name" || name.trim().length < 2}
              >
                <Icon name="save" size={13} /> Save name
              </button>
              {user?.lastLoginAt ? (
                <span className="text-[10px] text-muted">
                  Last sign-in {relativeTime(user.lastLoginAt)}
                </span>
              ) : null}
            </div>
          </div>
        </GlassCard>

        <GlassCard accent="mix">
          <SectionHeading
            eyebrow="Security"
            title="Change password"
            description="Changing it signs every device out, including this one."
          />
          <div className="space-y-3">
            <div>
              <label className="label mb-1 block" htmlFor="current-password">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                className="field text-xs"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </div>
            <div>
              <label className="label mb-1 block" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                className="field text-xs"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => void changePassword()}
              disabled={busy === "password" || current.length === 0 || next.length < 8}
            >
              <Icon name="lock" size={13} /> Update password
            </button>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionHeading
          eyebrow="Sessions"
          title="Where you are signed in"
          description="Device type and dates only — the studio never stores IP addresses."
          action={
            <button type="button" className="btn-subtle text-xs" onClick={() => void signOut()}>
              <Icon name="x" size={12} /> Sign out here
            </button>
          }
        />
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <div>
                <div className="text-[11px] text-softwhite">{session.device}</div>
                <div className="text-[9px] text-muted">
                  Started {relativeTime(session.createdAt)} · expires{" "}
                  {new Date(session.expiresAt).toLocaleDateString()}
                </div>
              </div>
              <span className="mono text-[9px] text-muted/60">{session.id}</span>
            </li>
          ))}
          {sessions.length === 0 ? (
            <li className="text-[10px] text-muted">No sessions recorded.</li>
          ) : null}
        </ul>
      </GlassCard>

      <GlassCard accent="neutral">
        <SectionHeading
          eyebrow="Danger zone"
          title="Close this account"
          description="Deletes your projects, audio, exports, voice profiles and share links. This cannot be undone."
        />
        {user?.role === "owner" ? (
          <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-[10px] leading-relaxed text-amber-100/85">
            This is the owner account. It cannot delete itself, because every other account and all
            projects would be orphaned. Remove the other accounts first, or delete the studio data
            from Settings.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label className="label mb-1 block" htmlFor="delete-password">
                Confirm with your password
              </label>
              <input
                id="delete-password"
                type="password"
                className="field text-xs"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </div>
            <ConfirmButton
              label="Delete my account"
              confirmLabel="Yes, delete everything"
              title="Delete this account?"
              description="Your projects, audio, exports, voice profiles and share links are removed from this server."
              icon="trash"
              onConfirm={() => void deleteAccount()}
            />
          </div>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Looking for the whole-studio wipe instead? It is in{" "}
          <Link href="/settings" className="underline hover:text-white">
            Settings → Storage
          </Link>{" "}
          and only clears data you own.
        </p>
      </GlassCard>
    </div>
  );
}
