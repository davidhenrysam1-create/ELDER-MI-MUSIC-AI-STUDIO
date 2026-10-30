# Run it, host it, install it

Five ways to run Elder Mi Music AI Studio. Pick by what you want: **your machine**, **your own server**,
or **a public web address** other people can open.

| Want | Use | Needs | Keeps your music |
| --- | --- | --- | --- |
| Try it on a laptop | [A · Node](#a--your-own-machine-node) | Node 20+ | On that laptop only |
| Any machine, no Node | [B · Docker](#b--any-machine-docker) | Docker | If you mount the volume |
| A public web address, uploads work | [C · Render](#c--public-web-version-render) | free Render account + Supabase | Yes, with Supabase |
| A public web address, fast to set up | [D · Vercel](#d--vercel-quick-public-address) | free Vercel + Supabase | Yes, with Supabase — but uploads are capped |
| A free public link, step by step | [HOST-FREE.md](HOST-FREE.md) | nothing else | Yes, with Supabase |
| Google Cloud / an AI stack | [E · Cloud Run](#e--google-cloud-run) | Google Cloud project + Supabase | Yes, with Supabase |
| Phone or tablet | [F · Install as an app](#f--install-as-an-app-android-ios) | any of the above | Same as the host |

Whatever you choose, the studio is the **same web app**: responsive on phone, tablet and desktop, and
installable as a PWA.

---

## A · Your own machine (Node)

```bash
git clone https://github.com/davidhenrysam1-create/ELDER-MI-MUSIC-AI-STUDIO.git
cd ELDER-MI-MUSIC-AI-STUDIO
npm ci
cp .env.example .env.local     # then edit .env.local
npm run dev                    # http://localhost:3000
```

For a production run instead of a dev server:

```bash
npm run verify   # typecheck + tests + build, the same checks CI runs
npm run start    # http://localhost:3000
```

Requires **Node 20.9 or newer** (`.nvmrc` pins 22). Windows, macOS and Linux are all checked by CI on
every push.

---

## B · Any machine (Docker)

One image, no Node install, identical on a laptop, a NAS, a VPS or a cloud runner.

```bash
docker compose up -d          # http://localhost:3000
```

or by hand:

```bash
docker build -t elder-mi-studio .
docker run -d -p 3000:3000 \
  --env-file .env.local \
  -v elder-mi-data:/app/.data \
  --name elder-mi-studio \
  elder-mi-studio
```

**The volume is the point.** Without `-v …:/app/.data`, the database and every uploaded stem live inside
the container and vanish when the container is replaced. On a small server you can bind a folder instead:

```bash
-v /srv/elder-mi:/app/.data
```

The image runs as a non-root user, and `docker ps` shows `healthy` once the studio answers `/login`.

---

## C · Public web version (Render)

The best option if you want people to upload audio, because a container has no request-size ceiling.

`render.yaml` ships on the **free** plan — no card, public HTTPS, no upload cap. Free instances have no
disk and sleep after ~15 minutes idle, so **Supabase holds the music** and the first visit after a quiet
spell takes ~50 seconds. That trade-off is the price of zero cost; the click-by-click version is in
[`HOST-FREE.md`](HOST-FREE.md).

1. Push this repository to GitHub (already done if you cloned it).
2. [render.com](https://render.com) → **New → Blueprint** → pick the repository. `render.yaml` describes
   everything: Docker build, `/api/health` health check, the free plan, and the variables to fill in.
3. In the service's **Environment** tab set the secrets it asks for:
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
4. Deploy. Render gives you `https://<name>.onrender.com` — that is your public web version.

Then open the site, go to **Settings → Supabase connection → Test connection**. When the three checks are
green, storage is off the machine and a redeploy cannot delete anything. Also set
`NEXT_PUBLIC_SITE_URL=https://<name>.onrender.com` so the Google redirect URI is built from the public
address.

**Want Render's own disk instead of Supabase?** That needs the paid **Starter** plan: change `plan: free`
to `plan: starter` and uncomment the `disk:` block at the bottom of `render.yaml`.

**Health check:** every host probes `/api/health`. It answers `{"ok":true}` without a session or a database
call, so a Supabase outage never makes a healthy deployment look dead.

---

## D · Vercel (quick public address)

```bash
npm i -g vercel
vercel
```

Or import the repository at [vercel.com/new](https://vercel.com/new) — the framework is detected
automatically (`vercel.json` only adds a region).

**Two honest limits on Vercel:**

1. **The filesystem is temporary.** Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `STORAGE_DRIVER=supabase`,
   `DATABASE_DRIVER=supabase` in *Project → Settings → Environment Variables*. Without Supabase the studio
   still opens, but anything saved is gone on the next deploy — and Settings says so in red.
2. **Serverless request bodies are capped (4.5 MB).** A full stem can exceed that, so uploads may fail on
   Vercel. Browsing, publishing, likes, follows and downloads are fine. For real studio work choose
   **C (Render)** or **E (Cloud Run)**.

---

## E · Google Cloud Run

Good if you already use Google Cloud, and it keeps company with **Google AI Studio / Gemini**, whose key
the studio uses for prompt assistance and mixing suggestions.

```bash
gcloud run deploy elder-mi-studio \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --set-env-vars DATA_DIR=/tmp/studio,STORAGE_DRIVER=supabase,DATABASE_DRIVER=supabase,SUPABASE_BUCKET=tracks,SUPABASE_TABLE=songs \
  --set-secrets SUPABASE_URL=supabase-url:latest,SUPABASE_SECRET_KEY=supabase-secret:latest
```

`DATA_DIR=/tmp/studio` because Cloud Run's filesystem is in-memory: **Supabase is required here**, which is
why the drivers were built first. To use Gemini, add `GOOGLE_API_KEY` (from
[Google AI Studio](https://aistudio.google.com/apikey)) the same way — as an env var or a secret.

---

## F · Install as an app (Android, iOS)

There is no app store step — the studio is a PWA:

- **Android / Chrome:** open the site → menu → **Add to Home screen**.
- **iPhone / iPad / Safari:** open the site → **Share** → **Add to Home Screen**.
- **Desktop Chrome / Edge:** address-bar install icon.

It then opens full-screen with its own icon and keeps working offline for the parts that do not need the
server.

---

## Environment variables, in one table

Only the first row is needed to open the studio on your own machine.

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | The address that owns `/admin`. Open-studio mode acts as this account. |
| `DATA_DIR` | Where the local database and audio go. Default: `./.data`, or a temp folder on a host with an ephemeral disk. |
| `STUDIO_ACCOUNTS` | Leave unset for **open studio** (no sign-in). `on` restores login and per-person libraries. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Durable storage: audio to a private bucket, database to one Postgres row. |
| `SUPABASE_BUCKET`, `SUPABASE_TABLE` | Names in the Supabase dashboard (this project: `tracks`, `songs`). |
| `STORAGE_DRIVER`, `DATABASE_DRIVER` | `local` or `supabase`. Unset means: Supabase when configured. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Continue with Google. |
| `GOOGLE_API_KEY` | Gemini, from Google AI Studio. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Verification and password-reset email. |
| `NEXT_PUBLIC_SITE_URL` | The public address, used to build the Google redirect URI. |

Full descriptions: `.env.example`, and the in-app **Docs** page.

---

## What CI guarantees

Every push and pull request runs the workflow in [`docs/ci/ci.yml`](ci/ci.yml) once you have copied it to
`.github/workflows/ci.yml` (one-time, 30 seconds — see the header of that file for why it is not there
already). Locally, `npm run verify` runs exactly the same three steps.

- **Ubuntu (Node 20 and 22), macOS (22), Windows (22):** `npm ci` → type-check → tests → production build.
- **Docker:** builds the image, starts it, and fails unless `/login` answers `200`.

If a change breaks any platform, the check goes red before it reaches `main`.

---

## Security checklist before you share the address

1. **Change the admin password** in *My account* (never leave a setup password in use).
2. Set `STUDIO_ACCOUNTS=on` if the studio should not be open to anyone who finds the URL. Open studio
   means every visitor acts as the owner, including `/admin`.
3. Rotate any key that has been pasted into a chat window, and keep `.env.local` out of Git (it is ignored
   by default).
4. Use HTTPS. Render, Vercel and Cloud Run give you a certificate automatically; for a bare server, put it
   behind Caddy or nginx + Let's Encrypt.
