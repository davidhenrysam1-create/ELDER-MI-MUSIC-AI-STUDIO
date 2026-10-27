"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GlassCard, GradientText } from "@/components/ui/primitives";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the console instead of hiding it behind a
    // friendly message; the UI still explains what the user can do next.
    console.error("Elder Mi studio error:", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center py-12">
      <GlassCard className="max-w-lg">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-200">
            <Icon name="alert" size={18} />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold">
              <GradientText>The studio hit an error</GradientText>
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              This screen appeared because part of the page failed to render. Saved projects and
              audio are unaffected — they live on the server, not in this view.
            </p>
          </div>
        </div>

        <pre className="mono mt-3 max-h-32 overflow-auto rounded-lg border border-white/10 bg-black/40 p-2.5 text-[10px] leading-relaxed text-rose-100/80">
          {error.message}
          {error.digest ? `\n(digest ${error.digest})` : ""}
        </pre>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn-primary text-xs">
            <Icon name="refresh" size={13} /> Try again
          </button>
          <Link href="/" className="btn-ghost text-xs">
            <Icon name="dashboard" size={13} /> Dashboard
          </Link>
          <Link href="/help" className="btn-subtle text-xs">
            <Icon name="info" size={13} /> Troubleshooting
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
