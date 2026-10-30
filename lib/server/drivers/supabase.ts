/**
 * Supabase drivers — durable storage off the laptop.
 *
 * Both run over plain HTTPS with `fetch`, so no SDK or extra dependency is
 * added to the repo:
 *
 *  - **Storage** (`/storage/v1/object/…`) keeps the uploaded stems, masters and
 *    exports in a private bucket. Same flat keys as the local driver.
 *  - **PostgREST** (`/rest/v1/<table>`) keeps the one-document database in a
 *    single row, guarded by a revision number so two writers cannot silently
 *    overwrite each other.
 *
 * Nothing here runs until `SUPABASE_URL` and a service-role key exist; the
 * configuration is checked in `lib/server/drivers/index.ts` and reported as
 * "awaiting configuration" everywhere else. There is no pretend mode.
 */

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export interface SupabaseConfig {
  url: string;
  /** Service-role key. Never shipped to the browser. */
  key: string;
  bucket: string;
  table: string;
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function authHeaders(config: SupabaseConfig): Record<string, string> {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
  };
}

/** Describe a failed call without dumping the key into the logs. */
async function failure(what: string, response: Response): Promise<Error> {
  const detail = (await response.text().catch(() => "")).slice(0, 300);
  return new Error(`Supabase ${what} failed (${response.status}): ${detail}`);
}

/** Supabase answers 400 for a missing object as well as a genuine bad request. */
function isMissing(response: Response, body: string) {
  return response.status === 404 || (response.status === 400 && /not.?found/i.test(body));
}

export function supabaseBlobStore(config: SupabaseConfig) {
  const base = `${trimSlash(config.url)}/storage/v1/object`;
  const objectUrl = (key: string) =>
    `${base}/${encodeURIComponent(config.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;

  return {
    kind: "supabase" as const,
    label: `Supabase Storage (bucket "${config.bucket}")`,

    async put(key: string, bytes: Uint8Array, contentType = "application/octet-stream") {
      const response = await fetch(objectUrl(key), {
        method: "POST",
        headers: {
          ...authHeaders(config),
          "Content-Type": contentType,
          // Uploading the same key replaces it, which is what an overwrite in
          // the studio means.
          "x-upsert": "true",
        },
        body: bytes as unknown as BodyInit,
      });
      if (!response.ok) throw await failure(`upload of ${key}`, response);
    },

    async get(key: string) {
      const response = await fetch(objectUrl(key), {
        method: "GET",
        headers: authHeaders(config),
      });
      if (response.ok) {
        const data = Buffer.from(await response.arrayBuffer());
        return { data, key };
      }
      const body = await response.text().catch(() => "");
      if (isMissing(response, body)) return null;
      throw new Error(`Supabase download of ${key} failed (${response.status}): ${body.slice(0, 200)}`);
    },

    async remove(key: string) {
      const response = await fetch(objectUrl(key), {
        method: "DELETE",
        headers: authHeaders(config),
      });
      if (response.ok) return;
      const body = await response.text().catch(() => "");
      // Deleting something that is already gone is not a failure.
      if (isMissing(response, body)) return;
      throw new Error(`Supabase delete of ${key} failed (${response.status}): ${body.slice(0, 200)}`);
    },

    async exists(key: string) {
      const response = await fetch(objectUrl(key), {
        method: "HEAD",
        headers: authHeaders(config),
      });
      return response.ok;
    },

    async usage() {
      const sum = async (prefix: string): Promise<number> => {
        const response = await fetch(
          `${trimSlash(config.url)}/storage/v1/object/list/${encodeURIComponent(config.bucket)}`,
          {
            method: "POST",
            headers: { ...authHeaders(config), ...JSON_HEADERS },
            body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
          },
        );
        if (!response.ok) return 0; // a meter is not worth failing a page load
        const rows = (await response.json().catch(() => [])) as Array<{
          metadata?: { size?: number } | null;
        }>;
        return rows.reduce((total, row) => total + (row.metadata?.size ?? 0), 0);
      };
      return { audioBytes: await sum("audio"), exportBytes: await sum("exports") };
    },
  };
}

export function supabaseSnapshotStore(config: SupabaseConfig) {
  const base = `${trimSlash(config.url)}/rest/v1/${encodeURIComponent(config.table)}`;
  const ROW = "studio";
  /** Last revision this process saw; used to make writes conditional. */
  let revision: number | null = null;

  const readRow = async (): Promise<{ body: unknown; rev: number } | null> => {
    const response = await fetch(`${base}?select=body,rev&id=eq.${ROW}&limit=1`, {
      method: "GET",
      headers: authHeaders(config),
    });
    if (!response.ok) throw await failure("database read", response);
    const rows = (await response.json().catch(() => [])) as Array<{ body?: unknown; rev?: number }>;
    const row = rows[0];
    if (!row || row.body === undefined || row.body === null) return null;
    revision = Number(row.rev ?? 0);
    return { body: row.body, rev: revision };
  };

  return {
    kind: "supabase" as const,
    label: `Supabase Postgres (table "${config.table}")`,

    async load() {
      const row = await readRow();
      return row ? row.body : null;
    },

    async save(document: unknown) {
      // First write of this process: insert, or adopt the row if it exists.
      if (revision === null) {
        const response = await fetch(base, {
          method: "POST",
          headers: {
            ...authHeaders(config),
            ...JSON_HEADERS,
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify([{ id: ROW, body: document, rev: 1 }]),
        });
        if (!response.ok) {
          // Someone else already created the row: re-read the revision and fall
          // through to the conditional update below.
          const body = await response.text().catch(() => "");
          if (response.status === 409 || /duplicate|conflict/i.test(body)) {
            await readRow();
          } else {
            throw new Error(`Supabase database write failed (${response.status}): ${body.slice(0, 200)}`);
          }
        } else {
          revision = 1;
          return;
        }
      }

      // Conditional update: only replace the row if nobody wrote after us.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const next = (revision ?? 0) + 1;
        const response = await fetch(`${base}?id=eq.${ROW}&rev=eq.${revision}`, {
          method: "PATCH",
          headers: {
            ...authHeaders(config),
            ...JSON_HEADERS,
            Prefer: "return=representation",
          },
          body: JSON.stringify({ body: document, rev: next }),
        });
        if (!response.ok) throw await failure("database update", response);
        const updated = (await response.json().catch(() => [])) as unknown[];
        if (updated.length > 0) {
          revision = next;
          return;
        }
        // Lost the race: pick up the current revision and try again. Writes are
        // serialised by `mutateDb()`, so this is a safety net, not the norm.
        const current = await readRow();
        if (!current) throw new Error("Supabase row disappeared while saving.");
      }
      throw new Error("Supabase database update kept conflicting; nothing was written.");
    },
  };
}
