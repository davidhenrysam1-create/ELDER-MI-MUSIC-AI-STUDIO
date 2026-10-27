"use client";

/**
 * Share with friends.
 *
 * A link shows one project, read-only, to anyone who has it — no account, no
 * app install. The owner decides here whether downloads are allowed, whether the
 * link expires and whether a short passcode is needed.
 *
 * The full link is displayed once, right after it is created. Only a hash of the
 * token is stored, so it cannot be shown again; revoke it and make a new one if
 * it is lost.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import {
  ConfirmButton,
  GlassCard,
  SectionHeading,
  Segmented,
  StatusPill,
  Toggle,
  cn,
} from "@/components/ui/primitives";
import { api, type ShareSummary } from "@/lib/client/api";
import { useStudio } from "@/lib/client/studio";
import { relativeTime } from "@/lib/format";

const EXPIRY_OPTIONS = [
  { value: "0", label: "Never" },
  { value: "1", label: "24 hours" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

/** `useSearchParams()` needs a Suspense boundary during prerender. */
export default function SharesPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <SharesView />
    </Suspense>
  );
}

function SharesView() {
  const { projects, project, notify } = useStudio();
  const params = useSearchParams();

  const [projectId, setProjectId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [expiry, setExpiry] = useState<string>("7");
  const [passcode, setPasscode] = useState("");
  const [shares, setShares] = useState<ShareSummary[]>([]);
  const [created, setCreated] = useState<{ path: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.shares();
      setShares(data.shares);
    } catch (err) {
      notify("error", "Could not load your links", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  // Preselect the current project, or one passed as ?project=…
  useEffect(() => {
    const requested = params.get("project");
    const initial =
      projects.find((entry) => entry.id === requested)?.id ?? project?.id ?? projects[0]?.id ?? "";
    setProjectId((current) => current || initial);
  }, [params, projects, project]);

  const selectedProject = useMemo(
    () => projects.find((entry) => entry.id === projectId) ?? null,
    [projects, projectId],
  );

  const create = async () => {
    if (!projectId) {
      notify("error", "Choose a project", "A link always points at one project.");
      return;
    }
    if (passcode && (passcode.length < 4 || passcode.length > 12)) {
      notify("error", "Passcode too short", "Use 4–12 characters, easy to type on a phone.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.createShare({
        projectId,
        label: label.trim() || undefined,
        allowDownload,
        expiresInDays: expiry === "0" ? null : Number(expiry),
        passcode: passcode.trim() || null,
      });
      setCreated({ path: result.path, label: result.share.label });
      setLabel("");
      setPasscode("");
      setCopied(false);
      await load();
      notify("success", "Link created", "Copy it now — it is shown only once.");
    } catch (err) {
      notify("error", "Could not create the link", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    const url = `${window.location.origin}${created.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notify("success", "Link copied", "Paste it into WhatsApp, Instagram or a message.");
    } catch {
      // Clipboard can be blocked; the field stays selectable.
      notify("info", "Copy failed", "Select the link text and copy it manually.");
    }
  };

  const revoke = async (id: string) => {
    try {
      await api.revokeShare(id);
      await load();
      notify("success", "Link revoked", "It stops working immediately.");
    } catch (err) {
      notify("error", "Could not revoke", (err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-fluid-title font-display font-bold tracking-tight">Share with friends</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            Send a friend a private listening page for one project. They do not need an account, and
            they never see your mixer, mastering chain or other sessions.
          </p>
        </div>
        <StatusPill tone="info" icon="link">
          {shares.filter((share) => share.active).length} active link
          {shares.filter((share) => share.active).length === 1 ? "" : "s"}
        </StatusPill>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <GlassCard accent="vocal">
          <SectionHeading
            eyebrow="New link"
            title="Create a listening link"
            description="Choose what the friend can do, then copy the link the moment it appears."
          />

          <div className="space-y-3">
            <div>
              <label className="label mb-1 block" htmlFor="share-project">
                Project
              </label>
              <select
                id="share-project"
                className="field text-xs"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {projects.length === 0 ? <option value="">No projects yet</option> : null}
                {projects.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} · {entry.genre}
                  </option>
                ))}
              </select>
              {selectedProject ? (
                <p className="mt-1 text-[9px] text-muted/70">
                  {selectedProject.tracks.length} channel
                  {selectedProject.tracks.length === 1 ? "" : "s"} ·{" "}
                  {selectedProject.assets.length} audio object
                  {selectedProject.assets.length === 1 ? "" : "s"} · only channel audio is shared
                </p>
              ) : null}
            </div>

            <div>
              <label className="label mb-1 block" htmlFor="share-label">
                Label for you (optional)
              </label>
              <input
                id="share-label"
                className="field text-xs"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Ada — first listen"
                maxLength={60}
              />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-softwhite">Allow download</div>
                <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
                  Off = listen only. On = they can save the channel files. Your masters are not included
                  unless they are on the mixer.
                </p>
              </div>
              <Toggle
                checked={allowDownload}
                onChange={setAllowDownload}
                label="Allow download"
              />
            </div>

            <div>
              <div className="label mb-1">Link expires</div>
              <Segmented
                label="Link expiry"
                size="sm"
                value={expiry}
                onChange={setExpiry}
                options={EXPIRY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
            </div>

            <div>
              <label className="label mb-1 block" htmlFor="share-passcode">
                Passcode (optional)
              </label>
              <input
                id="share-passcode"
                className="field text-xs"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="4–12 characters, share it separately"
                maxLength={12}
                autoComplete="off"
              />
              <p className="mt-1 text-[9px] leading-relaxed text-muted/70">
                Stored as a hash. Anyone with both the link and the passcode can listen — send them in
                two messages if you want a little more safety.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => void create()}
              disabled={busy || !projectId}
            >
              <Icon name="link" size={13} />
              {busy ? "Creating…" : "Create listening link"}
            </button>
          </div>

          {created ? (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.07] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-100">
                <Icon name="check" size={13} /> Link created — copy it now
              </div>
              <p className="mt-0.5 text-[9px] leading-relaxed text-emerald-100/80">
                {created.label}. For your safety only a hash of this link is stored, so it cannot be
                shown again. Lost it? Revoke it and make a new one.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  readOnly
                  className="mono field min-w-0 flex-1 text-[10px]"
                  value={typeof window === "undefined" ? created.path : `${window.location.origin}${created.path}`}
                  onFocus={(event) => event.currentTarget.select()}
                  aria-label="Share link"
                />
                <button type="button" className="btn-primary text-xs" onClick={() => void copy()}>
                  <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
                </button>
                <a
                  href={created.path}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-ghost text-xs"
                >
                  <Icon name="eye" size={12} /> Preview
                </a>
              </div>
            </div>
          ) : null}
        </GlassCard>

        <GlassCard accent="mix">
          <SectionHeading
            eyebrow="How it works"
            title="What a friend receives"
            description="A clean page with your project name, artist name, tempo and key."
          />
          <ul className="space-y-2 text-[10px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <Icon name="headphones" size={12} className="mt-0.5 shrink-0 text-cyan-300" />
              <span>Every channel on the mixer is playable in the browser, with seeking and a real waveform-free player.</span>
            </li>
            <li className="flex gap-2">
              <Icon name="lock" size={12} className="mt-0.5 shrink-0 text-amber-300" />
              <span>
                They see only what you share: no mixer settings, no mastering chain, no other projects,
                no account data.
              </span>
            </li>
            <li className="flex gap-2">
              <Icon name="clock" size={12} className="mt-0.5 shrink-0 text-muted" />
              <span>Expiry and revocation are enforced on the server for every request, including downloads.</span>
            </li>
            <li className="flex gap-2">
              <Icon name="info" size={12} className="mt-0.5 shrink-0 text-muted" />
              <span>
                Links work while this studio server is reachable. For friends outside your network, put
                the studio on a host or tunnel first.
              </span>
            </li>
          </ul>
          <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-2.5 text-[9px] leading-relaxed text-cyan-100/80">
            Play and download counts are recorded per link. No IP addresses, no user agents, no tracking
            pixels are stored.
          </p>
        </GlassCard>
      </div>

      <GlassCard>
        <SectionHeading
          eyebrow="Your links"
          title="Manage shared links"
          description="Revoke anything you no longer want in the wild. Revoking is immediate and cannot be undone."
          action={
            <button type="button" className="btn-subtle text-xs" onClick={() => void load()}>
              <Icon name="refresh" size={12} /> Refresh
            </button>
          }
        />

        {loading ? (
          <p className="text-[10px] text-muted">Loading your links…</p>
        ) : shares.length === 0 ? (
          <p className="text-[10px] leading-relaxed text-muted">
            No links yet. Create one above — it is the quickest way to let a friend hear a rough mix
            without sending a 40 MB file.
          </p>
        ) : (
          <ul className="space-y-2">
            {shares.map((share) => (
              <li
                key={share.id}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-2 rounded-xl border p-3",
                  share.active
                    ? "border-white/10 bg-black/20"
                    : "border-white/5 bg-black/10 opacity-70",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-softwhite">{share.label}</span>
                    <StatusPill
                      tone={share.active ? "success" : share.revokedAt ? "danger" : "warning"}
                    >
                      {share.revokedAt ? "Revoked" : share.expired ? "Expired" : "Active"}
                    </StatusPill>
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted">
                    {share.projectName} · created {relativeTime(share.createdAt)} ·{" "}
                    {share.allowDownload ? "downloads on" : "listen only"} ·{" "}
                    {share.requiresPasscode ? "passcode" : "no passcode"} ·{" "}
                    {share.expiresAt
                      ? `expires ${new Date(share.expiresAt).toLocaleDateString()}`
                      : "no expiry"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-[9px] text-muted/80">
                    <span className="mono">{share.opens} opens</span>
                    <span className="mono">{share.downloads} downloads</span>
                    {share.lastOpenedAt ? (
                      <span>last opened {relativeTime(share.lastOpenedAt)}</span>
                    ) : (
                      <span>not opened yet</span>
                    )}
                  </div>
                </div>
                {share.active ? (
                  <ConfirmButton
                    label="Revoke"
                    confirmLabel="Revoke link"
                    title="Revoke this link?"
                    description="Anyone holding it will see “this link is not active”. Make a new link if you change your mind."
                    icon="trash"
                    onConfirm={() => void revoke(share.id)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <p className="text-center text-[10px] text-muted/70">
        Need to share a single finished file instead?{" "}
        <Link href="/exports" className="underline hover:text-white">
          Export History
        </Link>{" "}
        has the downloadable master.
      </p>
    </div>
  );
}
