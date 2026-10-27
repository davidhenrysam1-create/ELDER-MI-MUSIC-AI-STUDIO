"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { GradientText, StatusPill, Toasts, cn, Modal, ProgressBar } from "@/components/ui/primitives";
import { GlobalPlayer } from "@/components/audio/GlobalPlayer";
import { useStudio } from "@/lib/client/studio";
import { formatBytes, relativeTime } from "@/lib/format";
import { NewProjectButton } from "@/components/shell/NewProjectDialog";

const NAV: { href: string; label: string; icon: IconName; studio?: "vocal" | "mix" | "master" }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/vocal", label: "Sam Vocal Studio", icon: "mic", studio: "vocal" },
  { href: "/mix", label: "Sam Mix Studio", icon: "sliders", studio: "mix" },
  { href: "/mastering", label: "Sam Mastering Studio", icon: "disc", studio: "master" },
  { href: "/projects", label: "My Projects", icon: "folder" },
  { href: "/voice-profiles", label: "My Voice Profiles", icon: "voice" },
  { href: "/exports", label: "Export History", icon: "download" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/docs", label: "Documentation", icon: "file" },
  { href: "/help", label: "Help & DAW import", icon: "info" },
];

const STUDIO_TINT: Record<string, string> = {
  vocal: "from-violet to-magenta",
  mix: "from-cyan to-violet",
  master: "from-orange to-gold",
};

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-gradient-to-br from-violet/70 via-magenta/60 to-cyan/60 shadow-glow">
        <Icon name="waveform" size={20} className="text-white" />
        <span className="absolute -inset-1 -z-10 rounded-2xl bg-violet/40 blur-lg transition-opacity group-hover:opacity-80" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block font-display font-bold leading-tight tracking-tight",
            compact ? "text-sm" : "text-[15px]",
          )}
        >
          <GradientText>Elder Mi</GradientText>{" "}
          <span className="text-softwhite">Music</span>
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted/80">
          AI Studio
        </span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
              active
                ? "bg-white/[0.07] text-softwhite shadow-inner1"
                : "text-muted hover:bg-white/[0.04] hover:text-softwhite",
            )}
          >
            {item.studio ? (
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-gradient-to-b opacity-0 transition-opacity",
                  STUDIO_TINT[item.studio],
                  active ? "opacity-100" : "group-hover:opacity-60",
                )}
              />
            ) : null}
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-lg border",
                active
                  ? item.studio
                    ? `border-white/15 bg-gradient-to-br ${STUDIO_TINT[item.studio]} text-white`
                    : "border-white/15 bg-white/10 text-softwhite"
                  : "border-transparent bg-white/[0.03] text-muted group-hover:text-softwhite",
              )}
            >
              <Icon name={item.icon} size={15} />
            </span>
            <span className="flex-1 truncate">
              {item.label === "Sam Vocal Studio" ? (
                <GradientText variant="vocal">{item.label}</GradientText>
              ) : item.label === "Sam Mix Studio" ? (
                <GradientText variant="mix">{item.label}</GradientText>
              ) : item.label === "Sam Mastering Studio" ? (
                <GradientText variant="master">{item.label}</GradientText>
              ) : (
                item.label
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { settings, system, notify } = useStudio();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const storageUsed = (system?.storage.audioBytes ?? 0) + (system?.storage.exportBytes ?? 0);
  const storageCap = 2 * 1024 * 1024 * 1024;

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute left-[8%] top-[-6rem] h-72 w-72 rounded-full bg-violet/20 blur-[100px] animate-floaty" />
        <div className="absolute right-[6%] top-24 h-64 w-64 rounded-full bg-cyan/10 blur-[90px]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-72 rounded-full bg-magenta/10 blur-[110px]" />
        <div className="absolute inset-0 ambient-grid opacity-40" />
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-white/[0.07] bg-[#0b0918]/80 px-4 py-5 backdrop-blur-2xl lg:flex">
        <Brand />
        <p className="mt-4 px-1 text-[10px] italic leading-relaxed text-muted/70">
          “Your Sound. Your Culture. Your Studio.”
        </p>
        <div className="mt-6 flex-1 overflow-y-auto">
          <div className="label mb-2 px-1">Workspaces</div>
          <NavLinks />
        </div>
        <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
            <span>Local studio storage</span>
            <span className="mono text-softwhite/80">{formatBytes(storageUsed)}</span>
          </div>
          <ProgressBar value={(storageUsed / storageCap) * 100} tone="cyan" />
          <div className="flex items-center gap-1.5 text-[10px] text-muted/70">
            <Icon name="lock" size={11} />
            Private audio · {settings?.maxUploadMb ?? 80} MB per file
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            notify(
              "info",
              "Privacy first",
              "Audio stays on this studio server. Nothing is sent to third parties unless you configure an AI provider.",
            )
          }
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 py-1.5 text-[10px] text-muted transition-colors hover:text-softwhite"
        >
          <Icon name="info" size={11} /> Data handling
        </button>
      </aside>

      {/* Mobile drawer */}
      <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title="Studio navigation" size="sm">
        <NavLinks onNavigate={() => setMobileOpen(false)} />
        <div className="mt-4">
          <NewProjectButton />
        </div>
      </Modal>

      <div className="lg:pl-[268px]">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 3xl:max-w-[1680px]">
          {children}
        </main>
      </div>

      <GlobalPlayer />
      <Toasts />
    </div>
  );
}

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { projects, project, saveState, savedAt, selectProject, settings } = useStudio();
  const pathname = usePathname();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const jobs = project?.jobs ?? [];
  const attention = jobs.filter((j) => j.status === "failed").length;

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "dirty"
        ? "Unsaved changes"
        : saveState === "error"
          ? "Save failed"
          : savedAt
            ? `Saved ${relativeTime(savedAt)}`
            : "Not saved yet";

  return (
    <header className="safe-top sticky top-0 z-20 border-b border-white/[0.07] bg-[#090914]/75 backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8 3xl:max-w-[1680px]">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-muted lg:hidden"
          onClick={onOpenMenu}
          aria-label="Open navigation"
        >
          <Icon name="grid" size={16} />
        </button>
        <div className="lg:hidden">
          <Brand compact />
        </div>

        <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
          <div className="relative">
            <select
              value={project?.id ?? ""}
              onChange={(e) => selectProject(e.target.value)}
              aria-label="Current project"
              className="max-w-[260px] appearance-none truncate rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-8 text-xs font-medium text-softwhite hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-violet/50"
            >
              {projects.length === 0 ? <option value="">No projects yet</option> : null}
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#15112B]">
                  {p.name}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
          {project ? (
            <StatusPill tone={saveState === "error" ? "danger" : saveState === "saved" ? "success" : "warning"}>
              {saveLabel}
            </StatusPill>
          ) : null}
          {project ? (
            <span className="hidden truncate text-[11px] text-muted xl:inline">
              {project.genre} · {project.bpm} BPM · {project.musicalKey}
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((v) => !v)}
              aria-label="Notifications"
              className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-muted transition-colors hover:text-softwhite"
            >
              <Icon name="alert" size={15} />
              {attention > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {attention}
                </span>
              ) : (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
            {notificationsOpen ? (
              <div className="glass-strong absolute right-0 top-11 w-80 animate-rise rounded-xl p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-softwhite">Processing notifications</span>
                  <button
                    onClick={() => setNotificationsOpen(false)}
                    aria-label="Close notifications"
                    className="text-muted hover:text-white"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
                {jobs.length === 0 ? (
                  <p className="text-[11px] leading-relaxed text-muted">
                    No processing jobs yet. Renders, layering and mastering runs appear here with
                    their real status.
                  </p>
                ) : (
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {jobs.slice(0, 6).map((job) => (
                      <li key={job.id} className="rounded-lg border border-white/10 bg-black/25 p-2">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate font-medium text-softwhite">{job.title}</span>
                          <StatusPill
                            tone={
                              job.status === "completed"
                                ? "success"
                                : job.status === "failed"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {job.status}
                          </StatusPill>
                        </div>
                        <p className="mt-1 text-[10px] leading-snug text-muted">{job.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <NewProjectButton />

          <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 sm:flex">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet to-cyan text-[10px] font-bold text-white">
              EM
            </span>
            <span className="text-[11px] text-muted">
              Studio owner
              <span className="ml-1 hidden text-[9px] uppercase tracking-wider text-emerald-300/80 md:inline">
                local
              </span>
            </span>
          </div>
        </div>
      </div>
      <div className="scroll-x flex items-center gap-1.5 border-t border-white/[0.05] px-3 py-1.5 lg:hidden">
        {NAV.filter((item) => item.studio || item.href === "/").map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors",
                active
                  ? "border-white/25 bg-white/10 text-softwhite"
                  : "border-white/10 bg-white/[0.03] text-muted",
              )}
            >
              <Icon name={item.icon} size={11} />
              {item.label.replace("Sam ", "").replace(" Studio", "")}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] px-4 py-1.5 lg:hidden">
        <select
          value={project?.id ?? ""}
          onChange={(e) => selectProject(e.target.value)}
          aria-label="Current project"
          className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-softwhite"
        >
          {projects.length === 0 ? <option value="">No projects yet</option> : null}
          {projects.map((p) => (
            <option key={p.id} value={p.id} className="bg-[#15112B]">
              {p.name}
            </option>
          ))}
        </select>
        <StatusPill tone={saveState === "saved" ? "success" : "warning"}>{saveLabel}</StatusPill>
        <span className="text-[10px] text-muted">{settings?.maxUploadMb ?? 80} MB limit</span>
      </div>
    </header>
  );
}
