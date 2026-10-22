import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Mic, Sliders, Sparkles, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Project } from '../lib/supabase'
import { StatusBadge } from '../components/StatusBadge'
import { showToast } from '../components/Toast'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/audio-utils'

export function Projects() {
  const navigate = useNavigate()
  const { setActiveProject } = useAuth() as never
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'vocal' | 'mix' | 'mastering'>('all')
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStudio, setNewStudio] = useState<'vocal' | 'mix' | 'mastering'>('vocal')

  const loadProjects = useCallback(async () => {
    let query = supabase.from('projects').select('*').order('updated_at', { ascending: false })
    if (filter !== 'all') query = query.eq('studio', filter)
    const { data } = await query
    setProjects(data as Project[] || [])
  }, [filter])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const openProject = (project: Project) => {
    sessionStorage.setItem('activeProjectId', project.id)
    const route = project.studio === 'vocal' ? 'vocal-studio' : project.studio === 'mix' ? 'mix-studio' : 'mastering-studio'
    navigate(`/${route}`)
  }

  const deleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"? This will also delete all associated audio files and exports.`)) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) {
      showToast(`Failed to delete: ${error.message}`, 'error')
    } else {
      showToast(`Project "${name}" deleted`, 'success')
      loadProjects()
    }
  }

  const createProject = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: newName.trim(), studio: newStudio, status: 'draft' })
      .select()
      .single()
    if (error) {
      showToast(`Failed to create: ${error.message}`, 'error')
      return
    }
    sessionStorage.setItem('activeProjectId', data.id)
    showToast(`Project "${newName}" created`, 'success')
    setShowNew(false)
    setNewName('')
    const route = newStudio === 'vocal' ? 'vocal-studio' : newStudio === 'mix' ? 'mix-studio' : 'mastering-studio'
    navigate(`/${route}`)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-text">My Projects</h1>
          <p className="text-sm text-muted-text mt-1">Manage all your music production projects.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="glass p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="input-field pl-10 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'vocal', 'mix', 'mastering'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                filter === f ? 'bg-gradient-to-r from-electric-purple to-cyan-blue text-white' : 'bg-white/5 text-muted-text hover:bg-white/10'
              }`}
            >
              {f === 'all' ? 'All' : f === 'vocal' ? 'Vocal' : f === 'mix' ? 'Mix' : 'Mastering'}
            </button>
          ))}
        </div>
      </div>

      {/* Projects grid */}
      {filtered.length === 0 ? (
        <div className="glass p-12 text-center">
          <FolderOpen size={48} className="mx-auto text-muted-text/40 mb-3" />
          <h2 className="font-display text-lg font-semibold text-soft-white mb-2">No Projects Found</h2>
          <p className="text-sm text-muted-text mb-4">Create your first project to get started.</p>
          <button onClick={() => setShowNew(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="glass p-5 hover:scale-[1.02] transition-all cursor-pointer group"
              onClick={() => openProject(project)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                  project.studio === 'vocal' ? 'from-neon-violet to-magenta' :
                  project.studio === 'mix' ? 'from-cyan-blue to-electric-purple' :
                  'from-warm-orange to-golden-yellow'
                } flex items-center justify-center`}>
                  {project.studio === 'vocal' ? <Mic size={18} className="text-white" /> :
                   project.studio === 'mix' ? <Sliders size={18} className="text-white" /> :
                   <Sparkles size={18} className="text-white" />}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteProject(project.id, project.name) }}
                  className="p-1.5 rounded-lg text-muted-text hover:text-magenta hover:bg-magenta/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <h3 className="font-display text-sm font-semibold text-soft-white mb-1">{project.name}</h3>
              <p className="text-xs text-muted-text capitalize mb-3">{project.studio} studio</p>
              <div className="flex items-center justify-between">
                <StatusBadge status={project.status} />
                <span className="text-xs text-muted-text">{timeAgo(project.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New project modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowNew(false)}>
          <div className="glass-strong p-6 rounded-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold gradient-text mb-4">Create New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-text mb-1.5">Project Name</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createProject()} className="input-field" placeholder="My Afrobeats Hit" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-muted-text mb-2">Select Studio</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'vocal', label: 'Vocal', color: 'from-neon-violet to-magenta' },
                    { value: 'mix', label: 'Mix', color: 'from-cyan-blue to-electric-purple' },
                    { value: 'mastering', label: 'Mastering', color: 'from-warm-orange to-golden-yellow' },
                  ].map((s) => (
                    <button key={s.value} onClick={() => setNewStudio(s.value as 'vocal' | 'mix' | 'mastering')} className={`p-3 rounded-xl text-sm font-medium transition-all ${newStudio === s.value ? `bg-gradient-to-br ${s.color} text-white scale-[1.02]` : 'bg-white/5 text-muted-text hover:bg-white/10'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNew(false)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={createProject} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
