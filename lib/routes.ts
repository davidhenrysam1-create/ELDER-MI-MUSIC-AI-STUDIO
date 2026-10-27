/**
 * Route helpers shared by the client shell and the data provider.
 *
 * Kept in its own module (not `lib/client/studio`) so tests can mock the studio
 * context without also having to mock routing rules.
 */

/**
 * Screens that work without an account:
 *  - `/login`, `/signup`     — the way in;
 *  - `/admin-bootstrap`      — the one-time admin code, needed *before* a session;
 *  - `/s/<token>`            — a friend's shared listening page;
 *  - `/u/<handle>`           — a public profile and its published music;
 *  - `/offline`              — the service-worker fallback.
 *
 * These render without the studio chrome and never fetch studio data.
 * `/welcome` and `/admin` are **not** here: they need a session, so the shell's
 * auth guard must run for them.
 */
export const PUBLIC_PATHS = ["/login", "/signup", "/admin-bootstrap", "/offline"] as const;
export const PUBLIC_PREFIXES = ["/s/", "/u/"] as const;

export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if ((PUBLIC_PATHS as readonly string[]).includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
