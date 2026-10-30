# Connect Supabase (bucket `tracks`, table `songs`)

This is the 5-minute version for the project in this studio's `.env.local`:

```
SUPABASE_URL=https://dddiqcpokwhctkhghqlj.supabase.co
SUPABASE_BUCKET=tracks
SUPABASE_TABLE=songs
```

You need **one** thing from the Supabase dashboard, and **two** things created in it.

---

## 1. The key this studio uses

Supabase now issues **two key formats**. Both are supported:

| Key | Where it goes | Used for |
| --- | --- | --- |
| `sb_secret_…` (new secret key) | `SUPABASE_SECRET_KEY` | Storage + database writes — **this is the one to use** |
| `service_role` JWT (`eyJhbGciOi…`, legacy) | `SUPABASE_SERVICE_ROLE_KEY` | Same, accepted for older projects |
| `sb_publishable_…` / `anon` | `SUPABASE_PUBLISHABLE_KEY` (optional) | Browser clients only — **cannot** be used for server writes |

If both secret values are present the newer `SUPABASE_SECRET_KEY` wins. A value that still looks like a
template (`paste_your_…`, `<your-key>`) is treated as **not set**, so it can never turn into a confusing
401 on every upload.

## 1b. Copy the secret key

Supabase → your project → **Project Settings → API keys** → copy the **secret** key
(`sb_secret_…` in the new dashboard, or `service_role` in the legacy one). Never the publishable/anon key.

Put it in `.env.local`:

```
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # optional, browser-only, never used to write
```

Restart the studio (`Ctrl+C`, then `npm run dev`). Settings → **Data on this studio** should flip from
*on this machine* to *off this machine*.

> **Why this key and not the publishable one:** the studio writes audio and the database from the server,
> so it needs write access. Secret keys bypass row-level security — keep them in `.env.local` only. They are
> never sent to the browser and never committed (`.gitignore` covers `.env.local`).

### If the network is down, the key is wrong, or the project is paused

The studio does **not** go blank. Reads and writes fall back to this machine's copy and Settings shows a
red card naming the failing seam and the real error (`fetch failed`, `401`, …). `durable` reports
`false` while that is happening — a degraded fallback is never counted as durable storage.

---

## 2. Create the table (SQL editor → paste → Run)

```sql
create table if not exists public.songs (
  id    text primary key,
  body  jsonb not null,
  rev   integer not null default 1
);

-- Only the service-role key may touch it; nobody reaches it with the anon key.
alter table public.songs enable row level security;
```

That is the whole schema. The studio keeps its projects in `body` as one JSON document and uses `rev`
so two writes cannot silently overwrite each other.

---

## 3. Create the bucket

Storage → **New bucket**

| Setting | Value |
| --- | --- |
| Name | `tracks` |
| Public bucket | **off** (private) |
| File size limit | whatever your largest stem needs (default 50 MB is fine) |

No policies are needed: the service-role key is not subject to row-level security, and the studio never
hands out public URLs — audio is streamed through its own authenticated endpoints.

---

## 4. Check it worked

```
curl -s http://localhost:3200/api/system | grep -o '"storageDrivers":{[^}]*' | head -c 400
```

You are looking for `"durable":true` and labels naming `tracks` and `songs`.

If the key is missing or wrong, the studio **keeps working on this machine's disk** and Settings shows a
red banner naming the exact variable — it never pretends the data reached Supabase, and it never refuses
to open.

---

## 5. Bring your existing audio up (optional)

Files recorded before this was configured are in `.data/`. They are not uploaded automatically. Either:

- keep `.data/` as the archive and carry on in Supabase with new material, or
- ask for the one-click "copy everything to the bucket" tool — it does a dry-run count first and needs
  the key from step 1 to be present.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Red banner: *SUPABASE_SERVICE_ROLE_KEY is missing* | step 1 not done, or the key is still the placeholder text |
| Red banner: *SUPABASE_URL is missing* | the URL line was deleted |
| `Supabase database read failed (401)` | the `anon` key was pasted instead of `service_role` |
| `Supabase database read failed (404)` | the table is not called `songs`, or step 2 was not run |
| `Supabase upload of audio/… failed (404)` | the bucket is not called `tracks`, or it is not private |
| `Supabase upload … failed (400)` | the bucket's file size limit is below the stem size |
