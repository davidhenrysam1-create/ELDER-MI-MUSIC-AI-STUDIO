"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/primitives";
import { useStudio } from "@/lib/client/studio";
import { GENRES, type Genre } from "@/lib/types";

const KEYS = ["C major", "A minor", "F# minor", "G minor", "E minor", "D major", "Bb major"];

export function NewProjectButton({ label = "New project" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary text-xs" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} />
        <span className="hidden sm:inline">{label}</span>
      </button>
      <NewProjectDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createProject, notify } = useStudio();
  const router = useRouter();
  const [name, setName] = useState("Untitled Afrobeats Session");
  const [genre, setGenre] = useState<Genre>("Afrobeats");
  const [bpm, setBpm] = useState(104);
  const [musicalKey, setMusicalKey] = useState("F# minor");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      notify("error", "Name your project", "A project name is required.");
      return;
    }
    setBusy(true);
    try {
      await createProject({ name: name.trim(), genre, bpm, musicalKey });
      onClose();
      router.push("/vocal");
    } catch (err) {
      notify("error", "Could not create the project", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Project"
      description="Every project keeps its own audio, vocal layers, mixes, masters and versions. Original files are never overwritten."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            <Icon name="plus" size={14} />
            {busy ? "Creating…" : "Create project"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="project-name" className="label mb-1.5 block">
            Project name
          </label>
          <input
            id="project-name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lagos Nightfall"
            autoFocus
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="project-genre" className="label mb-1.5 block">
              Genre
            </label>
            <select
              id="project-genre"
              className="field"
              value={genre}
              onChange={(e) => setGenre(e.target.value as Genre)}
            >
              {GENRES.map((g) => (
                <option key={g} value={g} className="bg-[#15112B]">
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="project-bpm" className="label mb-1.5 block">
              Tempo (BPM)
            </label>
            <input
              id="project-bpm"
              type="number"
              min={40}
              max={240}
              className="field"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="project-key" className="label mb-1.5 block">
              Key
            </label>
            <select
              id="project-key"
              className="field"
              value={musicalKey}
              onChange={(e) => setMusicalKey(e.target.value)}
            >
              {KEYS.map((k) => (
                <option key={k} value={k} className="bg-[#15112B]">
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-[11px] leading-relaxed text-muted">
          <span className="font-semibold text-softwhite">Tip:</span> after creating the project, upload
          your instrumental, lead vocal or stems. All three studios read the same project, so you can
          move from vocals → mix → master without losing context.
        </div>
      </div>
    </Modal>
  );
}
