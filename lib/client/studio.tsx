"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, assetAudioUrl, uploadAsset } from "@/lib/client/api";
import { cacheBuffer, decodeFile, getAudioContext } from "@/lib/client/audio";
import { encodeChannels } from "@/lib/audio/render";
import { extractPeaks } from "@/lib/audio/peaks";
import { dbToGain } from "@/lib/audio/dsp";
import type {
  AssetMeta,
  ExportRecord,
  Genre,
  Project,
  StudioId,
  StudioSettings,
} from "@/lib/types";

export type ToastKind = "success" | "error" | "info" | "working";
export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

export type SaveState = "saved" | "saving" | "dirty" | "error" | "idle";

export interface PlayerState {
  assetId: string | null;
  projectId: string | null;
  name: string;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  gainDb: number;
  loop: boolean;
  ready: boolean;
}

type SystemInfo = Awaited<ReturnType<typeof api.system>>;

interface StudioContextValue {
  ready: boolean;
  loading: boolean;
  loadError: string | null;
  projects: Project[];
  project: Project | null;
  exports: ExportRecord[];
  settings: StudioSettings | null;
  system: SystemInfo | null;
  saveState: SaveState;
  savedAt: string | null;
  busyLabel: string | null;
  setBusyLabel: (label: string | null) => void;
  selectProject: (id: string) => void;
  createProject: (input: {
    name: string;
    genre: Genre;
    bpm: number;
    musicalKey: string;
  }) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<Project>;
  updateProject: (
    updater: (project: Project) => Project,
    options?: { flush?: boolean },
  ) => void;
  replaceProject: (project: Project) => void;
  refresh: () => Promise<void>;
  refreshExports: () => Promise<void>;
  refreshSystem: () => Promise<void>;
  saveNow: () => Promise<void>;
  upload: (
    file: File,
    options: {
      kind?: AssetMeta["kind"];
      role?: string;
      createTrack?: boolean;
      trackName?: string;
    },
  ) => Promise<AssetMeta>;
  uploadChannels: (
    channels: Float32Array[],
    sampleRate: number,
    options: {
      name: string;
      kind?: AssetMeta["kind"];
      role?: string;
      engine?: string;
      derivedFromId?: string | null;
      createTrack?: boolean;
      trackName?: string;
      bitDepth?: number | null;
    },
  ) => Promise<AssetMeta>;
  deleteAsset: (assetId: string) => Promise<void>;
  saveVersion: (note: string, studio: StudioId, label?: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  updateSettings: (patch: Partial<StudioSettings>) => Promise<void>;
  notify: (kind: ToastKind, title: string, message?: string) => void;
  dismissToast: (id: string) => void;
  toasts: Toast[];
  player: PlayerState;
  playAsset: (
    asset: { id: string; name: string },
    projectId: string,
    options?: { gainDb?: number; startAt?: number; loop?: boolean },
  ) => Promise<void>;
  togglePlayback: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlayerGainDb: (db: number) => void;
  setLoop: (loop: boolean) => void;
  stopPlayback: () => void;
  saveExport: (
    blob: Blob,
    meta: Record<string, unknown>,
  ) => Promise<ExportRecord>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

const LS_KEY = "eldermi.currentProject";

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [exportsList, setExportsList] = useState<ExportRecord[]>([]);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const projectRef = useRef<Project | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ project: Project | null }>({ project: null });
  const savingRef = useRef(false);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const notify = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, kind, title, message }]);
    if (kind !== "working") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ---------------------------------------------------------------- */
  /* Loading & persistence                                           */
  /* ---------------------------------------------------------------- */

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, e, sys] = await Promise.all([api.projects(), api.exports(), api.system()]);
      setProjects(p.projects);
      setExportsList(e.exports);
      setSettings(sys.settings);
      setSystem(sys);
      const stored =
        typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
      const initial =
        p.projects.find((x) => x.id === stored) ?? p.projects[0] ?? null;
      projectRef.current = initial;
      setProject(initial);
      if (initial) {
        setSavedAt(initial.updatedAt);
        setSaveState("saved");
      }
      setLoadError(null);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const flushSave = useCallback(async () => {
    const target = pendingRef.current.project;
    if (!target || savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    try {
      const { project: saved } = await api.patchProject(target.id, target);
      setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setProject((prev) => (prev && prev.id === saved.id ? { ...prev, updatedAt: saved.updatedAt } : prev));
      setSavedAt(saved.updatedAt);
      setSaveState("saved");
      pendingRef.current.project = null;
    } catch (err) {
      setSaveState("error");
      notify("error", "Could not save the project", (err as Error).message);
    } finally {
      savingRef.current = false;
    }
  }, [notify]);

  const scheduleSave = useCallback(
    (next: Project, delay = 650) => {
      pendingRef.current.project = next;
      setSaveState("dirty");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushSave();
      }, delay);
    },
    [flushSave],
  );

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await flushSave();
  }, [flushSave]);

  useEffect(() => {
    const handler = () => {
      if (pendingRef.current.project) void flushSave();
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("visibilitychange", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("visibilitychange", handler);
      handler();
    };
  }, [flushSave]);

  const selectProject = useCallback(
    (id: string) => {
      const target = projects.find((p) => p.id === id) ?? null;
      if (!target) return;
      if (pendingRef.current.project) void flushSave();
      projectRef.current = target;
      setProject(target);
      setSavedAt(target.updatedAt);
      setSaveState("saved");
      try {
        window.localStorage.setItem(LS_KEY, id);
      } catch {
        /* storage may be blocked */
      }
    },
    [projects, flushSave],
  );

  const createProject = useCallback(
    async (input: { name: string; genre: Genre; bpm: number; musicalKey: string }) => {
      const { project: created } = await api.createProject(input);
      projectRef.current = created;
      setProjects((prev) => [created, ...prev]);
      setProject(created);
      setSaveState("saved");
      setSavedAt(created.updatedAt);
      try {
        window.localStorage.setItem(LS_KEY, created.id);
      } catch {
        /* ignore */
      }
      notify("success", "Project created", created.name);
      return created;
    },
    [notify],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await api.deleteProject(id);
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (project?.id === id) {
        const next = remaining[0] ?? null;
        projectRef.current = next;
        setProject(next);
        if (next) window.localStorage.setItem(LS_KEY, next.id);
      }
      setExportsList((prev) => prev.filter((e) => e.projectId !== id));
      notify("info", "Project deleted", "Its audio files and exports were removed.");
    },
    [projects, project, notify],
  );

  const duplicateProject = useCallback(
    async (id: string) => {
      const { project: copy } = await api.duplicateProject(id);
      setProjects((prev) => [copy, ...prev]);
      notify("success", "Project duplicated", copy.name);
      return copy;
    },
    [notify],
  );

  const replaceProject = useCallback((next: Project) => {
    projectRef.current = next;
    pendingRef.current.project = null;
    setProjects((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    setProject(next);
    setSavedAt(next.updatedAt);
    setSaveState("saved");
  }, []);

  const updateProject = useCallback(
    (updater: (p: Project) => Project, options?: { flush?: boolean }) => {
      const current = projectRef.current;
      if (!current) return;
      const next = updater(current);
      next.updatedAt = new Date().toISOString();
      projectRef.current = next;
      setProject(next);
      setProjects((list) => list.map((p) => (p.id === next.id ? next : p)));
      if (options?.flush) {
        pendingRef.current.project = next;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void flushSave(), 60);
      } else {
        scheduleSave(next);
      }
    },
    [scheduleSave, flushSave],
  );

  const refresh = useCallback(async () => {
    const { projects: list } = await api.projects();
    setProjects(list);
    setProject((prev) => (prev ? list.find((p) => p.id === prev.id) ?? prev : null));
  }, []);

  const refreshExports = useCallback(async () => {
    const { exports: list } = await api.exports();
    setExportsList(list);
  }, []);

  const refreshSystem = useCallback(async () => {
    const sys = await api.system();
    setSystem(sys);
    setSettings(sys.settings);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Uploads                                                         */
  /* ---------------------------------------------------------------- */

  const doUpload = useCallback(
    async (
      blob: Blob,
      options: {
        name: string;
        kind?: AssetMeta["kind"];
        role?: string;
        engine?: string;
        derivedFromId?: string | null;
        createTrack?: boolean;
        trackName?: string;
        bitDepth?: number | null;
        durationSec: number;
        sampleRate: number;
        channels: number;
        peaks: number[];
      },
    ) => {
      if (!project) throw new Error("Create or open a project first");
      const { asset, project: updated } = await uploadAsset(project.id, {
        file: blob,
        name: options.name,
        kind: options.kind ?? "source",
        role: options.role,
        durationSec: options.durationSec,
        sampleRate: options.sampleRate,
        channels: options.channels,
        bitDepth: options.bitDepth ?? null,
        peaks: options.peaks,
        engine: options.engine,
        derivedFromId: options.derivedFromId ?? null,
        createTrack: options.createTrack,
        trackName: options.trackName,
      });
      replaceProject(updated);
      return asset;
    },
    [project, replaceProject],
  );

  const upload = useCallback(
    async (
      file: File,
      options: {
        kind?: AssetMeta["kind"];
        role?: string;
        createTrack?: boolean;
        trackName?: string;
      },
    ) => {
      if (!project) throw new Error("Create or open a project first");
      const limitMb = settings?.maxUploadMb ?? 80;
      if (file.size > limitMb * 1024 * 1024) {
        throw new Error(
          `${file.name} is ${(file.size / 1048576).toFixed(1)} MB — the limit is ${limitMb} MB.`,
        );
      }
      let decoded;
      try {
        decoded = await decodeFile(file);
      } catch {
        throw new Error(
          `${file.name} could not be decoded. Use WAV, AIFF, FLAC, MP3, OGG or M4A audio.`,
        );
      }
      const maxDuration = settings?.maxDurationSec ?? 720;
      if (decoded.buffer.duration > maxDuration) {
        throw new Error(
          `${file.name} is ${Math.round(decoded.buffer.duration)}s long — the limit is ${maxDuration}s.`,
        );
      }
      const asset = await doUpload(file, {
        name: file.name,
        kind: options.kind ?? "source",
        role: options.role,
        createTrack: options.createTrack ?? true,
        trackName: options.trackName ?? file.name.replace(/\.[^.]+$/, ""),
        bitDepth: decoded.wavInfo?.bitDepth ?? null,
        durationSec: decoded.buffer.duration,
        sampleRate: decoded.wavInfo?.sampleRate ?? decoded.buffer.sampleRate,
        channels: decoded.buffer.numberOfChannels,
        peaks: decoded.peaks,
        engine: "Uploaded audio (decoded in browser)",
      });
      cacheBuffer(asset.id, decoded.buffer);
      notify("success", "Audio imported", `${file.name} · ${decoded.buffer.duration.toFixed(1)} s`);
      return asset;
    },
    [project, settings, doUpload, notify],
  );

  const uploadChannels = useCallback(
    async (
      channels: Float32Array[],
      sampleRate: number,
      options: {
        name: string;
        kind?: AssetMeta["kind"];
        role?: string;
        engine?: string;
        derivedFromId?: string | null;
        createTrack?: boolean;
        trackName?: string;
        bitDepth?: number | null;
      },
    ) => {
      const encoded = await encodeChannels(channels, sampleRate, "wav24");
      const blob = new Blob([new Uint8Array(encoded.bytes)], { type: "audio/wav" });
      const peaks = extractPeaks(channels);
      const durationSec = channels[0].length / sampleRate;
      const asset = await doUpload(blob, {
        name: options.name.match(/\.wav$/i) ? options.name : `${options.name}.wav`,
        kind: options.kind ?? "vocal",
        role: options.role,
        engine: options.engine,
        derivedFromId: options.derivedFromId ?? null,
        createTrack: options.createTrack ?? true,
        trackName: options.trackName ?? options.name.replace(/\.wav$/i, ""),
        bitDepth: 24,
        durationSec,
        sampleRate,
        channels: channels.length,
        peaks,
      });
      const ctx = getAudioContext();
      const buffer = ctx.createBuffer(channels.length, channels[0].length, sampleRate);
      channels.forEach((ch, i) => {
        buffer.getChannelData(i).set(ch.subarray(0, channels[0].length));
      });
      cacheBuffer(asset.id, buffer);
      return asset;
    },
    [doUpload],
  );

  const deleteAsset = useCallback(
    async (assetId: string) => {
      if (!project) return;
      await api.deleteAsset(project.id, assetId);
      const { project: fresh } = await api.project(project.id);
      replaceProject(fresh);
      notify("info", "Audio removed", "Linked tracks and versions were cleaned up.");
    },
    [project, replaceProject, notify],
  );

  const saveVersion = useCallback(
    async (note: string, studio: StudioId, label?: string) => {
      if (!project) return;
      await saveNow();
      const { version } = await api.saveVersion(project.id, { note, studio, label });
      const { project: fresh } = await api.project(project.id);
      replaceProject(fresh);
      notify("success", "Version saved", `${version.label} — ${version.tracks.length} tracks captured.`);
    },
    [project, saveNow, replaceProject, notify],
  );

  const restoreVersion = useCallback(
    async (versionId: string) => {
      if (!project) return;
      const { project: restored } = await api.restoreVersion(project.id, versionId);
      replaceProject(restored);
      notify("success", "Version restored", "Your previous state was saved as a checkpoint.");
    },
    [project, replaceProject, notify],
  );

  const updateSettings = useCallback(
    async (patch: Partial<StudioSettings>) => {
      const { settings: next } = await api.updateSettings(patch);
      setSettings(next);
      notify("success", "Settings updated");
    },
    [notify],
  );

  const saveExport = useCallback(
    async (blob: Blob, meta: Record<string, unknown>) => {
      const { export: record } = await api.saveExport(blob, meta);
      setExportsList((prev) => [record, ...prev]);
      return record;
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /* Player                                                          */
  /* ---------------------------------------------------------------- */

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [player, setPlayer] = useState<PlayerState>({
    assetId: null,
    projectId: null,
    name: "",
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    gainDb: 0,
    loop: false,
    ready: false,
  });

  const ensureGraph = useCallback(() => {
    const el = audioRef.current;
    if (!el) return null;
    if (!sourceRef.current) {
      const ctx = getAudioContext();
      const src = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      src.connect(gain).connect(ctx.destination);
      sourceRef.current = src;
      gainRef.current = gain;
    }
    void getAudioContext().resume().catch(() => {});
    return gainRef.current;
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () =>
      setPlayer((p) => ({ ...p, currentTime: el.currentTime, duration: el.duration || p.duration }));
    const onPlay = () => setPlayer((p) => ({ ...p, playing: true }));
    const onPause = () => setPlayer((p) => ({ ...p, playing: false }));
    const onEnd = () => setPlayer((p) => ({ ...p, playing: false, currentTime: 0 }));
    const onLoaded = () =>
      setPlayer((p) => ({ ...p, ready: true, duration: el.duration || p.duration }));
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnd);
    el.addEventListener("loadedmetadata", onLoaded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, []);

  // Smooth playhead while playing.
  useEffect(() => {
    if (!player.playing) return;
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el) setPlayer((p) => ({ ...p, currentTime: el.currentTime }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [player.playing]);

  const playAsset = useCallback(
    async (
      asset: { id: string; name: string },
      projectId: string,
      options?: { gainDb?: number; startAt?: number; loop?: boolean },
    ) => {
      const el = audioRef.current;
      if (!el) return;
      const gain = ensureGraph();
      if (gain) gain.gain.value = dbToGain(options?.gainDb ?? 0);
      const sameAsset = player.assetId === asset.id;
      const startAt = options?.startAt ?? (sameAsset ? el.currentTime : 0);
      if (!sameAsset) {
        el.src = assetAudioUrl(projectId, asset.id);
        el.load();
      }
      if (options?.loop !== undefined) el.loop = options.loop;
      el.currentTime = startAt;
      setPlayer((p) => ({
        ...p,
        assetId: asset.id,
        projectId,
        name: asset.name,
        gainDb: options?.gainDb ?? 0,
        loop: options?.loop ?? p.loop,
        currentTime: startAt,
        ready: false,
      }));
      try {
        await el.play();
      } catch (err) {
        notify("error", "Playback was blocked", (err as Error).message);
      }
    },
    [ensureGraph, notify, player.assetId],
  );

  const togglePlayback = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    if (el.paused) {
      const gain = ensureGraph();
      if (gain) gain.gain.value = dbToGain(player.gainDb);
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [ensureGraph, player.gainDb]);

  const seek = useCallback((time: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(time, el.duration || time));
    setPlayer((p) => ({ ...p, currentTime: el.currentTime }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setPlayer((p) => ({ ...p, volume }));
    const el = audioRef.current;
    if (el) el.volume = Math.max(0, Math.min(1, volume));
  }, []);

  const setPlayerGainDb = useCallback((db: number) => {
    setPlayer((p) => ({ ...p, gainDb: db }));
    if (gainRef.current) gainRef.current.gain.value = dbToGain(db);
  }, []);

  const setLoop = useCallback((loop: boolean) => {
    setPlayer((p) => ({ ...p, loop }));
    if (audioRef.current) audioRef.current.loop = loop;
  }, []);

  const stopPlayback = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlayer((p) => ({ ...p, playing: false, currentTime: 0 }));
  }, []);

  const value = useMemo<StudioContextValue>(
    () => ({
      ready,
      loading,
      loadError,
      projects,
      project,
      exports: exportsList,
      settings,
      system,
      saveState,
      savedAt,
      busyLabel,
      setBusyLabel,
      selectProject,
      createProject,
      deleteProject,
      duplicateProject,
      updateProject,
      replaceProject,
      refresh,
      refreshExports,
      refreshSystem,
      saveNow,
      upload,
      uploadChannels,
      deleteAsset,
      saveVersion,
      restoreVersion,
      updateSettings,
      notify,
      dismissToast,
      toasts,
      player,
      playAsset,
      togglePlayback,
      seek,
      setVolume,
      setPlayerGainDb,
      setLoop,
      stopPlayback,
      saveExport,
    }),
    [
      ready,
      loading,
      loadError,
      projects,
      project,
      exportsList,
      settings,
      system,
      saveState,
      savedAt,
      busyLabel,
      selectProject,
      createProject,
      deleteProject,
      duplicateProject,
      updateProject,
      replaceProject,
      refresh,
      refreshExports,
      refreshSystem,
      saveNow,
      upload,
      uploadChannels,
      deleteAsset,
      saveVersion,
      restoreVersion,
      updateSettings,
      notify,
      dismissToast,
      toasts,
      player,
      playAsset,
      togglePlayback,
      seek,
      setVolume,
      setPlayerGainDb,
      setLoop,
      stopPlayback,
      saveExport,
    ],
  );

  return (
    <StudioContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" className="hidden" />
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
}
