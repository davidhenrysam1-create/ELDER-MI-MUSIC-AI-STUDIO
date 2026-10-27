"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/components/ui/primitives";

/**
 * Drag-and-drop upload surface with real validation feedback. The parent owns
 * the actual upload so each studio can add its own role / asset metadata.
 */
export function UploadZone({
  onFiles,
  accept = ".wav,.mp3,.aiff,.aif,.flac,.ogg,.m4a,audio/*",
  multiple = false,
  title = "Drop Your Music Project Here",
  subtitle = "Upload your audio tracks, stems, or a supported project package to begin.",
  hint,
  disabled,
  compact = false,
  busy,
  children,
}: {
  onFiles: (files: File[]) => Promise<void> | void;
  accept?: string;
  multiple?: boolean;
  title?: string;
  subtitle?: string;
  hint?: string;
  disabled?: boolean;
  compact?: boolean;
  busy?: boolean;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const handle = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || !fileList.length) return;
      const files = Array.from(fileList);
      setError(null);
      setProgress(8);
      try {
        await onFiles(files);
        setProgress(100);
      } catch (err) {
        setError((err as Error).message);
        setProgress(null);
      } finally {
        setTimeout(() => setProgress(null), 600);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onFiles],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) void handle(e.dataTransfer.files);
        }}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300",
          compact ? "px-4 py-5" : "px-6 py-9",
          dragging
            ? "border-cyan/70 bg-cyan/[0.07] shadow-glow-cyan"
            : "border-white/15 bg-white/[0.02] hover:border-violet/40 hover:bg-white/[0.04]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 ambient-grid" aria-hidden />
        <div className="relative flex flex-col items-center text-center">
          <div
            className={cn(
              "mb-3 grid place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet/25 via-magenta/15 to-cyan/20 text-softwhite transition-transform duration-300",
              compact ? "h-10 w-10" : "h-14 w-14",
              dragging && "scale-110",
            )}
          >
            <Icon name="upload" size={compact ? 18 : 24} />
          </div>
          <h3 className={cn("font-semibold text-softwhite", compact ? "text-sm" : "text-base")}>
            {dragging ? "Release to import" : title}
          </h3>
          {subtitle ? (
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">{subtitle}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Icon name="folder" size={14} />
              {busy ? "Uploading…" : "Choose audio files"}
            </button>
            {children}
          </div>
          {hint ? <p className="mt-3 max-w-lg text-[10px] leading-relaxed text-muted/70">{hint}</p> : null}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={(e) => void handle(e.target.files)}
          />
          {progress !== null ? (
            <div className="mt-3 w-full max-w-xs">
              <ProgressBar
                value={progress}
                tone={progress === 100 ? "cyan" : "violet"}
                indeterminate={progress < 100}
              />
              <p className="mt-1 text-[10px] text-muted">
                {progress === 100 ? "Decoded and stored privately" : "Decoding audio in your browser…"}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <div
          className="mt-2 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
          role="alert"
        >
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
