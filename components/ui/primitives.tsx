"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useStudio } from "@/lib/client/studio";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function GlassCard({
  children,
  className,
  accent,
  interactive = false,
  padded = true,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  accent?: "vocal" | "mix" | "master" | "neutral";
  interactive?: boolean;
  padded?: boolean;
  as?: "div" | "section" | "article";
}) {
  const Tag = as;
  const accentClass =
    accent === "vocal"
      ? "bg-[radial-gradient(120%_120%_at_0%_0%,rgba(168,85,247,0.14),transparent_55%)]"
      : accent === "mix"
        ? "bg-[radial-gradient(120%_120%_at_0%_0%,rgba(34,211,238,0.12),transparent_55%)]"
        : accent === "master"
          ? "bg-[radial-gradient(120%_120%_at_0%_0%,rgba(250,204,21,0.1),transparent_55%)]"
          : "";
  return (
    <Tag
      className={cn(
        "glass relative overflow-hidden",
        padded && "p-5",
        interactive &&
          "glow-border transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.055] hover:shadow-glow",
        accentClass,
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function GradientText({
  children,
  variant = "brand",
  className,
}: {
  children: React.ReactNode;
  variant?: "brand" | "vocal" | "mix" | "master";
  className?: string;
}) {
  const map = {
    brand: "gradient-text",
    vocal: "gradient-text-vocal",
    mix: "gradient-text-mix",
    master: "gradient-text-master",
  } as const;
  return <span className={cn(map[variant], className)}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Small indicators                                                    */
/* ------------------------------------------------------------------ */

export function StatusPill({
  children,
  tone = "neutral",
  icon,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "ready";
  icon?: IconName;
}) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.05] text-muted",
    success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    ready: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    danger: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    info: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tones[tone],
      )}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "violet",
  className,
  indeterminate = false,
  label = "Progress",
}: {
  value: number;
  tone?: "violet" | "cyan" | "gold";
  className?: string;
  indeterminate?: boolean;
  label?: string;
}) {
  const gradient =
    tone === "cyan"
      ? "from-cyan via-sky-400 to-violet"
      : tone === "gold"
        ? "from-orange via-gold to-magenta"
        : "from-violet via-magenta to-cyan";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(Math.max(0, Math.min(100, value)))}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-studio",
          gradient,
          indeterminate && "animate-pulse",
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Metric({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const valueTone =
    tone === "good"
      ? "text-emerald-200"
      : tone === "warn"
        ? "text-amber-200"
        : tone === "bad"
          ? "text-rose-200"
          : "text-softwhite";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/80">
        {label}
      </div>
      <div className={cn("mono mt-1 text-lg font-semibold leading-none", valueTone)}>
        {value}
        {unit ? <span className="ml-1 text-[11px] font-normal text-muted">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-[10px] leading-snug text-muted/70">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon = "music",
  title,
  description,
  action,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
      )}
    >
      <div className="relative mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet/30 to-cyan/20 text-softwhite">
        <Icon name={icon} size={22} />
        <span className="absolute inset-0 rounded-2xl blur-md bg-violet/30" />
      </div>
      <h4 className="text-sm font-semibold text-softwhite">{title}</h4>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <div className="label mb-1 text-muted/70">{eyebrow}</div> : null}
        <h2 className="text-lg font-semibold tracking-tight text-softwhite">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-white/10 bg-[#0c0a18]/95 px-2.5 py-1.5 text-[11px] leading-snug text-softwhite opacity-0 shadow-xl transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-softwhite">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-40",
          checked
            ? "border-violet/50 bg-gradient-to-r from-violet to-magenta"
            : "border-white/15 bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-[3px]",
          )}
        />
      </button>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  tone = "violet",
  disabled,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  tone?: "violet" | "cyan" | "gold" | "orange";
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={cn(disabled && "opacity-50")}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-medium text-muted">
          {label}
        </label>
        <span className="mono text-[11px] font-semibold text-softwhite">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className={cn(
          "w-full",
          tone === "cyan" && "accent-cyan",
          tone === "gold" && "accent-gold",
          tone === "orange" && "accent-orange",
        )}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format ? format(value) : String(value)}
      />
      {hint ? <div className="mt-1 text-[10px] text-muted/70">{hint}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  label,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/30 p-1"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg font-medium transition-all",
            size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
            value === opt.value
              ? "bg-gradient-to-r from-violet/80 to-magenta/70 text-white shadow"
              : "text-muted hover:bg-white/5 hover:text-softwhite",
          )}
        >
          {opt.icon ? <Icon name={opt.icon} size={13} /> : null}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  tone = "neutral",
  size = 16,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: "neutral" | "danger" | "gold";
  size?: number;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-lg border text-[11px] transition-colors disabled:opacity-30",
          active
            ? tone === "gold"
              ? "border-gold/50 bg-gold/20 text-gold"
              : "border-violet/50 bg-violet/25 text-white"
            : "border-white/10 bg-white/[0.04] text-muted hover:border-white/25 hover:text-softwhite",
          tone === "danger" && "hover:border-rose-400/40 hover:text-rose-200",
        )}
      >
        <Icon name={icon} size={size} />
      </button>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "glass-strong animate-rise relative z-10 w-full overflow-hidden rounded-2xl outline-none",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-softwhite">{title}</h3>
            {description ? (
              <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-black/20 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = "Confirm",
  title,
  description,
  danger = true,
  icon,
}: {
  onConfirm: () => void | Promise<void>;
  label: string;
  confirmLabel?: string;
  title: string;
  description?: string;
  danger?: boolean;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className={danger ? "btn-danger" : "btn-ghost"} onClick={() => setOpen(true)}>
        {icon ? <Icon name={icon} size={14} /> : null}
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className={danger ? "btn-danger" : "btn-primary"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">This action is immediate and cannot be undone.</p>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export function Toasts() {
  const { toasts, dismissToast } = useStudio();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-28">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "glass-strong pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-xl px-3.5 py-2.5",
            toast.kind === "error"
              ? "border-rose-400/30"
              : toast.kind === "success"
                ? "border-emerald-400/25"
                : "border-white/10",
          )}
          role="status"
        >
          <span
            className={cn(
              "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
              toast.kind === "error"
                ? "bg-rose-500/20 text-rose-200"
                : toast.kind === "success"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-violet/20 text-violet-200",
            )}
          >
            <Icon
              name={
                toast.kind === "error"
                  ? "alert"
                  : toast.kind === "success"
                    ? "check"
                    : toast.kind === "working"
                      ? "sparkles"
                      : "info"
              }
              size={14}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-softwhite">{toast.title}</div>
            {toast.message ? (
              <div className="mt-0.5 break-words text-xs leading-relaxed text-muted">
                {toast.message}
              </div>
            ) : null}
          </div>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-muted/60 transition-colors hover:text-white"
            aria-label="Dismiss notification"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
