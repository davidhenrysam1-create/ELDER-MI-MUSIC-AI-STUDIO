import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";
import { CAPABILITIES, STATUS_LABEL } from "@/lib/capabilities";
import { MASTER_PROFILES, MIX_PRESETS, VOCAL_TOOLS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Studio documentation — Elder Mi Music AI Studio",
};

const ENV_VARS = [
  {
    key: "GEMINI_API_KEY",
    detail:
      "Optional. Enables Gemini prompt improvement and AI mixing stages. Read only on the server; never bundled into the browser.",
  },
  {
    key: "GEMINI_MODEL",
    detail: "Optional. Model id, default gemini-2.5-flash.",
  },
  {
    key: "DATA_DIR",
    detail: "Optional. Where the JSON index and private audio files live (default ./.data).",
  },
  {
    key: "MAX_UPLOAD_MB / MAX_DURATION_SEC",
    detail: "Optional defaults for upload limits (80 MB / 720 s). Editable in Settings.",
  },
  {
    key: "ALLOW_SIGNUP",
    detail:
      "Optional, default true. Set to false to close new accounts on an exposed studio. The first account can still be created, and existing accounts keep working.",
  },
  {
    key: "ADMIN_EMAIL",
    detail:
      "The one address with admin rights. Rights are derived from it on every request, never stored, so it cannot be granted to another account. Empty means nobody can open /admin.",
  },
  {
    key: "ADMIN_BOOTSTRAP_CODE",
    detail:
      "Optional. A fixed one-time code for /admin-bootstrap while Google is unconfigured (single use, 24 h). If unset, a random code is printed in the server log at start-up.",
  },
  {
    key: "ADMIN_PASSWORD",
    detail:
      "Optional, 8+ characters. Seeds the admin password once so /login works with ADMIN_EMAIL and this value, even after a restart. Change it in My account; the setup value then stops working. Keep it in .env.local, never in git.",
  },
  {
    key: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
    detail:
      "Optional. Enables Continue with Google. Register /api/auth/google/callback as an authorised redirect URI. Without them the button reads awaiting configuration.",
  },
  {
    key: "GOOGLE_REDIRECT_URI",
    detail: "Optional. Pins the OAuth redirect URI when it differs from NEXT_PUBLIC_SITE_URL.",
  },
  {
    key: "RESEND_API_KEY / EMAIL_FROM",
    detail:
      "Optional. The only path that actually sends verification mail. With no key nothing is sent, the API says so, and the admin verifies accounts by hand.",
  },
  {
    key: "VOICE_CONVERSION_API_URL",
    detail:
      "Reserved for a licensed voice-conversion adapter. When unset, voice transformation stays disabled.",
  },
  {
    key: "GOOGLE_API_KEY / GOOGLE_VERTEX_ACCESS_TOKEN + GOOGLE_VERTEX_PROJECT",
    detail:
      "Optional. Enables Google Lyria 2 beats and instrumentals (up to 30 s) through Vertex AI.",
  },
  {
    key: "STABILITY_API_KEY",
    detail: "Optional. Enables Stability Stable Audio 2 beats and instrumentals (up to 190 s, WAV).",
  },
  {
    key: "ELEVENLABS_API_KEY",
    detail: "Optional. Enables ElevenLabs Music songs and vocal hooks (up to 300 s, MP3).",
  },
  {
    key: "REPLICATE_API_TOKEN",
    detail:
      "Optional. Enables MusicGen on Replicate — asynchronous, polled by the studio (up to 120 s).",
  },
  {
    key: "SPEND_CAP_USD",
    detail:
      "Optional, default 5. Hard ceiling on tracked generation spend. Requests that would exceed it are refused with 402.",
  },
  {
    key: "LYRIA_ / STABLE_AUDIO_ / ELEVENLABS_ / REPLICATE_MUSICGEN_ USD_PER_SEC",
    detail:
      "Optional cost overrides in USD per second of generated audio. Used only for the studio's own estimate; the provider invoice is authoritative.",
  },
];

export default function DocsPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-fluid-title font-display font-bold tracking-tight">
            <GradientText>Studio documentation</GradientText>
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            How the engine actually works, what it will and will not do, and how to configure or
            deploy it. This page mirrors <span className="mono">README.md</span> in the repository.
          </p>
        </div>
        <StatusPill tone="info" icon="info">
          v1.0 · local-first
        </StatusPill>
      </div>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Quick start</h2>
        <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          <li>
            1. <span className="text-softwhite">Create a project</span> from the dashboard and give it
            a name, genre, tempo and key.
          </li>
          <li>
            2. <span className="text-softwhite">Upload audio</span> in Sam Vocal Studio (instrumental
            or lead vocal) or Sam Mix Studio (stems / ZIP of stems).
          </li>
          <li>
            3. <span className="text-softwhite">Generate vocal layers</span>, review each lane, and
            bounce them if you want a vocal stem mix.
          </li>
          <li>
            4. <span className="text-softwhite">Mix</span> the channels, analyse the mix, bounce it.
          </li>
          <li>
            5. <span className="text-softwhite">Master</span> the bounce with a profile, compare A/B,
            then export WAV or MP3.
          </li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/vocal" className="btn-primary text-xs">
            <Icon name="mic" size={13} /> Sam Vocal Studio
          </Link>
          <Link href="/mix" className="btn-ghost text-xs">
            <Icon name="sliders" size={13} /> Sam Mix Studio
          </Link>
          <Link href="/mastering" className="btn-ghost text-xs">
            <Icon name="disc" size={13} /> Sam Mastering Studio
          </Link>
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard>
          <h2 className="text-base font-semibold text-softwhite">What runs for real</h2>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
              Audio is decoded and rendered in the browser with the Web Audio API; nothing about
              playback or export is animated mock-up.
            </li>
            <li className="flex gap-2">
              <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
              Loudness (ITU-R BS.1770-4 gated), true peak (4× oversampled), crest factor, LRA,
              correlation and octave-band balance are computed from the samples you loaded.
            </li>
            <li className="flex gap-2">
              <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
              EQ, compression, sends, width, saturation and limiting are applied by real DSP, then
              re-measured. The UI shows the measured result, not a prediction.
            </li>
            <li className="flex gap-2">
              <Icon name="check" size={12} className="mt-0.5 shrink-0 text-emerald-300" />
              Vocal layers are derived from your own recording with granular pitch shifting and
              ensemble DSP — they are not synthesised singing.
            </li>
            <li className="flex gap-2">
              <Icon name="info" size={12} className="mt-0.5 shrink-0 text-cyan-300" />
              The AI layer (Gemini or the local rules engine) writes prompts, plans and suggested
              channel values. It never invents measured audio facts.
            </li>
          </ul>
        </GlassCard>

        <GlassCard>
          <h2 className="text-base font-semibold text-softwhite">What needs configuration</h2>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <Icon name="lock" size={12} className="mt-0.5 shrink-0 text-amber-300" />
              <span>
                <span className="text-softwhite">Neural voice conversion</span> needs a licensed
                provider and explicit consent. The tool stays disabled; no placeholder audio is
                generated.
              </span>
            </li>
            <li className="flex gap-2">
              <Icon name="lock" size={12} className="mt-0.5 shrink-0 text-amber-300" />
              <span>
                <span className="text-softwhite">Gemini</span> is optional. Without{" "}
                <span className="mono">GEMINI_API_KEY</span>, prompt improvement and mixing stages use
                the labelled local rule engine.
              </span>
            </li>
            <li className="flex gap-2">
              <Icon name="lock" size={12} className="mt-0.5 shrink-0 text-amber-300" />
              <span>
                <span className="text-softwhite">AI beat, song and vocal generation</span> is
                implemented against four hosted providers, but each needs its own key. With no key the
                Generate panel shows setup instructions and no button — and even with a key,{" "}
                <span className="mono">allowPaidGeneration</span> is off until you enable it in
                Settings.
              </span>
            </li>
            <li className="flex gap-2">
              <Icon name="info" size={12} className="mt-0.5 shrink-0 text-cyan-300" />
              <span>
                <span className="text-softwhite">Native .flp / .cpr projects</span> are not
                reconstructed. Export consolidated stems instead — the guide is built into Sam Mix
                Studio.
              </span>
            </li>
            <li className="flex gap-2">
              <Icon name="info" size={12} className="mt-0.5 shrink-0 text-cyan-300" />
              <span>
                <span className="text-softwhite">Multi-user accounts</span> are not included; this is
                a single-operator studio on private local storage.
              </span>
            </li>
          </ul>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-softwhite">Accounts &amp; sign-in</h2>
          <StatusPill tone="success" icon="user">
            Implemented
          </StatusPill>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Every page needs an account. The first account created becomes the studio owner and adopts any
          project saved before accounts existed, so upgrading loses nothing.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="text-[10px] font-semibold text-softwhite">How passwords are stored</div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
              Salted scrypt hashes (<span className="mono">scrypt$N$r$p$salt$hash</span>) in the studio
              database. Plaintext is never stored, logged or sent to the browser.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="text-[10px] font-semibold text-softwhite">How sessions work</div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
              A random 256-bit token in an <span className="mono">HttpOnly</span>,{" "}
              <span className="mono">SameSite=Lax</span> cookie, valid 30 days. The database stores only
              its hash, and the account page lists each device.
            </p>
          </div>
        </div>
        <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted">
          <li>
            <span className="text-softwhite">Isolation:</span> projects, audio, exports, voice profiles
            and links are filtered by owner on every request; another account&apos;s id returns 404.
          </li>
          <li>
            <span className="text-softwhite">Password change</span> signs every device out. The owner
            account cannot delete itself — that would orphan everyone else.
          </li>
          <li>
            <span className="text-softwhite">Verification exists, sending does not.</span> Links are
            issued, hashed and expire after 24 hours, but posting them needs RESEND_API_KEY and
            EMAIL_FROM. Until then the account page reports that no email was sent and the admin can
            verify the account from /admin.
          </li>
          <li>
            <span className="text-softwhite">No password-reset mail</span> is sent even with a provider
            configured; a forgotten password is reset by whoever runs the server.
          </li>
        </ul>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-softwhite">Roles, dashboards and the admin console</h2>
          <StatusPill tone="success" icon="user">
            Implemented
          </StatusPill>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          At sign-up (or at <span className="mono">/welcome</span> after a Google sign-in) an account
          says what it does. One account can hold several roles, and the answer decides the dashboard.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="text-[10px] font-semibold text-softwhite">Artist</div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
              Sam Vocal Studio plus publishing and promotion tools. No mixer or mastering chain.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="text-[10px] font-semibold text-softwhite">Producer / beat maker</div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
              The whole studio: vocal, mix, mastering, beats for sampling, and shares.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="text-[10px] font-semibold text-softwhite">Engineer</div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
              Mixing and mastering for other people&apos;s sessions, plus vocal cleanup — all three
              studios.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="text-[10px] font-semibold text-softwhite">Promoter</div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
              Publishing and promotion surfaces, profile links, and shares. No processing tools.
            </p>
          </div>
        </div>
        <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted">
          <li>
            <span className="text-softwhite">Hidden means refused.</span> The server checks the same role
            map as the navigation (<span className="mono">lib/roles.ts</span>), so a hidden screen is also
            a 403.
          </li>
          <li>
            <span className="text-softwhite">The admin</span> is always the address in{" "}
            <span className="mono">ADMIN_EMAIL</span> and can open every screen. <span className="mono">/admin</span>{" "}
            lists all accounts with their projects, files, storage and share links, and can set roles,
            verify, suspend (which ends that account&apos;s sessions at once) or delete an account.
          </li>
          <li>
            <span className="text-softwhite">Getting in as admin:</span> email + password with{" "}
            <span className="mono">ADMIN_PASSWORD</span> from <span className="mono">.env.local</span>{" "}
            (change it in My account once you are in), Google sign-in with that address, or — while Google
            is unconfigured — the one-time code printed in the server log at{" "}
            <span className="mono">/admin-bootstrap</span>. No admin password lives in the repository.
          </li>
        </ul>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-softwhite">Publishing, likes and follows</h2>
          <StatusPill tone="success" icon="music">
            Implemented
          </StatusPill>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          <span className="mono">/publish</span> turns one finished file from your project into a song
          other accounts can play. <span className="mono">/discover</span> lists what the studio has
          published, and <span className="mono">/u/&lt;handle&gt;</span> is a creator&apos;s public page
          with their songs, follower counts and AudioMack / Instagram / Facebook links.
        </p>
        <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted">
          <li>
            <span className="text-softwhite">Public or unlisted:</span> public songs appear in Discover;
            unlisted songs live only on your page, for something finished but not announced. Either can
            be unpublished without touching the project.
          </li>
          <li>
            <span className="text-softwhite">Listen, like, follow:</span> one row per account, so counters
            rise and fall honestly. Plays count when a listener presses play — not on page load, and not
            while seeking.
          </li>
          <li>
            <span className="text-softwhite">Downloads</span> need the creator&apos;s permission and a
            signed-in account; each one is counted. Listen-only is the default.
          </li>
          <li>
            <span className="text-softwhite">Still private:</span> the project behind a song — mixer,
            mastering chain, stems, versions and every unpublished file.
          </li>
          <li>
            <span className="text-softwhite">Not built:</span> comments, paid support/tips and
            like/follow notifications. They are labelled planned in the app, not shown empty.
          </li>
        </ul>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-softwhite">Sharing a project with friends</h2>
          <StatusPill tone="success" icon="link">
            Implemented
          </StatusPill>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          <span className="mono">/shares</span> creates a read-only link for one project. A friend opens
          it on any phone or laptop — no account, no install.
        </p>
        <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted">
          <li>
            <span className="text-softwhite">Only mixer audio is shared.</span> Stored files that were
            never placed on a channel stay private, as do the mixer, mastering chain, versions and your
            other projects.
          </li>
          <li>
            <span className="text-softwhite">Per-link controls:</span> listen-only or allow downloads;
            expiry at 24 hours / 7 / 30 / 90 days or never; optional 4–12 character passcode.
          </li>
          <li>
            <span className="text-softwhite">Revocation is immediate</span> and enforced on every audio
            request, not just the page. Expiry works the same way.
          </li>
          <li>
            <span className="text-softwhite">Tokens are stored hashed</span>, so the link is shown once
            when created. Lost it? Revoke and make a new one.
          </li>
          <li>
            <span className="text-softwhite">Counters only:</span> opens, downloads and last opened. No IP
            addresses or user agents.
          </li>
        </ul>
        <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-2.5 text-[9px] leading-relaxed text-amber-100/85">
          A link only works while this studio server is reachable. For friends outside your network, host
          the studio (or run a tunnel) first. There is no public feed, follow or comment system.
        </p>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-softwhite">
            AI music generation — what it does and costs
          </h2>
          <StatusPill tone="warning" icon="lock">
            Off until you connect a provider
          </StatusPill>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Sam Mix and Sam Vocal contain a Generate panel that can create a new beat, instrumental, song
          or vocal hook. Nothing is bundled: every result comes from a hosted model on your own account.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-b border-white/10 text-muted">
                <th className="py-1.5 pr-2 font-medium">Provider</th>
                <th className="py-1.5 pr-2 font-medium">Makes</th>
                <th className="py-1.5 pr-2 font-medium">Max</th>
                <th className="py-1.5 font-medium">Key</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              {[
                ["Google Lyria 2", "beat, instrumental", "30 s", "GOOGLE_API_KEY + GOOGLE_VERTEX_PROJECT"],
                ["Stability Stable Audio 2", "beat, instrumental", "190 s", "STABILITY_API_KEY"],
                ["ElevenLabs Music", "song, vocals", "300 s", "ELEVENLABS_API_KEY"],
                ["MusicGen (Replicate)", "beat, instrumental", "120 s", "REPLICATE_API_TOKEN"],
              ].map(([provider, kinds, max, key]) => (
                <tr key={provider} className="border-b border-white/5">
                  <td className="py-1.5 pr-2 text-softwhite">{provider}</td>
                  <td className="py-1.5 pr-2">{kinds}</td>
                  <td className="py-1.5 pr-2">{max}</td>
                  <td className="mono py-1.5 text-cyan-200">{key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted">
          <li>
            <span className="text-softwhite">Three gates before money is spent:</span> the provider must
            have a key (otherwise 400), paid generation must be switched on in Settings (otherwise 403),
            and the estimate must fit inside the spend cap (otherwise 402).
          </li>
          <li>
            <span className="text-softwhite">Provenance:</span> each generated asset stores provider,
            model, prompt, licence, estimated cost and job id — visible on the asset and in the job
            list.
          </li>
          <li>
            <span className="text-softwhite">Cost display:</span> figures are estimates from
            configurable per-second prices. Your provider invoice is authoritative; the studio does not
            reconcile it.
          </li>
          <li>
            <span className="text-softwhite">Licensing:</span> each provider&apos;s terms govern
            commercial use. MusicGen weights are CC-BY-NC 4.0 unless you use a licensed variant.
          </li>
        </ul>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Workspace reference</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold">
              <GradientText variant="vocal">Sam Vocal Studio</GradientText>
            </h3>
            <ul className="mt-2 space-y-1.5">
              {VOCAL_TOOLS.map((tool) => (
                <li key={tool.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-softwhite">{tool.name}</span>
                    <StatusPill tone={tool.status === "ready" ? "success" : "warning"}>
                      {tool.status === "ready" ? "Ready" : "Needs config"}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-[9px] leading-relaxed text-muted">{tool.statusNote}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              <GradientText variant="mix">Sam Mix Studio</GradientText>
            </h3>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Import stems or a ZIP, set channels (gain, pan, 3-band EQ, compression, reverb/delay
              sends, width), group them on rhythm/vocal/music buses, and bounce through a per-channel
              chain with a true-peak safety limiter.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {MIX_PRESETS.filter((p) => p.id !== "custom").map((preset) => (
                <span key={preset.id} className="chip py-0.5 text-[9px]">
                  {preset.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Presets are adjustable starting points applied to matching roles — never universal
              rules.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              <GradientText variant="master">Sam Mastering Studio</GradientText>
            </h3>
            <ul className="mt-2 space-y-1">
              {MASTER_PROFILES.filter((p) => p.id !== "custom").map((profile) => (
                <li key={profile.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                  <span className="text-[10px] text-softwhite">{profile.label}</span>
                  <span className="mono text-[9px] text-muted">
                    {profile.controls.targetLufs} / {profile.controls.truePeakCeilingDb}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Audio formats & limits</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            { title: "Accepted uploads", body: "WAV, AIFF, FLAC, MP3, OGG, M4A — decoded in the browser to PCM." },
            { title: "Default limits", body: "80 MB and 12 minutes per file, enforced client- and server-side." },
            { title: "Exports", body: "WAV 16-bit (TPDF dither), WAV 24-bit, WAV 32-bit float, MP3 320 kbps." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-semibold text-softwhite">{item.title}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Working sample rate is 48 kHz inside the browser. WAV metadata (sample rate, bit depth) is
          read from the file header; compressed formats have no bit depth until encoded.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Devices, installation &amp; offline</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            {
              title: "Install it",
              body: "Android/desktop: install from the browser prompt. iOS: Safari → Share → Add to Home Screen. Installed it opens full-screen from /manifest.webmanifest.",
            },
            {
              title: "Any screen",
              body: "Phone-first layout from 320px to 4K: drawer navigation and a compact workspace bar on phones, safe-area padding for notches, bottom-sheet dialogs, horizontal mixer scrolling.",
            },
            {
              title: "Offline shell",
              body: "A service worker caches the app shell and icons only. API responses and audio are never cached — offline navigations land on an honest /offline page.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-semibold text-softwhite">{item.title}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Rendering and measurement use the Web Audio API on the device, so a laptop outpaces a phone
          on long files. Icons are generated with <span className="mono">node scripts/generate-icons.mjs</span>.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Architecture</h2>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[10px] leading-relaxed text-muted">
{`Browser (Next.js client)                       Studio server (Next.js route handlers)
────────────────────────                       ─────────────────────────────────────
Web Audio decode + OfflineAudioContext  ─────▶ POST /api/projects/:id/assets
Granular pitch shift / ensemble DSP           POST /api/exports (final files)
EBU R128 + true peak analysis                 POST /api/projects/:id/jobs
WAV / MP3 encoding                             PATCH /api/projects/:id (state)
Canvas waveforms                               GET  /api/assets/:id/audio (Range)
Prompt + recommendations  ──────────────────▶ POST /api/prompt/improve
                                               POST /api/mix/recommendations
Generate panel  ──────────────────────────▶ GET  /api/providers
 (poll every 4 s)                              POST /api/generate
                                               GET|DELETE /api/generate/:id
                                                        │
                                                        ▼
                                              .data/db.json (atomic writes)
                                              .data/audio/*  .data/exports/*
                                              optional GEMINI_API_KEY (server only)
                                              optional generation keys (server only)`}
        </pre>
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Jobs are rendered on the client (so no audio leaves the server for processing) and their real
          lifecycle is recorded with the project. The single outbound audio path is generation: your
          text brief goes to the provider you choose, and the rendered file is copied back into private
          storage with its prompt and licence recorded. Swap <span className="mono">lib/server/db.ts</span> for Postgres or
          Supabase to move to a queue-backed multi-user deployment.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Configuration</h2>
        <div className="mt-2 space-y-1.5">
          {ENV_VARS.map((env) => (
            <div key={env.key} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
              <div className="mono text-[10px] text-cyan-200">{env.key}</div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{env.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
          Copy <span className="mono">.env.example</span> to <span className="mono">.env.local</span>.
          Secrets are read only inside route handlers.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Capability matrix</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-2">Capability</th>
                <th className="py-2 pr-2">Area</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((cap) => (
                <tr key={cap.name} className="border-b border-white/[0.05]">
                  <td className="py-1.5 pr-2 text-softwhite/90">{cap.name}</td>
                  <td className="py-1.5 pr-2 text-muted">{cap.area}</td>
                  <td className="py-1.5">
                    <StatusPill
                      tone={
                        cap.status === "ready"
                          ? "success"
                          : cap.status === "needs"
                            ? "warning"
                            : cap.status === "external"
                              ? "info"
                              : "neutral"
                      }
                    >
                      {STATUS_LABEL[cap.status]}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Deployment & testing</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] font-semibold text-softwhite">Run it</div>
            <pre className="mt-1 overflow-x-auto text-[10px] leading-relaxed text-muted">{`npm install
cp .env.example .env.local   # optional Gemini key
npm run dev                  # http://localhost:3000
npm run build && npm start   # production`}</pre>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] font-semibold text-softwhite">Verify it</div>
            <pre className="mt-1 overflow-x-auto text-[10px] leading-relaxed text-muted">{`npm test        # DSP + store unit tests
npm run typecheck
npm run build   # production compile`}</pre>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Tests cover LUFS against a −23 dBFS reference tone, true-peak oversampling, WAV
              round-trip, limiter ceilings, pitch-shift ratio, prompt engine output and project
              persistence.
            </p>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Deploy to Node hosting with a persistent volume mounted at <span className="mono">.data</span>.
          Serverless platforms with ephemeral disks will lose audio — use object storage instead.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Privacy & consent</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Uploads stay in <span className="mono">.data/audio</span> on this server and are streamed only
          through the studio API. They are sent to a third party only when you configure Gemini and
          ask for prompt work (text only — audio is never uploaded to the AI provider).
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Voice transformation requires explicit, recorded consent. No voice model is trained by this
          application, and no unconverted sample is ever displayed as a converted result.
        </p>
      </GlassCard>
    </div>
  );
}
