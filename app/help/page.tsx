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
    q: "Why does the vocal tool say “Needs configuration”?",
    a: "Neural voice transformation requires a licensed provider and recorded consent. The studio will not run a placeholder model or play back your original file as if it were converted. Every other vocal tool (chorus, harmony, ad-lib, doubling, backing vocals, choir stacks) uses real DSP on your own recording and is available now.",
  },
  {
    q: "Is my audio sent anywhere?",
    a: "No. Uploads are stored on the studio server you are running and streamed back to your browser. Rendering and measurement happen in your browser. The only outbound requests are text prompts to Gemini, and only if you set GEMINI_API_KEY.",
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
          <h1 className="font-display text-2xl font-bold tracking-tight">
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
