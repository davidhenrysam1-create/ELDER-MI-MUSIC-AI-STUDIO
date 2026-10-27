"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill, cn } from "@/components/ui/primitives";

type Step = { title: string; body: string };

const DAW_GUIDES: { id: string; name: string; tint: string; steps: Step[] }[] = [
  {
    id: "fl",
    name: "FL Studio",
    tint: "from-orange to-gold",
    steps: [
      {
        title: "Consolidate the stems",
        body:
          "Open File → Export → WAV. Choose “Split mixer tracks”, 24-bit, 48 kHz, and disable master effects (or bypass them) so the mix bus is not printed twice. FL writes one file per mixer channel into a folder.",
      },
      {
        title: "Name every channel",
        body:
          "Rename mixer channels before exporting (kick, snare, hats, bass, keys, lead vox, adlibs). Elder Mi guesses channel roles from filenames, so clear names mean an accurate starting console.",
      },
      {
        title: "Zip and import",
        body:
          "Select the exported WAVs, compress them into one .zip, and drop it on Sam Mix Studio. Channels are created in order, and a genre starting point is applied to new imports only.",
      },
    ],
  },
  {
    id: "cubase",
    name: "Cubase / Nuendo",
    tint: "from-cyan to-violet",
    steps: [
      {
        title: "Use Channel Batch Export",
        body:
          "Select the channels in the MixConsole, then File → Export → Audio Mixdown with “Channel Batch Export” enabled. Choose WAV, 24-bit, 48 kHz, and set the locators to the full song.",
      },
      {
        title: "Print effects, not the master chain",
        body:
          "Keep insert effects on the channels; bypass the Stereo Out chain so mastering is not applied twice. Cubase names files after the channels automatically.",
      },
      {
        title: "Import to Elder Mi",
        body:
          "Drop the folder or a zip of it into Sam Mix Studio. The tempo field is used only for the delay send — the audio itself is never time-stretched.",
      },
    ],
  },
  {
    id: "ableton",
    name: "Ableton Live",
    tint: "from-lime to-cyan",
    steps: [
      {
        title: "Select and export",
        body:
          "Select all tracks, then File → Export Audio/Video → “Selected tracks only”, WAV, 24-bit, 48 kHz, and set the render length to the arrangement.",
      },
      {
        title: "Skip return-only tracks",
        body:
          "Live exports return tracks separately; leave them out so reverb is not doubled by the studio's own sends.",
      },
      {
        title: "Import",
        body: "Zip the exported files and drop them in. Files with “vox” or “vocal” become vocal channels.",
      },
    ],
  },
  {
    id: "logic",
    name: "Logic Pro",
    tint: "from-violet to-magenta",
    steps: [
      {
        title: "Export All Tracks as Audio Files",
        body:
          "File → Export → All Tracks as Audio Files. Choose WAV, 24-bit, 48 kHz, and keep “Include volume/pan automation” on if you want the printed balance.",
      },
      {
        title: "Exclude the master",
        body:
          "Logic exports the Stereo Out as well; remove it before importing so Sam Mastering Studio is the only mastering stage.",
      },
      {
        title: "Import",
        body: "Zip the bounced files and upload. Track names become channel names.",
      },
    ],
  },
  {
    id: "reaper",
    name: "Reaper",
    tint: "from-magenta to-violet",
    steps: [
      {
        title: "Render selected tracks",
        body:
          "File → Render: Source = “Selected tracks (stems)”, Bounds = entire project, WAV 24-bit, 48 kHz. Enable “Add rendered items to new tracks” only if you want a check mix.",
      },
      {
        title: "Import",
        body: "Drop the renders (or their zip) into Sam Mix Studio. Reaper's filenames already contain the track names.",
      },
    ],
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need an account to use the studio?",
    a: "No. This build runs in open studio mode: opening the address takes you straight to the dashboard, and every studio, project, export, share link, public page and the admin console are already there. The app acts as the studio owner account (ADMIN_EMAIL) — created automatically with all four roles — so publishing, likes, follows and downloads work immediately. The sign-in and sign-up screens forward to the dashboard, and Sign out is hidden. If the owner wants separate libraries again, they set STUDIO_ACCOUNTS=on and restart: the login screens return and nothing is lost.",
  },
  {
    q: "Why does the vocal tool say “Needs configuration”?",
    a: "Neural voice transformation requires a licensed provider and recorded consent. The studio will not run a placeholder model or play back your original file as if it were converted. Every other vocal tool (chorus, harmony, ad-lib, doubling, backing vocals, choir stacks) uses real DSP on your own recording and is available now.",
  },
  {
    q: "Is my audio sent anywhere?",
    a: "Not for upload, mixing, vocal layering, mastering or export: your files stay on the studio server you run, and rendering plus measurement happen in your browser. Two optional outbound paths exist. Text prompts go to Gemini for prompt improvement / mixing suggestions, only if GEMINI_API_KEY is set. And if you use the Generate panel, your written brief goes to the music provider you picked, which returns a rendered file; that only happens when you press Generate with paid generation enabled.",
  },
  {
    q: "How do friends listen to my song?",
    a: "Open Share with friends, pick the project, choose whether they may download it and whether it expires, then press Create listening link. Copy the link the moment it appears — only a hash of it is stored, so it cannot be shown again — and send it by WhatsApp or message. Your friend opens it in any browser: no account, no app. They hear only the audio on your mixer and never see your settings or other projects. Revoke it any time and it stops working immediately.",
  },
  {
    q: "How do I publish a song so other people can find it?",
    a: "Open Publish a song, pick a project, pick one finished file from it, give it a title and press Publish. Public songs appear in Discover and on your page (/u/yourhandle); unlisted songs appear only on your page, for something finished but not announced yet. Publishing needs a public handle — set it in My account first. You can switch a song between public and unlisted, turn downloads on or off, or unpublish it at any time; none of that touches the project, the audio or your versions.",
  },
  {
    q: "What do the play, download, like and follower numbers mean?",
    a: "They are real counts from the studio database, and nothing else. A play is counted once when a listener starts a song (seeking does not count again). A download is counted when somebody with an account saves a file you allowed downloads for. A like or a follow is a single row per account, so pressing again removes it — the numbers can go down. If a number is zero, nobody has done that yet; the studio never fills counters with sample activity.",
  },
  {
    q: "Who can download my song?",
    a: "Downloads are off by default. Turn them on for a release and any signed-in account can save the file, with each download counted. Listeners without an account can still play a public song — the button says Sign in to download instead of failing. Turning downloads back off stops new downloads immediately; the artist can always export their own project from the studio.",
  },
  {
    q: "Does publishing expose my project, stems or mixer settings?",
    a: "No. A release is one finished audio file plus a title, notes and your public profile facts. The project document — mixer channels, mastering chain, every stem, all versions and any file you did not publish — is never sent to listeners. Unpublishing removes the release and leaves the project exactly as it was.",
  },
  {
    q: "Can another account see my projects?",
    a: "No. Every project, audio object, export, voice profile and share link belongs to the account that created it, and the server checks that owner on every request. Trying another account's id returns “not found”, so ids cannot be probed. The one exception is a project you deliberately share: the link exposes that project's mixer audio, read-only.",
  },
  {
    q: "I forgot my password — can you email me a reset link?",
    a: "That is built: open Forgot password on the sign-in screen, enter your address, and the studio emails a one-use link that expires in an hour. Opening it lets you choose a new password, and every device is signed out. Two honest caveats. The link can only be sent when the server has RESEND_API_KEY and EMAIL_FROM; without them the screen says No email was sent and tells you to ask whoever runs the studio. And the form never reveals whether an address has an account — it answers the same way either way. While signed in you can also change the password in My account.",
  },
  {
    q: "Why can I not see the mixer or mastering studios?",
    a: "Your account is set to Artist or Promoter. Roles decide the dashboard: artists get Sam Vocal Studio plus publishing tools, promoters get publishing and promotion only, producers and engineers get all three studios. Change it in My account → What you do here, or ask the admin — the change applies on your next page load. The server enforces the same rules, so a hidden screen is also refused, never silently empty.",
  },
  {
    q: "I sign in and it takes me straight back to the login screen.",
    a: "That is the browser refusing the session cookie, not a wrong password — the sign-in itself succeeded. It usually happens when the studio is shown inside another site's frame (a preview panel) and that browser blocks third-party cookies. The studio handles it two ways: over HTTPS it sets the cookie SameSite=None; Secure; Partitioned so a framed preview can hold a session, and if the browser still refuses, the sign-in screen tells you so and offers Open the studio in its own tab. Use that link (or open the preview address in a new tab) and sign in there.",
  },
  {
    q: "How do I sign in as the studio admin?",
    a: "The simplest way is email and password: set ADMIN_PASSWORD in .env.local (8+ characters), restart the studio, then sign in at /login with your ADMIN_EMAIL address and that password. The setup password is only a way back in — change it in My account once you are inside, and the admin console banner will disappear. The other two routes are Continue with Google with the ADMIN_EMAIL address (once GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET exist) and the one-time bootstrap code printed in the terminal, entered at /admin-bootstrap (single use, 24 hours). No admin password is stored in the repository, and the admin can never be suspended or deleted from the console.",
  },
  {
    q: "Another account joined — what can the admin do about it?",
    a: "Open /admin (only the admin sees the link). It lists every account with its roles, sign-in method, verification, project count, files, storage and live share links. From there the admin can change roles, mark an address verified by hand, suspend an account (which blocks sign-in and ends its sessions immediately, without deleting its work) or delete it along with its projects, audio, exports and share links.",
  },
  {
    q: "I clicked Continue with Google — what do I do now?",
    a: "The button is always live. If Google is already configured, one tap signs you in (a new account picks its roles at /welcome). If it is not configured yet, clicking it opens a short set-up panel inside the sign-in card: it shows the exact redirect URI to paste into Google Cloud Console, a copy button, and where to put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Nothing is sent to Google and no account is created until those two values exist. Email and password keep working in the meantime.",
  },
  {
    q: "How do I add a bandmate or a friend as a user?",
    a: "Send them the studio address and let them create an account on the sign-up screen — each account gets its own separate library. If the studio is exposed to the internet and you want to control who joins, set ALLOW_SIGNUP=false and create the first account yourself; after that, new sign-ups are refused.",
  },
  {
    q: "How do I generate a beat, a song or a vocal hook?",
    a: "Add one generation key to .env.local — GOOGLE_API_KEY + GOOGLE_VERTEX_PROJECT (Lyria 2), STABILITY_API_KEY (Stable Audio 2), ELEVENLABS_API_KEY (ElevenLabs Music) or REPLICATE_API_TOKEN (MusicGen) — and restart the studio. Then open Settings → AI music generation, switch on Allow paid generation and set a small spend cap, and use the Generate panel in Sam Mix Studio (beats, instrumentals) or Sam Vocal Studio (songs, vocal hooks). No key is included with this app: keys are issued by the provider to your own account and billed by them.",
  },
  {
    q: "Why is the Generate panel showing setup instructions instead of a button?",
    a: "Because no generation key is configured. The panel lists the exact variable each provider needs. It never shows a fake generate button and never produces placeholder audio — with no key there is nothing to render.",
  },
  {
    q: "The Generate button is disabled even though I added a key.",
    a: "Two more gates are closed. Settings → AI music generation must have Allow paid generation switched on (otherwise the API returns 403), and the estimate for your requested length must fit inside the spend cap (otherwise 402). Raise the cap or shorten the request. Note the cap is checked against the studio's tracked estimate, not the provider's invoice.",
  },
  {
    q: "Are the costs shown on the Generate panel my real bill?",
    a: "No. They are estimates from configurable per-second prices (defaults in .env.example), rounded to cents and tracked so the spend cap can stop runaway use. Your provider's invoice is authoritative. Every success message and the asset provenance say this explicitly so nobody budgets from the wrong number.",
  },
  {
    q: "Why do the loudness numbers differ from my other meter?",
    a: "Integrated loudness is measured with ITU-R BS.1770-4 gating on the rendered buffer, and true peak uses 4× oversampling. Meters that use different gating, weighting or oversampling will differ slightly. The value shown is always the measured one, with the method disclosed in the tooltip.",
  },
  {
    q: "Can I open a .flp or .cpr file directly?",
    a: "No — native project formats are not reconstructed, and the studio says so instead of importing something misleading. Export consolidated stems from your DAW using the guides above.",
  },
  {
    q: "Where are my files stored?",
    a: "In the server's .data folder (audio/ and exports/) plus a JSON index. Use Settings → Storage to see totals and Settings → Delete all studio data to wipe everything. Mount a persistent volume in production.",
  },
  {
    q: "Do I need to save manually?",
    a: "No. Project state, mixer settings, prompts, versions and job history save automatically and are confirmed by the save pill in the top bar. Use “Save version” when you want a named, restorable snapshot.",
  },
  {
    q: "Why is MP3 export greyed out?",
    a: "MP3 encoding supports 32, 44.1 and 48 kHz. Choose one of those render rates in Sam Mastering Studio, then export.",
  },
  {
    q: "Can I undo a delete?",
    a: "Deleting a layer, channel or asset asks for confirmation and is permanent. Before big edits, use Projects → Save version so you can restore the studio state.",
  },
];

const TROUBLESHOOT = [
  {
    symptom: "“Could not decode this file”",
    fix: "The browser cannot decode that codec. Convert to WAV or MP3 and retry; large files above the upload limit are rejected before decoding.",
  },
  {
    symptom: "Analysis looks flat or silent",
    fix: "Check the selected source has audio in the render section. Muted or empty sections produce near-silent measurements, which the panel reports honestly.",
  },
  {
    symptom: "Master is quieter than the target",
    fix: "The limiter stops at the true-peak ceiling. Lower the ceiling slightly or raise the target; the report lists each pass and the measured result.",
  },
  {
    symptom: "Prompt improvement says “local-heuristic”",
    fix: "No Gemini key is configured. The local production rule engine produced the result — add GEMINI_API_KEY to .env.local and restart for model-driven output.",
  },
  {
    symptom: "I am sent back to the sign-in screen",
    fix: "Your session expired (30 days) or the studio was restarted with a different data directory. Sign in again; the page you were on is preserved in the address. If it happens immediately every time, check the browser is not blocking cookies for this site.",
  },
  {
    symptom: "A shared link says “This link is not active”",
    fix: "It expired, was revoked by the producer, or the address is mistyped. Links are shown once when created, so ask the producer for a fresh one — they can make another in seconds.",
  },
  {
    symptom: "Generate fails with 401 / 403 / 429",
    fix: "401 means the provider rejected the key — check it in the provider dashboard and restart the studio after editing .env.local. 403 means paid generation is off in Settings. 429 is a rate or quota limit from the vendor; the job message keeps their wording, and the studio retries asynchronous jobs automatically.",
  },
  {
    symptom: "A generated file's waveform is empty",
    fix: "MP3 output has no server-side decoder, so the stored peaks are empty until the browser plays and decodes the file. WAV output is decoded on the server and shows its real waveform immediately.",
  },
  {
    symptom: "Playback stops when I change pages",
    fix: "The player is global and should continue. If it stops, the asset may have been deleted; reopen the project and reselect the source.",
  },
];

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [daw, setDaw] = useState(DAW_GUIDES[0].id);
  const active = DAW_GUIDES.find((g) => g.id === daw) ?? DAW_GUIDES[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-fluid-title font-display font-bold tracking-tight">
            <GradientText>Help &amp; DAW import</GradientText>
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            Bring stems in from any DAW, fix the common problems, and understand exactly which parts
            of the studio are automated.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/docs" className="btn-ghost px-2.5 py-1.5 text-[10px]">
            <Icon name="file" size={12} /> Full documentation
          </Link>
          <Link href="/mix" className="btn-primary px-2.5 py-1.5 text-[10px]">
            <Icon name="sliders" size={12} /> Open Sam Mix Studio
          </Link>
        </div>
      </div>

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-softwhite">
            <Icon name="layers" size={15} className="text-cyan-300" />
            Export stem guidance
          </h2>
          <StatusPill tone="info">Same for every session</StatusPill>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            {
              icon: "file" as IconName,
              title: "1 · One file per channel",
              body: "Consolidated WAV, 24-bit, 48 kHz, from start to end of the song. No gaps, no trimmed intros.",
            },
            {
              icon: "scissors" as IconName,
              title: "2 · Bypass the master chain",
              body: "Print channel effects, but leave the mix/master bus clean so Elder Mi masters once.",
            },
            {
              icon: "layers" as IconName,
              title: "3 · Name, zip, import",
              body: "Name channels by instrument or vocal part, zip them, and drop the zip on Sam Mix Studio.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-white/10 bg-black/25 p-3">
              <Icon name={card.icon} size={15} className="text-violet-300" />
              <div className="mt-1.5 text-[11px] font-semibold text-softwhite">{card.title}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{card.body}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Per-DAW steps</h2>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="DAW guides">
          {DAW_GUIDES.map((guide) => (
            <button
              key={guide.id}
              type="button"
              role="tab"
              aria-selected={guide.id === daw}
              onClick={() => setDaw(guide.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                guide.id === daw
                  ? `border-white/20 bg-gradient-to-r ${guide.tint} text-black/85`
                  : "border-white/10 bg-white/[0.03] text-muted hover:text-softwhite",
              )}
            >
              {guide.name}
            </button>
          ))}
        </div>
        <ol className="mt-3 space-y-2">
          {active.steps.map((item, index) => (
            <li key={item.title} className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <span className="mono grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/10 text-[10px] text-softwhite/80">
                {index + 1}
              </span>
              <div>
                <div className="text-[11px] font-semibold text-softwhite">{item.title}</div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5 text-[10px] leading-relaxed text-amber-100/80">
          Elder Mi cannot open or rebuild native .flp, .cpr, .als or .logicx projects. Uploading one is
          rejected with an explanation instead of importing partial data.
        </p>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard>
          <h2 className="text-base font-semibold text-softwhite">Frequently asked</h2>
          <div className="mt-2 divide-y divide-white/[0.06]">
            {FAQ.map((item, index) => {
              const open = openFaq === index;
              return (
                <div key={item.q} className="py-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : index)}
                    aria-expanded={open}
                    className="flex w-full items-start justify-between gap-3 py-1 text-left"
                  >
                    <span className="text-[11px] font-medium text-softwhite/90">{item.q}</span>
                    <Icon
                      name="chevronDown"
                      size={13}
                      className={cn("mt-0.5 shrink-0 text-muted transition-transform", open && "rotate-180")}
                    />
                  </button>
                  {open ? (
                    <p className="animate-rise pb-1 text-[10px] leading-relaxed text-muted">{item.a}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-base font-semibold text-softwhite">Troubleshooting</h2>
          <ul className="mt-2 space-y-2">
            {TROUBLESHOOT.map((item) => (
              <li key={item.symptom} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                <div className="flex items-start gap-2">
                  <Icon name="alert" size={12} className="mt-0.5 shrink-0 text-amber-300" />
                  <div>
                    <div className="text-[10px] font-semibold text-softwhite">{item.symptom}</div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{item.fix}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Still stuck?</div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Open Settings → System status to see which engines and providers are live, then check
              the browser console for decode errors. Renders that fail are recorded under
              Notifications with their real error message.
            </p>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-softwhite">
            <Icon name="grid" size={15} className="text-violet-300" />
            Run it on your phone, tablet or laptop
          </h2>
          <StatusPill tone="success" icon="check">
            Works at any screen size
          </StatusPill>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Android phone or tablet",
              body: "Open in Chrome, then menu → Install app. It opens full-screen with its own icon and keeps the shell available offline.",
            },
            {
              title: "iPhone / iPad",
              body: "Open in Safari → Share → Add to Home Screen. Full-screen studio, notch-safe bars and 16px fields so iOS never zooms.",
            },
            {
              title: "Laptop or desktop",
              body: "Use it in any modern browser, or install it from the address-bar icon. The layout widens to 1800px+ on large monitors.",
            },
            {
              title: "On your local network",
              body: "The dev server listens on 0.0.0.0:3000, so other devices can open http://<your-computer-ip>:3000 on the same Wi-Fi.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-semibold text-softwhite">{item.title}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Rendering happens on the device you are using: a laptop bounces a long mix faster than an
          older phone. Trim the render section in Sam Vocal Studio, and press play once on iOS before
          expecting monitoring — Safari requires a tap before audio is allowed.
        </p>
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold text-softwhite">Workflow cheat sheet</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Vocal", body: "Upload instrumental or lead · pick tool · generate · review lanes · bounce", href: "/vocal" },
            { title: "Mix", body: "Import stems/zip · apply preset · review AI stages · analyse · bounce", href: "/mix" },
            { title: "Master", body: "Select bounce · analyse · profile · render · A/B · report · export", href: "/mastering" },
            { title: "Deliver", body: "Export WAV 24-bit or MP3 320 · download from Export history", href: "/exports" },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-xl border border-white/10 bg-black/20 p-3 transition-colors hover:border-white/25"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-softwhite">{item.title}</span>
                <Icon
                  name="arrowRight"
                  size={12}
                  className="text-muted transition-transform group-hover:translate-x-0.5"
                />
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.body}</p>
            </Link>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
