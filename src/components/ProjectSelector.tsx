import { useState } from 'react'
import { FolderOpen, Plus, ChevronDown } from 'lucide-react'
import type { Project } from '../lib/supabase'
import { StatusBadge } from './StatusBadge'

type ProjectSelectorProps = {
  activeProject: Project | null
  projects: Project[]
  onSelect: (p: Project) => void
  onCreate: () => void
  showPicker: boolean
  setShowPicker: (v: boolean) => void
  newProjectName: string
  setNewProjectName: (v: string) => void
  createProject: () => void
}

export function ProjectSelector({
  activeProject,
  projects,
  onSelect,
  showPicker,
  setShowPicker,
  newProjectName,
  setNewProjectName,
  createProject,
}: ProjectSelectorProps) {
  const [showList, setShowList] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setShowList(!showList)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm"
      >
        <FolderOpen size={16} className="text-cyan-blue" />
        {activeProject ? (
          <span className="text-soft-white">{activeProject.name}</span>
        ) : (
          <span className="text-muted-text">Select a project...</span>
        )}
        <ChevronDown size={14} className="text-muted-text" />
      </button>

      {showList && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowList(false)} />
          <div className="absolute top-full mt-2 left-0 w-72 glass-strong rounded-xl shadow-xl z-50 animate-fade-in max-h-96 overflow-y-auto">
            {projects.length > 0 ? (
              <div className="p-2 space-y-1">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => { onSelect(project); setShowList(false) }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors ${
                      activeProject?.id === project.id ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-soft-white truncate">{project.name}</p>
                      <p className="text-xs text-muted-text">{project.status}</p>
                    </div>
                    <StatusBadge status={project.status} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-text">
                No projects yet for this studio.
              </div>
            )}
            <div className="p-2 border-t border-white/10">
              <button
                onClick={() => { setShowPicker(true); setShowList(false) }}
                className="w-full flex items-center gap-2 p-2.5 rounded-lg text-sm text-cyan-blue hover:bg-white/5 transition-colors"
              >
                <Plus size={16} />
                Create New Project
              </button>
            </div>
          </div>
        </>
      )}

      {showPicker && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="glass-strong p-6 rounded-2xl w-full max-w-md animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold gradient-text mb-4">Create New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-text mb-1.5">Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createProject()}
                  className="input-field"
                  placeholder="My Afrobeats Hit"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPicker(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button onClick={createProject} className="btn-primary flex-1">
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
