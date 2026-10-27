"use client";

/**
 * Account settings.
 *
 * Shows who is signed in, lets them change their display name, roles, public
 * profile (handle, bio, AudioMack / Instagram / Facebook links) and password,
 * lists active sessions (device + dates, no IP addresses) and closes the account
 * for a non-owner member. The owner account cannot delete itself — that would
 * strand every other account and every project.
 *
 * Email verification is shown honestly: the button exists, and if no mail
 * provider is configured the answer says exactly that instead of "check your
 * inbox".
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  ConfirmButton,
  GlassCard,
  SectionHeading,
  StatusPill,
  cn,
} from "@/components/ui/primitives";
import { ApiError, api, type SessionSummary } from "@/lib/client/api";
import { useStudio } from "@/lib/client/studio";
import { relativeTime } from "@/lib/format";
import {
  ACCOUNT_ROLES,
  LINK_PLATFORMS,
  PLATFORM_LABEL,
  ROLE_DESCRIPTION,
  ROLE_SHORT,
  describeRoles,
} from "@/lib/roles";
import type { AccountRole, ProfileLinks } from "@/lib/types";

const EMPTY_LINKS: ProfileLinks = { audiomack: "", instagram: "", facebook: "" };

export default function AccountPage() {
  const { user, signOut, notify, refresh } = useStudio();
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Profile / roles
  const [roles, setRoles] = useState<AccountRole[]>([]);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<ProfileLinks>(EMPTY_LINKS);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await api.me();
      setSessions(me.sessions);
      if (me.user) {
        setName(me.user.name);
        setRoles((me.user.roles ?? []) as AccountRole[]);
        setHandle(me.user.handle ?? "");
        setBio(me.user.bio ?? "");
        setLinks({ ...EMPTY_LINKS, ...(me.user.links ?? {}) });
        setEmailVerified(me.user.emailVerified === true);
      }
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
      await refresh();
      notify("success", "Name updated", "Friends will see this name on any link you share.");
    } catch (err) {
      notify("error", "Could not save your name", (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = async () => {
    setBusy("profile");
    try {
      await api.updateMe({ roles, handle, bio, links });
      await load();
      await refresh();
      notify(
        "success",
        "Profile saved",
        "Your dashboard follows your roles from the next page you open.",
      );
    } catch (err) {
      notify("error", "Could not save the profile", (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sendVerification = async () => {
    setBusy("verify");
    setVerifyNote(null);
    try {
      const result = await api.sendVerification();
      if (result.sent) {
        notify("success", "Verification email sent", "The link works for 24 hours.");
        setVerifyNote("A verification email is on its way. The link lasts 24 hours.");
      } else {
        // The honest branch: no provider, so nothing was sent.
        setVerifyNote(`${result.reason ?? "No email was sent."} ${result.hint ?? ""}`.trim());
      }
    } catch (err) {
      setVerifyNote(err instanceof ApiError ? err.message : (err as Error).message);
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

  const toggleRole = (role: AccountRole) =>
    setRoles((current) =>
      current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role],
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-fluid-title font-display font-bold tracking-tight">My account</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            This account lives on your own studio server. Sign in with email and password, or with
            Google once it is configured. Your roles decide which studios and dashboards you get.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill tone="info" icon="user">
            {describeRoles(user?.roles as AccountRole[])}
          </StatusPill>
          <StatusPill tone={user?.role === "owner" ? "info" : "neutral"}>
            {user?.role === "owner" ? "Studio owner" : "Member"}
          </StatusPill>
          {user?.isAdmin ? (
            <StatusPill tone="warning" icon="lock">
              admin
            </StatusPill>
          ) : null}
        </div>
      </div>

      {/* Roles + public profile */}
      <GlassCard accent="vocal">
        <SectionHeading
          eyebrow="Dashboard & profile"
          title="What you do here"
          description="Pick every role that fits you. Producers and engineers get the full studio; artists and promoters get publishing tools."
          action={
            user?.isAdmin ? (
              <Link href="/admin" className="btn-subtle text-xs">
                <Icon name="lock" size={12} /> Admin console
              </Link>
            ) : undefined
          }
        />

        <div className="flex flex-wrap gap-1.5">
          {ACCOUNT_ROLES.map((role) => {
            const active = roles.includes(role);
            return (
              <button
                key={role}
                type="button"
                aria-pressed={active}
                title={ROLE_DESCRIPTION[role]}
                onClick={() => toggleRole(role)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                  active
                    ? "border-violet/50 bg-violet/20 text-softwhite"
                    : "border-white/10 bg-white/[0.03] text-muted hover:text-softwhite",
                )}
              >
                {active ? "✓ " : ""}
                {ROLE_SHORT[role]}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label mb-1 block" htmlFor="account-handle">
              Public handle
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted">/u/</span>
              <input
                id="account-handle"
                className="field text-xs"
                value={handle}
                onChange={(event) => setHandle(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                placeholder="not set"
                maxLength={20}
              />
            </div>
            {handle ? (
              <Link
                href={`/u/${handle}`}
                className="mt-1 inline-flex items-center gap-1 text-[9px] text-cyan-200 hover:text-white"
              >
                <Icon name="eye" size={9} /> View your public page
              </Link>
            ) : (
              <p className="mt-1 text-[9px] text-muted/70">
                A handle gives you a public page at /u/yourname. Leave it empty to stay unlisted.
              </p>
            )}
          </div>

          <div>
            <label className="label mb-1 block" htmlFor="account-email">
              Email
            </label>
            <div className="mono flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[11px] text-softwhite">
              <span className="truncate">{user?.email ?? "—"}</span>
              <StatusPill tone={emailVerified ? "success" : "warning"}>
                {emailVerified ? "verified" : "unverified"}
              </StatusPill>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="btn-ghost text-[10px]"
                onClick={() => void sendVerification()}
                disabled={busy === "verify" || emailVerified}
              >
                <Icon name="check" size={10} />
                {busy === "verify" ? "Sending…" : "Send verification"}
              </button>
              <span className="text-[9px] text-muted/70">
                {user?.provider === "google"
                  ? "Google addresses are verified by Google."
                  : "Manual verification is available from the admin console."}
              </span>
            </div>
            {verifyNote ? (
              <p className="mt-1.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2 py-1.5 text-[9px] leading-relaxed text-amber-100/85">
                {verifyNote}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3">
          <label className="label mb-1 block" htmlFor="account-bio">
            Bio
          </label>
          <textarea
            id="account-bio"
            className="field min-h-[64px] text-xs"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={400}
            placeholder="Where you record, who you work with, what you are releasing next."
          />
          <div className="mt-0.5 text-right text-[9px] text-muted/60">{bio.length}/400</div>
        </div>

        <div className="mt-2">
          <div className="label mb-1">Links (used on your public page)</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {LINK_PLATFORMS.map((platform) => (
              <div key={platform}>
                <label className="mb-1 block text-[9px] text-muted" htmlFor={`link-${platform}`}>
                  {PLATFORM_LABEL[platform]}
                </label>
                <input
                  id={`link-${platform}`}
                  className="field text-[11px]"
                  value={links[platform]}
                  onChange={(event) =>
                    setLinks((current) => ({ ...current, [platform]: event.target.value }))
                  }
                  placeholder={`https://${platform}.com/you`}
                />
              </div>
            ))}
          </div>
          <p className="mt-1 text-[9px] text-muted/70">
            Only <span className="mono">https://</span> links are accepted, and only these three
            platforms — nothing else is embedded or tracked.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={() => void saveProfile()}
            disabled={busy === "profile"}
          >
            <Icon name="save" size={13} /> {busy === "profile" ? "Saving…" : "Save profile"}
          </button>
          <button
            type="button"
            className="btn-subtle text-xs"
            onClick={() => void saveName()}
            disabled={busy === "name" || name.trim().length < 2}
          >
            <Icon name="user" size={12} /> Save display name
          </button>
          {user?.lastLoginAt ? (
            <span className="text-[10px] text-muted">
              Last sign-in {relativeTime(user.lastLoginAt)}
            </span>
          ) : null}
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard accent="mix">
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
                Changing the email needs a working verification system; it is not offered yet rather
                than offered badly.
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
            </div>
          </div>
        </GlassCard>

        <GlassCard accent="neutral">
          <SectionHeading
            eyebrow="Security"
            title="Change password"
            description="Changing it signs every device out, including this one."
          />
          {user?.provider === "google" && !user?.role ? null : null}
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
            <p className="text-[9px] leading-relaxed text-muted/70">
              Accounts created with Google have no password until one is set here — Google sign-in
              keeps working either way.
            </p>
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
