# Connect Supabase (bucket `tracks`, table `songs`)

This is the 5-minute version for the project in this studio's `.env.local`:

```
SUPABASE_URL=https://dddiqcpokwhctkhghqlj.supabase.co
SUPABASE_BUCKET=tracks
SUPABASE_TABLE=songs
```

You need **one** thing from the Supabase dashboard, and **two** things created in it.

---

## 1. Copy the service-role key (the only value still missing)

Supabase → your project → **Project Settings → API → Project API keys** → copy the value labelled
**`service_role`** (it is the long secret, *not* the `anon` one).

Put it in `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   ← the long string
```

Restart the studio (`Ctrl+C`, then `npm run dev`). Settings → **Data on this studio** should flip from
*on this machine* to *off this machine*.

> **Why this key and not `anon`:** the studio writes audio and the database from the server, so it needs
> write access. The service-role key bypasses row-level security — keep it in `.env.local` only. It is
> never sent to the browser and never committed (`.gitignore` covers `.env.local`).

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
