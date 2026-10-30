# Free hosting for testing

A **public link** you can open on any phone or laptop, for testing — no card, no
server to look after, about **5 minutes** of clicking.

This guide is written to be followed literally, in order. Nothing here costs
money, and nothing here asks you to install anything.

---

## First, two honest facts

**1. Free hosting cannot keep your music on its own disk.**
Free plans either have no disk at all or wipe it on every restart. That is the
one thing you must plan around, so this guide uses **Supabase** (already free) as
the place the audio and the database really live. The app was built for exactly
this: if Supabase is configured, the free host just runs the screens and Supabase
keeps the files. If it is not configured, the studio still runs and **Settings
says plainly that the disk is temporary** — it will not pretend your uploads are
safe.

**2. A free instance sleeps.**
After about 15 minutes with no visitors it shuts down, and the next visit waits
roughly 50 seconds for it to wake up. That is normal for a free tier, not a fault.

**Shortcuts** — these open the host's import screen with this repository
pre-selected:

- Render: <https://render.com/deploy?repo=https://github.com/davidhenrysam1-create/ELDER-MI-MUSIC-AI-STUDIO>
- Vercel: <https://vercel.com/new/clone?repository-url=https://github.com/davidhenrysam1-create/ELDER-MI-MUSIC-AI-STUDIO>

You still have to sign in to that host yourself — no one else can create the
account for you, and no password should ever be typed into a chat.

---

## What you need before starting

| Thing | Where | Notes |
|---|---|---|
| This GitHub repository | already yours | Must be **public** for the free tiers below |
| A Supabase project | [supabase.com](https://supabase.com) | Free. The `songs` table and `tracks` bucket are described in [SUPABASE-SETUP.md](SUPABASE-SETUP.md) |
| Your studio password | you choose it | Used to sign in to the public link |

---

## Option A — Render (recommended)

Chosen because it runs the app as a normal server: **uploads are not size-limited**,
which matters for a music app.

### Steps

1. Go to **[render.com](https://render.com)** and click **Get Started**.
2. Choose **GitHub**, approve access, and let it see this repository.
3. In the Render dashboard click **New +** → **Blueprint**.
4. Pick the repository `ELDER-MI-MUSIC-AI-STUDIO` and click **Connect**.
5. Render reads `render.yaml` from the repo and shows one service,
   *elder-mi-music-ai-studio*, on the **Free** plan. Click **Apply**.
6. Render asks for the values marked "sync: false". Fill these in:

   | Key | What to type |
   |---|---|
   | `ADMIN_EMAIL` | your sign-in email |
   | `ADMIN_PASSWORD` | a password you choose (not your Supabase key) |
   | `SUPABASE_URL` | from Supabase → Settings → API |
   | `SUPABASE_SECRET_KEY` | the **secret** key (starts `sb_secret_`), never the publishable one |
   | `NEXT_PUBLIC_SITE_URL` | leave blank for now — set it after step 8 |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `GOOGLE_API_KEY` | leave blank; these are optional |

7. Click **Apply** / **Deploy**. The first build takes **5–10 minutes** (it builds
   the Docker image). The log ends with `Listening on 0.0.0.0:3000` and the
   service turns **Live**.
8. Copy the address it gives you, for example
   `https://elder-mi-music-ai-studio.onrender.com`.
9. Go to **Environment** → edit `NEXT_PUBLIC_SITE_URL` → paste that address →
   **Save**. Render redeploys by itself; this makes share links and emails point
   at the public site instead of `localhost`.

### Check it worked

Open these three, in order:

1. `https://<your-address>/api/health` → shows `{"ok":true,...}`.
   If this one fails, nothing else will work — the server itself is down.
2. `https://<your-address>/` → the studio loads.
3. `https://<your-address>/settings` → **Storage** says **Supabase**, not
   "this machine's disk". If it says the disk is temporary, the Supabase values
   are wrong or the `songs` table does not exist yet.

### Signing in for the first time

There is **no code and nothing to look up**. The site asks for an email and a
password, and those are exactly the two values you set in step 6:

- **Email:** your `ADMIN_EMAIL`
- **Password:** your `ADMIN_PASSWORD`

The first successful sign-in **creates** the owner account — with every role and
the admin console — so a brand-new deployment needs no extra step at all. After
that the stored password is what counts: change it in **My account** and the
`ADMIN_PASSWORD` value stops being used for sign-in.

**Why this also rescues a free deployment:** if the instance restarts and wipes
its temporary data (no Supabase configured), the account disappears with it. Sign
in again with the same two values and it is recreated instantly — your way in
never breaks, even though the storage did.

> If sign-in says *"No owner account can be created yet"*, the host is missing
> `ADMIN_PASSWORD` (it must be 8+ characters). Add it in the **Environment** tab
> and redeploy. If it says the password does not match, the value differs from
> what you typed — check for a trailing space.

### Updating the site later

Nothing to do. Every push to `main` redeploys automatically (`autoDeploy: true`).
To publish deliberately, set `autoDeploy: false` in `render.yaml` and use
**Manual Deploy**.

### Stopping the service

Dashboard → the service → **Settings** → **Suspend**. It stops using your free
hours and keeps the configuration, so you can resume it any time.

---

## Option B — Vercel (fastest, but read the catch)

Vercel deploys in about **60 seconds** and is excellent for showing the
interface. It is **not** the best place for a working music studio, because it
limits each request body to about **4.5 MB** — a full song or a stem will usually
be larger, so those uploads will fail with a size error. Short clips and every
screen work fine.

1. Go to **[vercel.com/new](https://vercel.com/new)** and sign in with GitHub.
2. **Import** `ELDER-MI-MUSIC-AI-STUDIO`. The framework is detected as Next.js;
   leave the build settings alone.
3. Open **Environment Variables** and add:

   ```
   ADMIN_EMAIL            your sign-in email
   ADMIN_PASSWORD         a password you choose
   NEXT_PUBLIC_SITE_URL   https://<project>.vercel.app   (edit after the first deploy)
   SUPABASE_URL           https://<ref>.supabase.co
   SUPABASE_SECRET_KEY    sb_secret_...
   SUPABASE_BUCKET        tracks
   SUPABASE_TABLE         songs
   STORAGE_DRIVER         supabase
   DATABASE_DRIVER        supabase
   ```

4. Click **Deploy**. Then open `https://<project>.vercel.app/api/health` — it
   should answer `{"ok":true,...}`.

Vercel has **no disk at all**, so Supabase is required: without it the studio
runs but anything you save disappears on the next request.

---

## Which host should you pick?

| | **Render free** | **Vercel free** |
|---|---|---|
| Cost | Free | Free |
| Card needed | No | No |
| Public HTTPS link | Yes | Yes |
| Upload size limit | None | ~4.5 MB per request |
| Sleeps when idle | Yes, ~15 min | No |
| Disk | None (use Supabase) | None (use Supabase) |
| Time to first deploy | 5–10 min | ~1 min |
| Best for | **Actually using the studio** | Showing the interface |

Both need Supabase if you want to keep music. Render is the one to use for a
real test of the whole app.

---

## Locking the public link

A public URL is reachable by anyone who has it. Before you share the address:

- **Keep `STUDIO_ACCOUNTS=on`.** `render.yaml` already sets it. That brings back
  the sign-in screen, so visitors cannot reach your projects, settings, exports
  or the admin console.
- **Set `ADMIN_PASSWORD`** to something you have not used anywhere else.
- **Set `ALLOW_SIGNUP=false`** if the site is only for you. That closes new
  accounts **including through Google** — otherwise anybody with a Google account
  who has your link can create one. Your own `ADMIN_EMAIL` can always sign in, so
  you cannot lock yourself out. Leave it out if friends should be able to join.
- **Never put the Supabase secret key in a message, screenshot or commit.** It
  belongs only in the host's environment-variable field.

If you would rather protect the *whole* site with one shared password (a browser
pop-up, no accounts), set `STUDIO_PASSWORD` in the host's environment. The health
check still works with it enabled, so the platform will not mark the service
unhealthy.

Without accounts, a deployment runs in **open studio** mode, where whoever opens
the link is effectively the owner. That is fine on your own laptop and wrong on a
public address.

---

## If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| Build fails, log mentions `npm ci` or `package-lock.json` | The lockfile is missing from the commit | It is committed; make sure you deployed `main`, not an older branch |
| Deploy succeeds, `/api/health` fails | The app is not starting | Open **Logs** and read the first error; usually a missing `NODE_ENV=production` or a wrong `PORT` |
| Pages load, Settings says "temporary disk" | Supabase is not configured or the table is missing | Fill in all six Supabase variables, then run **Settings → Test connection** |
| "Failed to fetch" right after waking | The free instance is still starting | Wait up to a minute and reload |
| Sign-in loops back to the login page | The public address and `NEXT_PUBLIC_SITE_URL` disagree | Set `NEXT_PUBLIC_SITE_URL` to the exact address in the browser bar |
| Login says *"No owner account can be created yet"* | The host has no `ADMIN_PASSWORD`, so there is no password to check against | Add `ADMIN_PASSWORD` (8+ characters) to the host's environment and redeploy |
| Signed in, then thrown out after a while | A free instance restarted, taking the temporary database with it — Supabase is not configured | Fill in the Supabase variables; Settings will confirm it |
| Upload fails on Vercel with a size error | Vercel's 4.5 MB request limit | Use Render for uploads, or upload to Supabase directly |

---

## What this guide does **not** claim

- It does not prove any specific hosting account is working; only that the
  repository contains the files each platform needs (`render.yaml`, `vercel.json`,
  `Dockerfile`), and that the same build was run here and served every page.
- Docker was **not** available in the environment where this was written, so the
  image build is verified by the CI workflow rather than claimed.
- Free tiers change their limits. The numbers above were correct when written;
  check the host's pricing page before relying on them.
