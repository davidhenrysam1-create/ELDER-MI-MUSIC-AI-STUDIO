import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText, StatusPill } from "@/components/ui/primitives";

export const metadata = {
  title: "Offline — Elder Mi Music AI Studio",
};

/**
 * Shown by the service worker when a navigation fails offline. Audio rendering
 * and storage need the studio server, so this page is honest about what still
 * works instead of pretending the session loaded.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <StatusPill tone="warning" icon="alert">
        No connection
      </StatusPill>
      <GlassCard>
        <h1 className="font-display text-2xl font-bold">
          <GradientText>The studio needs its server</GradientText>
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          You are offline, or the studio server cannot be reached. Projects, audio files and renders
          live on the server, so they cannot be loaded until the connection is back. Nothing has been
          lost — reload this page once you are online again.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] font-semibold text-softwhite">Still available offline</div>
            <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-muted">
              <li>· This help screen and the app shell</li>
              <li>· Your already-open page layout</li>
              <li>· Previously downloaded WAV / MP3 files</li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] font-semibold text-softwhite">Needs a connection</div>
            <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-muted">
              <li>· Loading projects and audio</li>
              <li>· Rendering, measuring and exporting</li>
              <li>· Prompt improvement and recommendations</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className="btn-primary text-xs">
            <Icon name="refresh" size={13} /> Retry
          </Link>
          <Link href="/help" className="btn-ghost text-xs">
            <Icon name="info" size={13} /> Troubleshooting
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
