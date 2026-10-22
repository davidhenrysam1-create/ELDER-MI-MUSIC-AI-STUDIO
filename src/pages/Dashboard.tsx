import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Mic, Sliders, Sparkles, Plus, FolderOpen, Music, Download, Clock,
  ArrowRight, Activity, HardDrive,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Project, AudioFile, ProcessingJob, ExportRecord } from '../lib/supabase'
import { AnimatedWaves, EqualizerBars } from '../components/Decor'
import { StatusBadge } from '../components/StatusBadge'
import { timeAgo } from '../lib/audio-utils'
import { showToast } from '../components/Toast'

type OutletContext = {
  activeProject: Project | null
  setActiveProject: (p: Project | null) => void
}

const studioCards = [
  {
    to: '/vocal-studio',
    name: 'Sam Vocal Studio',
    gradient: 'gradient-text-vocal',
    desc: 'Create AI-assisted choruses, harmonies, ad-libs, vocal doubles, and powerful backing-vocal arrangements.',
    action: 'Open Vocal Studio',
    icon: Mic,
    accent: 'from-neon-violet via-magenta to-cyan-blue',
    glow: 'border-glow',
  },
  {
    to: '/mix-studio',
    name: 'Sam Mix Studio',
    gradient: 'gradient-text-mix',
    desc: 'Analyse your tracks, improve the balance of your song, and refine your mix with AI-assisted production tools.',
    action: 'Open Mix Studio',
    icon: Sliders,
    accent: 'from-cyan-blue via-electric-purple to-neon-violet',
    glow: 'border-glow-cyan',
  },
  {
    to: '/mastering-studio',
    name: 'Sam Mastering Studio',
    gradient: 'gradient-text-master',
    desc: 'Polish your final mix with tonal balancing, dynamics control, loudness analysis, and mastering tools.',
    action: 'Open Mastering Studio',
    icon: Sparkles,
    accent: 'from-warm-orange via-golden-yellow to-magenta',
    glow: 'border-glow-orange',
  },
]

export function Dashboard() {
  const navigate = useNavigate()
  const { setActiveProject } = useOutletContext<OutletContext>()
  const [showNewProject, setShowNewProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [selectedStudio, setSelectedStudio] = useState<'vocal' | 'mix' | 'mastering'>('vocal')
  const [creating, setCreating] = useState(false)

  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [recentJobs, setRecentJobs] = useState<ProcessingJob[]>([])
  const [recentExports, setRecentExports] = useState<ExportRecord[]>([])
  const [fileCount, setFileCount] = useState(0)
  const [storageUsed, setStorageUsed] = useState(0)

  const loadData = useCallback(async () => {
    const [projects, jobs, exports] = await Promise.all([
      supabase.from('projects').select('*').order('updated_at', { ascending: false }).limit(5),
      supabase.from('processing_jobs').select('*, projects!inner(name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('exports').select('*, projects!inner(name)').order('created_at', { ascending: false }).limit(5),
    ])

    setRecentProjects(projects.data as Project[] || [])
    setRecentJobs((jobs.data as ProcessingJob[]) || [])
    setRecentExports((exports.data as ExportRecord[]) || [])

    const { count } = await supabase.from('audio_files').select('*', { count: 'exact', head: true })
    setFileCount(count || 0)

    const { data: sizeData } = await supabase.from('audio_files').select('file_size')
    setStorageUsed(sizeData?.reduce((sum, f) => sum + (f.file_size || 0), 0) || 0)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      showToast('Please enter a project name', 'error')
      return
    }
    setCreating(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: projectName.trim(),
        studio: selectedStudio,
        status: 'draft',
      })
      .select()
      .single()

    if (error) {
      showToast(`Failed to create project: ${error.message}`, 'error')
      setCreating(false)
      return
    }

    sessionStorage.setItem('activeProjectId', data.id)
    setActiveProject(data as Project)
    showToast(`Project "${projectName}" created`, 'success')
    setProjectName('')
    setShowNewProject(false)
    setCreating(false)
    navigate(`/${selectedStudio === 'vocal' ? 'vocal-studio' : selectedStudio === 'mix' ? 'mix-studio' : 'mastering-studio'}`)
  }

  const openProject = (project: Project) => {
    sessionStorage.setItem('activeProjectId', project.id)
    setActiveProject(project)
    const route = project.studio === 'vocal' ? 'vocal-studio' : project.studio === 'mix' ? 'mix-studio' : 'mastering-studio'
    navigate(`/${route}`)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome section */}
      <div className="glass p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-32 opacity-30">
          <AnimatedWaves bars={48} className="h-full" />
        </div>
        <div className="relative z-10">
          <h1 className="font-display text-2xl lg:text-3xl font-bold mb-3">
            <span className="gradient-text-shimmer">Welcome to Elder Mi Music AI Studio</span>
          </h1>
          <p className="text-muted-text text-sm lg:text-base max-w-2xl mb-5">
            Create powerful vocal arrangements, refine your mix, and master your sound with AI-assisted music production tools designed for Afrobeats.
          </p>
          <button
            onClick={() => setShowNewProject(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Create New Project
          </button>
        </div>
      </div>

      {/* Studio cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {studioCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.to}
              onClick={() => navigate(card.to)}
              className={`glass p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:${card.glow} group`}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.accent} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                <Icon size={26} className="text-white" />
              </div>
              <h2 className={`font-display text-lg font-bold mb-2 ${card.gradient}`}>{card.name}</h2>
              <p className="text-sm text-muted-text mb-4 leading-relaxed">{card.desc}</p>
              <div className="flex items-center gap-1.5 text-sm font-medium text-cyan-blue group-hover:gap-2.5 transition-all">
                {card.action}
                <ArrowRight size={16} />
              </div>
              <div className="mt-4 h-8 flex items-end opacity-50">
                <EqualizerBars active={false} bars={12} className="h-full" />
              </div>
            </button>
          )
        })}
      </div>

      {/* Activity grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent projects */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2">
              <FolderOpen size={16} className="text-cyan-blue" />
              Recent Projects
            </h3>
            <button onClick={() => navigate('/projects')} className="text-xs text-cyan-blue hover:underline">
              View all
            </button>
          </div>
          {recentProjects.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen size={32} className="mx-auto text-muted-text/40 mb-2" />
              <p className="text-sm text-muted-text">No projects yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => openProject(project)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${
                      project.studio === 'vocal' ? 'from-neon-violet to-magenta' :
                      project.studio === 'mix' ? 'from-cyan-blue to-electric-purple' :
                      'from-warm-orange to-golden-yellow'
                    } flex items-center justify-center flex-shrink-0`}>
                      {project.studio === 'vocal' ? <Mic size={14} className="text-white" /> :
                       project.studio === 'mix' ? <Sliders size={14} className="text-white" /> :
                       <Sparkles size={14} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-soft-white truncate">{project.name}</p>
                      <p className="text-xs text-muted-text">{timeAgo(project.updated_at)}</p>
                    </div>
                  </div>
                  <StatusBadge status={project.status} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Processing jobs */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2">
              <Activity size={16} className="text-cyan-blue" />
              Processing Jobs
            </h3>
          </div>
          {recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <Activity size={32} className="mx-auto text-muted-text/40 mb-2" />
              <p className="text-sm text-muted-text">No processing jobs yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Clock size={14} className="text-muted-text flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-soft-white truncate">{job.job_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-text">{timeAgo(job.created_at)}</p>
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent exports */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2">
              <Download size={16} className="text-cyan-blue" />
              Recent Exports
            </h3>
            <button onClick={() => navigate('/exports')} className="text-xs text-cyan-blue hover:underline">
              View all
            </button>
          </div>
          {recentExports.length === 0 ? (
            <div className="text-center py-8">
              <Download size={32} className="mx-auto text-muted-text/40 mb-2" />
              <p className="text-sm text-muted-text">No exports yet. Finish a project to export audio.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentExports.map((exp) => (
                <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <Music size={16} className="text-cyan-blue flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-soft-white truncate">{exp.filename}</p>
                    <p className="text-xs text-muted-text">{exp.format.toUpperCase()} · {timeAgo(exp.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage info */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2">
              <HardDrive size={16} className="text-cyan-blue" />
              Storage
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-muted-text mb-1.5">
                <span>{fileCount} audio files</span>
                <span>{formatSize(storageUsed)} used</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-electric-purple to-cyan-blue transition-all"
                  style={{ width: `${Math.min((storageUsed / (1024 * 1024 * 1024)) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-text mt-1.5">
                {formatSize(storageUsed)} of 1 GB used
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-muted-text mb-1">Audio Files</p>
                <p className="font-display text-lg font-semibold text-soft-white">{fileCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-muted-text mb-1">Projects</p>
                <p className="font-display text-lg font-semibold text-soft-white">{recentProjects.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New project modal */}
      {showNewProject && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowNewProject(false)}
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
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  className="input-field"
                  placeholder="My Afrobeats Hit"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-muted-text mb-2">Select Studio</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'vocal', label: 'Vocal', color: 'from-neon-violet to-magenta' },
                    { value: 'mix', label: 'Mix', color: 'from-cyan-blue to-electric-purple' },
                    { value: 'mastering', label: 'Mastering', color: 'from-warm-orange to-golden-yellow' },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSelectedStudio(s.value as 'vocal' | 'mix' | 'mastering')}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        selectedStudio === s.value
                          ? `bg-gradient-to-br ${s.color} text-white scale-[1.02]`
                          : 'bg-white/5 text-muted-text hover:bg-white/10'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewProject(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button onClick={handleCreateProject} disabled={creating} className="btn-primary flex-1">
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
