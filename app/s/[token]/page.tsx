import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GradientText, StatusPill } from "@/components/ui/primitives";
import { SharedListen } from "@/components/share/SharedListen";
import { SharePasscodeForm } from "@/components/share/SharePasscodeForm";
import { findShare, isUnlocked, sharedProjectView } from "@/lib/server/shares";

/**
 * A friend's shared listening page (`/s/<token>`).
 *
 * Server-rendered so the page works without any studio login: the token is the
 * only credential, it is checked against a hash on every request, and the page
 * shows only channel audio for that one project.
 *
 * States: not-active (unknown, revoked or expired), passcode required, or the
 * project view.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const share = await findShare(token);
  if (!share) return { title: "Shared session — Elder Mi Music AI Studio" };
  const view = await sharedProjectView(share);
  return {
    title: view ? `${view.name} — shared by ${view.ownerName}` : "Shared session",
    description: view
      ? `${view.genre} · ${view.bpm} BPM · ${view.musicalKey} — listen on Elder Mi Music AI Studio.`
      : undefined,
    robots: { index: false, follow: false },
  };
}

/** Shared shell for the three states, so the page looks like the studio. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-8">
      <header className="mb-5 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-gradient-to-br from-violet/70 via-magenta/60 to-cyan/60">
            <Icon name="waveform" size={17} className="text-white" />
          </span>
          <span className="font-display text-sm font-bold tracking-tight">
            <GradientText>Elder Mi</GradientText>{" "}
            <span className="text-softwhite">Music</span>
          </span>
        </Link>
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted/80">
          AI Studio · shared session
        </p>
      </header>
      {children}
      <footer className="mt-6 text-center text-[9px] leading-relaxed text-muted/60">
        “Your Sound. Your Culture. Your Studio.” · shared privately, no account needed.
      </footer>
    </div>
  );
}

export default async function SharedProjectPage({ params }: Params) {
  const { token } = await params;
  const share = await findShare(token);

  if (!share) {
    return (
      <Frame>
        <div className="glass rounded-2xl border border-white/10 p-5 text-center">
          <Icon name="lock" size={22} className="mx-auto text-amber-300" />
          <h1 className="mt-2 text-base font-semibold text-softwhite">This link is not active</h1>
          <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-muted">
            It may have expired, been revoked by the producer, or the address was typed incorrectly.
            Ask them for a fresh link — they can create one in seconds.
          </p>
        </div>
      </Frame>
    );
  }

  const view = await sharedProjectView(share);
  if (!view) {
    return (
      <Frame>
        <div className="glass rounded-2xl border border-white/10 p-5 text-center">
          <Icon name="alert" size={22} className="mx-auto text-amber-300" />
          <h1 className="mt-2 text-base font-semibold text-softwhite">Project unavailable</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            The producer deleted this project, so the link has nothing to play.
          </p>
        </div>
      </Frame>
    );
  }

  const unlocked = await isUnlocked(share);

  if (!unlocked) {
    return (
      <Frame>
        <div className="glass rounded-2xl border border-white/10 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-base font-semibold text-softwhite">{view.name}</h1>
              <p className="text-[10px] text-muted">
                Shared by {view.ownerName} · {view.genre} · {view.bpm} BPM · {view.musicalKey}
              </p>
            </div>
            <StatusPill tone="warning" icon="lock">
              Passcode
            </StatusPill>
          </div>
          <SharePasscodeForm token={token} />
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="glass rounded-2xl border border-white/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-display font-bold tracking-tight text-softwhite">
              {view.name}
            </h1>
            <p className="mt-0.5 text-[11px] text-muted">
              Shared by <span className="text-softwhite">{view.ownerName}</span>
            </p>
          </div>
          <StatusPill tone={view.allowDownload ? "info" : "neutral"} icon={view.allowDownload ? "download" : "headphones"}>
            {view.allowDownload ? "Listen & download" : "Listen only"}
          </StatusPill>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
          <span>{view.genre}</span>
          <span>{view.bpm} BPM</span>
          <span>{view.musicalKey}</span>
          <span className="mono">{view.tracks.length} channel{view.tracks.length === 1 ? "" : "s"}</span>
          {view.expiresAt ? (
            <span>link expires {new Date(view.expiresAt).toLocaleDateString()}</span>
          ) : null}
        </div>

        {view.notes ? (
          <p className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2.5 text-[10px] leading-relaxed text-muted">
            {view.notes}
          </p>
        ) : null}

        <div className="mt-3">
          <SharedListen
            token={token}
            tracks={view.tracks}
            allowDownload={view.allowDownload}
          />
        </div>

        <p className="mt-4 border-t border-white/10 pt-3 text-[9px] leading-relaxed text-muted/60">
          This is a private link for listening. Please do not repost it. The producer can revoke it at
          any time.
        </p>
      </div>
    </Frame>
  );
}
