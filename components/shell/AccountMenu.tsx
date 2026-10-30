"use client";

/**
 * The account icon in the top-right corner of the studio header.
 *
 * Why it exists: the header used to show a static chip reading "EM · Studio
 * owner · local". It looked like an account control but was decoration — the
 * initials were hardcoded, it could not be clicked, it was hidden on phones, and
 * if several people signed in it told every one of them the same thing.
 *
 * This is the real control:
 *  - a round avatar with the account's initials, always visible (phones too);
 *  - clicking it opens a short menu with the account it belongs to — name,
 *    address and roles, read from the signed-in session;
 *  - **My account**, **Admin console** (only for the admin), and **Sign out**;
 *  - when nobody is signed in (only reachable in open-studio mode, where there is
 *    no login screen) it becomes a plain **Sign in** link instead of pretending.
 *
 * Nothing is inferred: every line in the menu comes from the session the server
 * returned, so it cannot show a role or a name that is not really on the account.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { describeRoles } from "@/lib/roles";
import type { AccountUser } from "@/lib/client/api";

/**
 * Two initials from a display name, falling back to the email address.
 *
 * "Elder Mi" → "EM", "davidhenrysam1@gmail.com" → "DH". Single-word names give
 * one letter; anything unparseable gives a question mark rather than a blank
 * circle.
 */
export function initialsFor(user: Pick<AccountUser, "name" | "email"> | null): string {
  if (!user) return "?";
  const words = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1 && words[0].length > 0) {
    // A single word: take the first two letters if it looks like a word, else one.
    return words[0].slice(0, 2).toUpperCase();
  }
  const local = (user.email ?? "").split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "?";
}

export function AccountMenu({
  user,
  openStudio,
  onSignOut,
  loading = false,
}: {
  /** The signed-in account, or null when the studio has no session. */
  user: AccountUser | null;
  /** Open-studio mode: no login screen exists, so "Sign out" is not offered. */
  openStudio: boolean;
  /** Sign out and return to the sign-in screen (ignored in open studio). */
  onSignOut?: () => void;
  /**
   * The session is still being read. Shown as a neutral placeholder: without
   * this, a signed-in owner sees a "Sign in" link for the fraction of a second
   * before `/api/auth/me` answers, which looks like being logged out.
   */
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  // Close on an outside click and on Escape, so the menu never traps the page.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Still loading: a placeholder with the right size, so the header does not
  // jump and nothing claims to know who is signed in before the answer arrives.
  if (loading) {
    return (
      <span
        aria-label="Loading account"
        className="block h-9 w-9 animate-pulse rounded-full border border-white/10 bg-white/[0.06]"
      />
    );
  }

  // Signed out: a single honest link. There is nowhere else to go without a
  // session, so no menu is drawn.
  if (!user) {
    return (
      <Link
        href="/login"
        aria-label="Sign in"
        className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-muted transition-colors hover:text-softwhite"
      >
        <Icon name="user" size={16} />
      </Link>
    );
  }

  const roles = describeRoles(user.roles ?? []);

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        /* Always visible: on a phone this is the only account control. */
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] p-0.5 pr-1 transition-colors hover:border-white/25 hover:bg-white/[0.1]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet via-magenta to-cyan text-[11px] font-bold text-white">
          {initialsFor(user)}
        </span>
        <Icon name="chevronDown" size={12} className="hidden text-muted sm:block" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="glass-strong absolute right-0 top-11 z-30 w-64 animate-rise rounded-xl p-3"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet via-magenta to-cyan text-[12px] font-bold text-white">
              {initialsFor(user)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-softwhite">{user.name}</div>
              <div className="truncate text-[10px] text-muted">{user.email}</div>
              <div className="truncate text-[10px] text-violet-200/70">
                {roles}
                {user.isAdmin ? " · admin" : ""}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <Link
              role="menuitem"
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-muted transition-colors hover:bg-white/[0.06] hover:text-softwhite"
            >
              <Icon name="user" size={12} />
              {openStudio ? "Studio profile" : "My account"}
            </Link>
            {user.isAdmin ? (
              <Link
                role="menuitem"
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-muted transition-colors hover:bg-white/[0.06] hover:text-softwhite"
              >
                <Icon name="lock" size={12} />
                Admin console
              </Link>
            ) : null}
            {openStudio ? null : (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSignOut?.();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-muted transition-colors hover:bg-white/[0.06] hover:text-rose-200"
              >
                <Icon name="x" size={12} />
                Sign out
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
