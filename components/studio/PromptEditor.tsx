"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { StatusPill, cn } from "@/components/ui/primitives";
import { useStudio } from "@/lib/client/studio";
import type { StudioId } from "@/lib/types";

export interface ImproveResult {
  text: string;
  source: "gemini" | "local-heuristic";
  note: string;
}

/**
 * Prompt editor with a real "Improve My Prompt" call. The improved text is
 * always shown for review before it is used, and the response says which engine
 * produced it (Gemini or the local rules engine).
 */
export function PromptEditor({
  studio,
  prompt,
  onPromptChange,
  improvedPrompt,
  onImproved,
  tool,
  seed,
  disabled,
  title = "AI instruction",
  rows = 4,
}: {
  studio: StudioId;
  prompt: string;
  onPromptChange: (value: string) => void;
  improvedPrompt: string | null;
  onImproved: (result: ImproveResult) => void;
  tool?: string;
  seed?: string;
  disabled?: boolean;
  title?: string;
  rows?: number;
}) {
  const { project, notify } = useStudio();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImproveResult | null>(null);

  const improve = async () => {
    if (!project) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/prompt/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          studio,
          genre: project.genre,
          bpm: project.bpm,
          key: project.musicalKey,
          tool,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The prompt engine rejected that request");
      setResult(data);
      onImproved(data);
      notify(
        "success",
        data.source === "gemini" ? "Prompt improved by Gemini" : "Prompt improved locally",
        data.note,
      );
    } catch (err) {
      notify("error", "Could not improve the prompt", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="label">{title}</div>
        <div className="flex items-center gap-1.5">
          {seed ? (
            <button
              type="button"
              onClick={() => onPromptChange(seed)}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-muted transition-colors hover:text-white"
            >
              Reset example
            </button>
          ) : null}
          <button
            type="button"
            onClick={improve}
            disabled={busy || disabled || prompt.trim().length < 4}
            className="btn-ghost px-2.5 py-1.5 text-[11px]"
          >
            <Icon name="sparkles" size={13} className={cn(busy && "animate-spin")} />
            {busy ? "Improving…" : "Improve My Prompt"}
          </button>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        className="field resize-y text-[13px] leading-relaxed"
        placeholder="Describe the vocal arrangement, mix or master you want…"
        aria-label={title}
      />

      {result ? (
        <div className="mt-3 rounded-xl border border-violet/30 bg-violet/[0.08] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <StatusPill tone={result.source === "gemini" ? "success" : "info"} icon="sparkles">
              {result.source === "gemini" ? "Gemini" : "Local rule engine"}
            </StatusPill>
            <div className="flex gap-1.5">
              <button
                className="btn-subtle px-2 py-1 text-[10px]"
                onClick={() => {
                  onPromptChange(result.text);
                  notify("success", "Improved prompt applied");
                }}
              >
                Use this prompt
              </button>
              <button
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-muted hover:text-white"
                onClick={() => void navigator.clipboard?.writeText(result.text)}
              >
                Copy
              </button>
              <button
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-muted hover:text-white"
                onClick={() => setResult(null)}
                aria-label="Dismiss improved prompt"
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-softwhite/90">{result.text}</p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">{result.note}</p>
        </div>
      ) : improvedPrompt ? (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2.5 text-[11px] leading-relaxed text-muted">
          <span className="font-semibold text-softwhite">Saved improved prompt: </span>
          {improvedPrompt}
        </div>
      ) : null}
      <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
        The prompt guides the arrangement and the recommended processing. Measurement values always
        come from your rendered audio, never from the prompt.
      </p>
    </div>
  );
}
