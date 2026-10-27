/**
 * Roles → capability mapping.
 *
 * One file decides what each account type may open, so the navigation, the
 * dashboards and the API guards cannot drift apart. Any component may import
 * this (it has no server dependencies).
 *
 * The mapping the studio ships with:
 *
 *   artist    vocal recording + publishing/promotion tools
 *   producer  the full studio: vocal, mix, mastering, beat upload for sampling
 *   engineer  the same studio tools as a producer
 *   promoter  publishing and promotion surfaces only
 *   admin     everything, plus the admin console (all accounts, moderation)
 *
 * A person may hold several roles at once ("Both"), which is why roles are an
 * array. An account with no role yet is sent to `/welcome` to choose one.
 */
import type { AccountRole, StudioId } from "@/lib/types";

export const ACCOUNT_ROLES: AccountRole[] = ["artist", "producer", "engineer", "promoter"];

export const ROLE_LABEL: Record<AccountRole, string> = {
  artist: "Artist",
  producer: "Producer / beat maker",
  engineer: "Mixing & mastering engineer",
  promoter: "Promoter",
};

export const ROLE_SHORT: Record<AccountRole, string> = {
  artist: "Artist",
  producer: "Producer",
  engineer: "Engineer",
  promoter: "Promoter",
};

export const ROLE_DESCRIPTION: Record<AccountRole, string> = {
  artist:
    "Record and layer vocals, publish songs, and promote them. No mixer or mastering chain.",
  producer:
    "Everything a studio needs: vocal layering, mixing, mastering, and uploading beats for sampling.",
  engineer:
    "Mixing and mastering tools for other people's sessions, plus vocal cleanup.",
  promoter:
    "Post and promote releases, track plays and shares. No studio processing tools.",
};

/** Streaming and social platforms a profile can link to. */
export const LINK_PLATFORMS = ["audiomack", "instagram", "facebook"] as const;
export const PLATFORM_LABEL: Record<(typeof LINK_PLATFORMS)[number], string> = {
  audiomack: "AudioMack",
  instagram: "Instagram",
  facebook: "Facebook",
};

/** Roles allowed to run each studio. */
export const STUDIO_ROLES: Record<StudioId, AccountRole[]> = {
  vocal: ["artist", "producer", "engineer"],
  mix: ["producer", "engineer"],
  mastering: ["producer", "engineer"],
};

/** True when the account may open a studio's tools (admins always can). */
export function canUseStudio(
  roles: AccountRole[] | undefined,
  studio: StudioId,
  isAdmin = false,
): boolean {
  if (isAdmin) return true;
  const held = roles ?? [];
  return STUDIO_ROLES[studio].some((role) => held.includes(role));
}

/** The studio ids this account can open. */
export function studiosForRoles(roles: AccountRole[] | undefined, isAdmin = false): StudioId[] {
  const all: StudioId[] = ["vocal", "mix", "mastering"];
  return all.filter((studio) => canUseStudio(roles, studio, isAdmin));
}

/** Publishing/promotion is open to artists and promoters (producers publish beats). */
export function canPublish(roles: AccountRole[] | undefined, isAdmin = false): boolean {
  if (isAdmin) return true;
  const held = roles ?? [];
  return (["artist", "promoter", "producer"] as AccountRole[]).some((role) => held.includes(role));
}

/** Admins see every account and every project. */
export function canAdminister(isAdmin: boolean | undefined): boolean {
  return isAdmin === true;
}

/** Human summary: "Artist & Producer", or "No role chosen yet". */
export function describeRoles(roles: AccountRole[] | undefined): string {
  const held = ACCOUNT_ROLES.filter((role) => (roles ?? []).includes(role));
  if (held.length === 0) return "No role chosen yet";
  if (held.length === 1) return ROLE_SHORT[held[0]];
  const names = held.map((role) => ROLE_SHORT[role]);
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/**
 * Where each account type lands after signing in.
 *
 * Producers and engineers go straight to the studio dashboard; artists and
 * promoters get the publish-oriented home. Everyone can still navigate to what
 * their roles allow.
 */
export function homeForRoles(roles: AccountRole[] | undefined, isAdmin = false): string {
  if (isAdmin) return "/";
  const held = roles ?? [];
  if (held.length === 0) return "/welcome";
  if (held.includes("producer") || held.includes("engineer")) return "/";
  return "/";
}

/** Sites and routes a role may open; used by the shell and the page guards. */
export const ROLE_ROUTES: Record<AccountRole, string[]> = {
  artist: ["/vocal", "/publish", "/shares"],
  producer: ["/vocal", "/mix", "/mastering", "/publish", "/shares"],
  engineer: ["/vocal", "/mix", "/mastering", "/shares"],
  promoter: ["/publish", "/shares"],
};

/** True when the account may open a studio route. */
export function canOpenRoute(
  pathname: string,
  roles: AccountRole[] | undefined,
  isAdmin = false,
): boolean {
  if (isAdmin) return true;
  if (pathname === "/") return true;
  if (pathname.startsWith("/projects")) return true;
  if (pathname.startsWith("/voice-profiles")) return canUseStudio(roles, "vocal");
  if (pathname.startsWith("/exports")) return true;
  if (pathname.startsWith("/publish")) return canPublish(roles);
  if (pathname.startsWith("/shares")) return true;
  if (pathname.startsWith("/account") || pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/docs") || pathname.startsWith("/help")) return true;
  if (pathname.startsWith("/mix")) return canUseStudio(roles, "mix");
  if (pathname.startsWith("/mastering")) return canUseStudio(roles, "mastering");
  if (pathname.startsWith("/vocal")) return canUseStudio(roles, "vocal");
  return true;
}
