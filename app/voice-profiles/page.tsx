"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  EmptyState,
  GlassCard,
  GradientText,
  SectionHeading,
  StatusPill,
  Toggle,
  cn,
} from "@/components/ui/primitives";
import { useStudio } from "@/lib/client/studio";
import { api } from "@/lib/client/api";
import { relativeTime } from "@/lib/format";
import type { VoiceProfile } from "@/lib/types";

export default function VoiceProfilesPage() {
  const { project, system, notify, playAsset, player, upload } = useStudio();
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [consentName, setConsentName] = useState("");
  const [timbre, setTimbre] = useState("");
  const [genre, setGenre] = useState("Afrobeats");
  const [consent, setConsent] = useState(false);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = await api.voiceProfiles();
      setProfiles(data.voiceProfiles);
    } catch (err) {
      notify("error", "Could not load voice profiles", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!name.trim() || !consentName.trim() || !consent) {
      notify("error", "Consent is required", "Name the profile, record who consented and confirm the checkbox.");
      return;
    }
    setBusy(true);
    try {
      let referenceAssetId: string | null = null;
      if (referenceFile && project) {
        const asset = await upload(referenceFile, {
          kind: "reference",
          createTrack: false,
          trackName: referenceFile.name.replace(/\.[^.]+$/, ""),
        });
        referenceAssetId = asset.id;
      }
      await api.createVoiceProfile({
        name: name.trim(),
        consentName: consentName.trim(),
        timbreDescription: timbre.trim(),
        genreSuitability: genre,
        consentConfirmed: true,
        referenceAssetId,
      });
      setName("");
      setConsentName("");
      setTimbre("");
      setConsent(false);
      setReferenceFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
      notify("success", "Voice profile registered", "It is visible only on this studio server.");
    } catch (err) {
      notify("error", "Could not register the profile", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const providerReady = system?.providers.voiceConversion.configured ?? false;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-fluid-title font-display font-bold tracking-tight">
          <GradientText>My Voice Profiles</GradientText>
        </h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          Consent-gated reference timbres for authorised voice transformation. A profile stores
          metadata and an optional private reference sample — no voice model is trained here.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <GlassCard>
          <SectionHeading
            eyebrow="Library"
            title={`${profiles.length} registered profile${profiles.length === 1 ? "" : "s"}`}
            action={
              <StatusPill tone={providerReady ? "success" : "warning"} icon={providerReady ? "check" : "lock"}>
                {providerReady ? "Conversion provider configured" : "Conversion provider not configured"}
              </StatusPill>
            }
          />
          {loading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : profiles.length === 0 ? (
            <EmptyState
              icon="voice"
              title="No voice profiles"
              description="Register a performer's authorised timbre on the right. Neural conversion itself stays disabled until a licensed provider is connected — this studio will not fake a converted voice."
            />
          ) : (
            <ul className="space-y-2">
              {profiles.map((profile) => (
                <li key={profile.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet/40 to-cyan/30 text-[10px] font-bold text-white">
                          {profile.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-softwhite">{profile.name}</span>
                        <StatusPill tone="success" icon="check">
                          Consent recorded
                        </StatusPill>
                      </div>
                      <div className="mt-1 text-[10px] text-muted">
                        {profile.genreSuitability} · consent by {profile.consentName} ·{" "}
                        {relativeTime(profile.createdAt)}
                      </div>
                      {profile.timbreDescription ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                          {profile.timbreDescription}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {profile.referenceAssetId && project ? (
                        <button
                          className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-muted hover:text-white"
                          onClick={() => {
                            const asset = project.assets.find((a) => a.id === profile.referenceAssetId);
                            if (asset) {
                              void playAsset({ id: asset.id, name: asset.name }, project.id);
                            } else {
                              notify("error", "Reference sample not found", "It may belong to another project.");
                            }
                          }}
                        >
                          <Icon
                            name={
                              player.assetId === profile.referenceAssetId && player.playing ? "pause" : "play"
                            }
                            size={11}
                            filled
                          />
                          Reference
                        </button>
                      ) : null}
                      <button
                        className="rounded-lg border border-rose-400/30 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-500/10"
                        onClick={async () => {
                          try {
                            await api.deleteVoiceProfile(profile.id);
                            await load();
                            notify("info", "Profile deleted");
                          } catch (err) {
                            notify("error", "Delete failed", (err as Error).message);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-[11px] leading-relaxed text-amber-100/90">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <Icon name="alert" size={13} /> Honest capability status
            </div>
            Voice conversion requires a licensed neural provider (and the right to use the reference
            voice). No provider is connected, so Sam Vocal Studio shows the tool as unavailable rather
            than producing a fake result. Registering consent here prepares your library for when a
            provider is configured with <span className="mono">VOICE_CONVERSION_API_URL</span>.
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeading eyebrow="New profile" title="Register authorised voice" />
          <div className="space-y-3">
            <div>
              <label className="label mb-1 block" htmlFor="vp-name">
                Profile name
              </label>
              <input
                id="vp-name"
                className="field text-xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chidi — warm alto"
              />
            </div>
            <div>
              <label className="label mb-1 block" htmlFor="vp-genre">
                Genre suitability
              </label>
              <input
                id="vp-genre"
                className="field text-xs"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              />
            </div>
            <div>
              <label className="label mb-1 block" htmlFor="vp-timbre">
                Timbre notes
              </label>
              <textarea
                id="vp-timbre"
                className="field resize-y text-xs"
                rows={2}
                value={timbre}
                onChange={(e) => setTimbre(e.target.value)}
                placeholder="Bright upper register, soft vibrato, tight low end…"
              />
            </div>
            <div>
              <label className="label mb-1 block" htmlFor="vp-consent">
                Consent given by
              </label>
              <input
                id="vp-consent"
                className="field text-xs"
                value={consentName}
                onChange={(e) => setConsentName(e.target.value)}
                placeholder="Performer's name"
              />
            </div>
            <div>
              <label className="label mb-1 block" htmlFor="vp-ref">
                Reference recording (optional, needs an open project)
              </label>
              <input
                id="vp-ref"
                ref={fileRef}
                type="file"
                accept="audio/*,.wav,.mp3,.aiff,.flac"
                className="block w-full text-[10px] text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2 file:py-1.5 file:text-[10px] file:text-softwhite"
                onChange={(e) => setReferenceFile(e.target.files?.[0] ?? null)}
                disabled={!project}
              />
              <p className="mt-1 text-[10px] text-muted/70">
                {project
                  ? `Stored privately inside “${project.name}” as a reference asset.`
                  : "Open a project first to attach a reference sample."}
              </p>
            </div>
            <div className={cn("rounded-xl border p-2.5", consent ? "border-emerald-400/30 bg-emerald-400/[0.05]" : "border-white/10 bg-black/20")}>
              <Toggle
                checked={consent}
                onChange={setConsent}
                label="I have written permission to use this voice"
                description="I confirm the performer authorised creating backing-vocal timbres with this reference, and that I will not use it to impersonate anyone."
              />
            </div>
            <button className="btn-primary w-full text-xs" onClick={() => void create()} disabled={busy}>
              <Icon name="plus" size={13} /> {busy ? "Registering…" : "Register voice profile"}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
