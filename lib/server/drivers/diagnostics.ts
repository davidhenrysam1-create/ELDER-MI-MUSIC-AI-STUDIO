/**
 * Supabase diagnostics — the tests you can run from the Settings page.
 *
 * The checks are deliberately the same calls the studio makes for real (list the
 * bucket, read one row of the table), so a green result means the *actual* path
 * works rather than "the URL parses". Each check reports its own outcome and the
 * provider's message, because "401" and "404" mean different mistakes:
 *
 *   401 → the wrong key was pasted (publishable instead of secret, or rotated)
 *   404 → the bucket or table does not exist yet / has a different name
 *   400 → the bucket exists but its size limit is below the file, or bad request
 *
 * Nothing here writes: a probe that silently inserts rows into someone's
 * database is a surprise, not a test.
 */
import { supabaseConfig } from "./index";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ConnectionReport {
  configured: boolean;
  ok: boolean;
  checks: CheckResult[];
}

/** Translate a Supabase failure into the mistake it usually means. */
export function describeSupabaseFailure(status: number, body: string): string {
  const trimmed = body.slice(0, 200);
  if (status === 401 || status === 403) {
    return `Supabase rejected the key (${status}). Paste the secret key (sb_secret_… or service_role), not the publishable/anon key, and restart. ${trimmed}`;
  }
  if (status === 404) {
    return `Not found (404). Check the bucket and table names in .env.local match the dashboard exactly. ${trimmed}`;
  }
  if (status === 400) {
    return `Bad request (400). Usually a name mismatch or a bucket size limit below the file. ${trimmed}`;
  }
  return `Supabase answered ${status}. ${trimmed}`;
}

/** Run every check against the configured project. Never throws. */
export async function testSupabaseConnection(): Promise<ConnectionReport> {
  const config = supabaseConfig();
  if (!config) {
    return {
      configured: false,
      ok: false,
      checks: [
        {
          name: "Credentials",
          ok: false,
          detail:
            "SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are not both set to real values.",
        },
      ],
    };
  }
  const checks: CheckResult[] = [
    { name: "Credentials", ok: true, detail: `Project ${config.url}` },
  ];
  const auth = { apikey: config.key, Authorization: `Bearer ${config.key}` };

  // 1. Storage: list the bucket root. Proves the URL, the key and the bucket.
  try {
    const response = await fetch(
      `${config.url.replace(/\/+$/, "")}/storage/v1/object/list/${encodeURIComponent(config.bucket)}`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "", limit: 1, offset: 0 }),
      },
    );
    const body = await response.text().catch(() => "");
    checks.push({
      name: `Storage bucket "${config.bucket}"`,
      ok: response.ok,
      detail: response.ok
        ? "The bucket exists and the key may read it."
        : describeSupabaseFailure(response.status, body),
    });
  } catch (err) {
    checks.push({
      name: `Storage bucket "${config.bucket}"`,
      ok: false,
      detail: `Could not reach Supabase from this machine: ${(err as Error).message}. Check the internet connection or whether the project is paused.`,
    });
  }

  // 2. Database: read at most one row. Proves PostgREST and the table.
  try {
    const response = await fetch(
      `${config.url.replace(/\/+$/, "")}/rest/v1/${encodeURIComponent(config.table)}?select=id&limit=1`,
      { method: "GET", headers: auth },
    );
    const body = await response.text().catch(() => "");
    checks.push({
      name: `Database table "${config.table}"`,
      ok: response.ok,
      detail: response.ok
        ? "The table exists and the key may read it."
        : describeSupabaseFailure(response.status, body),
    });
  } catch (err) {
    checks.push({
      name: `Database table "${config.table}"`,
      ok: false,
      detail: `Could not reach Supabase from this machine: ${(err as Error).message}`,
    });
  }

  return { configured: true, ok: checks.every((check) => check.ok), checks };
}
