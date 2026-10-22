import { useState } from 'react'
import {
  Mic, Music2, Users, Sparkles, Copy, Volume2, Radio,
  Plus, Play, Pause, VolumeX, Headphones, Trash2, Edit3,
  Wand2, Info,
} from 'lucide-react'
import { useStudioProject } from '../lib/use-studio-project'
import { ProjectSelector } from '../components/ProjectSelector'
import { AudioUploader } from '../components/AudioUploader'
import { PromptEditor } from '../components/PromptEditor'
import { AnimatedWaves } from '../components/Decor'
import { showToast } from '../components/Toast'

type VocalTool = {
  id: string
  name: string
  icon: typeof Mic
  desc: string
  color: string
}

const vocalTools: VocalTool[] = [
  { id: 'chorus', name: 'AI Chorus Generator', icon: Music2, desc: 'Generate energetic Afrobeats choruses with layered backing vocals and call-and-response phrases.', color: 'from-neon-violet to-magenta' },
  { id: 'harmony', name: 'AI Harmony Generator', icon: Mic, desc: 'Create high, middle, and low harmonies, octave doubles, and unison layers.', color: 'from-magenta to-cyan-blue' },
  { id: 'adlib', name: 'AI Ad-Lib Generator', icon: Radio, desc: 'Generate short vocal expressions, chants, hype vocals, and rhythmic fills.', color: 'from-cyan-blue to-electric-purple' },
  { id: 'choir', name: 'SA-Inspired Choir Generator', icon: Users, desc: 'Group vocals, layered harmonies, sustained ensemble vocals, and rhythmic chanting.', color: 'from-electric-purple to-neon-violet' },
  { id: 'doubling', name: 'AI Vocal Doubling', icon: Copy, desc: 'Create vocal doubles for thickness and width in the lead vocal.', color: 'from-warm-orange to-magenta' },
  { id: 'transform', name: 'Voice Transformation', icon: Wand2, desc: 'Use authorised reference recordings to create different vocal timbres.', color: 'from-golden-yellow to-warm-orange' },
  { id: 'backing', name: 'Backing Vocal Generator', icon: Volume2, desc: 'Generate supporting vocal parts that sit behind the lead.', color: 'from-neon-violet to-cyan-blue' },
  { id: 'arranger', name: 'Vocal Arrangement Assistant', icon: Sparkles, desc: 'AI-guided arrangement of all vocal layers for a complete production.', color: 'from-cyan-blue to-golden-yellow' },
]

type Track = {
  id: string
  name: string
  type: 'lead' | 'harmony' | 'chorus' | 'adlib' | 'choir' | 'double'
  color: string
  volume: number
  pan: number
  muted: boolean
  solo: boolean
}

const initialTracks: Track[] = [
  { id: 't1', name: 'Lead Vocal', type: 'lead', color: 'from-neon-violet to-magenta', volume: 80, pan: 0, muted: false, solo: false },
]

const trackTypeColors: Record<string, string> = {
  lead: 'from-neon-violet to-magenta',
  harmony: 'from-cyan-blue to-electric-purple',
  chorus: 'from-magenta to-warm-orange',
  adlib: 'from-golden-yellow to-warm-orange',
  choir: 'from-electric-purple to-neon-violet',
  double: 'from-cyan-blue to-magenta',
}

const aiStatus: Record<string, 'configured' | 'awaiting'> = {
  chorus: 'awaiting',
  harmony: 'awaiting',
  adlib: 'awaiting',
  choir: 'awaiting',
  doubling: 'awaiting',
  transform: 'awaiting',
  backing: 'awaiting',
  arranger: 'awaiting',
}

export function VocalStudio() {
  const studio = useStudioProject('vocal')
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>(initialTracks)
  const [intensity, setIntensity] = useState(60)
  const [density, setDensity] = useState(50)
  const [layers, setLayers] = useState(4)
  const [style, setStyle] = useState('energetic')
  const [section, setSection] = useState('chorus')
  const [showConsent, setShowConsent] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)

  const handleGenerate = () => {
    if (!studio.activeProject) {
      showToast('Please select or create a project first', 'error')
      return
    }
    if (selectedTool === 'transform' && !consentGiven) {
      setShowConsent(true)
      return
    }

    const tool = vocalTools.find((t) => t.id === selectedTool)
    if (!tool) return

    const newTrack: Track = {
      id: `t${Date.now()}`,
      name: `${tool.name.replace('AI ', '').replace(' Generator', '')} ${tracks.filter((t) => t.type === tool.id || (tool.id === 'doubling' && t.type === 'double')).length + 1}`,
      type: (tool.id === 'doubling' ? 'double' : tool.id === 'backing' ? 'chorus' : tool.id) as Track['type'],
      color: trackTypeColors[tool.id === 'doubling' ? 'double' : tool.id === 'backing' ? 'chorus' : tool.id] || 'from-electric-purple to-cyan-blue',
      volume: 70,
      pan: 0,
      muted: false,
      solo: false,
    }

    setTracks((prev) => [...prev, newTrack])
    showToast(`Track "${newTrack.name}" added. AI generation is awaiting service configuration — the track lane is ready for audio.`, 'info')
  }

  const toggleMute = (id: string) => {
    setTracks((prev) => prev.map((t) => t.id === id ? { ...t, muted: !t.muted } : t))
  }
  const toggleSolo = (id: string) => {
    setTracks((prev) => prev.map((t) => t.id === id ? { ...t, solo: !t.solo } : t))
  }
  const removeTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id))
  }
  const renameTrack = (id: string, name: string) => {
    setTracks((prev) => prev.map((t) => t.id === id ? { ...t, name } : t))
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Studio header */}
      <div className="glass p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-24 opacity-30">
          <AnimatedWaves bars={32} className="h-full" />
        </div>
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold gradient-text-vocal flex items-center gap-3">
              <Mic size={28} />
              Sam Vocal Studio
            </h1>
            <p className="text-sm text-muted-text mt-1">
              AI-assisted vocal production for Afrobeats — choruses, harmonies, ad-libs, and backing vocals.
            </p>
          </div>
          <ProjectSelector
            activeProject={studio.activeProject}
            projects={studio.projects}
            onSelect={studio.selectProject}
            onCreate={() => studio.setShowProjectPicker(true)}
            showPicker={studio.showProjectPicker}
            setShowPicker={studio.setShowProjectPicker}
            newProjectName={studio.newProjectName}
            setNewProjectName={studio.setNewProjectName}
            createProject={studio.createProject}
          />
        </div>
      </div>

      {!studio.activeProject ? (
        <div className="glass p-12 text-center">
          <Mic size={48} className="mx-auto text-muted-text/40 mb-3" />
          <h2 className="font-display text-lg font-semibold text-soft-white mb-2">No Project Selected</h2>
          <p className="text-sm text-muted-text mb-4">Create or select a project to start producing vocals.</p>
          <button onClick={() => studio.setShowProjectPicker(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Create New Project
          </button>
        </div>
      ) : (
        <>
          {/* Upload area */}
          <AudioUploader projectId={studio.activeProject.id} category="instrumental" />

          {/* Vocal tools grid */}
          <div>
            <h2 className="font-display text-sm font-semibold text-soft-white mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-neon-violet" />
              Vocal Production Tools
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {vocalTools.map((tool) => {
                const Icon = tool.icon
                const isSelected = selectedTool === tool.id
                return (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                    className={`glass p-4 text-left transition-all duration-300 hover:scale-[1.02] ${
                      isSelected ? 'border-glow ring-1 ring-neon-violet/50' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-3`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <h3 className="text-sm font-medium text-soft-white mb-1">{tool.name}</h3>
                    <p className="text-xs text-muted-text leading-relaxed line-clamp-2">{tool.desc}</p>
                    {aiStatus[tool.id] === 'awaiting' && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-golden-yellow/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-golden-yellow/70" />
                        Awaiting configuration
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tool controls */}
          {selectedTool && (
            <div className="glass p-5 space-y-4 animate-slide-up">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold gradient-text-vocal">
                  {vocalTools.find((t) => t.id === selectedTool)?.name} Controls
                </h3>
                <button onClick={handleGenerate} className="btn-primary inline-flex items-center gap-2">
                  <Plus size={16} />
                  Generate Track
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-muted-text mb-2">Vocal Intensity</label>
                  <input type="range" min="0" max="100" value={intensity} onChange={(e) => setIntensity(+e.target.value)} className="slider" />
                  <p className="text-xs text-cyan-blue mt-1">{intensity}%</p>
                </div>
                <div>
                  <label className="block text-xs text-muted-text mb-2">Arrangement Density</label>
                  <input type="range" min="0" max="100" value={density} onChange={(e) => setDensity(+e.target.value)} className="slider" />
                  <p className="text-xs text-cyan-blue mt-1">{density}%</p>
                </div>
                <div>
                  <label className="block text-xs text-muted-text mb-2">Number of Layers</label>
                  <input type="range" min="1" max="8" value={layers} onChange={(e) => setLayers(+e.target.value)} className="slider" />
                  <p className="text-xs text-cyan-blue mt-1">{layers} layers</p>
                </div>
                <div>
                  <label className="block text-xs text-muted-text mb-2">Song Section</label>
                  <select value={section} onChange={(e) => setSection(e.target.value)} className="input-field text-sm py-2">
                    <option value="intro">Intro</option>
                    <option value="verse">Verse</option>
                    <option value="pre-chorus">Pre-Chorus</option>
                    <option value="chorus">Chorus</option>
                    <option value="bridge">Bridge</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-text mb-2">Performance Style</label>
                <div className="flex flex-wrap gap-2">
                  {['energetic', 'smooth', 'aggressive', 'melodic', 'rhythmic', 'emotional'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        style === s ? 'bg-gradient-to-r from-neon-violet to-magenta text-white' : 'bg-white/5 text-muted-text hover:bg-white/10'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedTool === 'transform' && (
                <div className="rounded-xl bg-warm-orange/5 border border-warm-orange/20 p-4">
                  <div className="flex items-start gap-3">
                    <Info size={16} className="text-warm-orange flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-soft-white mb-2">Voice Transformation requires consent confirmation.</p>
                      <p className="text-xs text-muted-text mb-3">
                        You must have ownership or explicit consent to use any reference voice. Misuse of voice transformation may violate rights of performers.
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consentGiven}
                          onChange={(e) => setConsentGiven(e.target.checked)}
                          className="w-4 h-4 rounded accent-warm-orange"
                        />
                        <span className="text-sm text-soft-white">I confirm I have ownership or consent to use this voice.</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prompt editor */}
          <PromptEditor
            studioType="vocal"
            placeholder="Example: Generate an energetic Afrobeats chorus with layered backing vocals, catchy call-and-response phrases, high harmonies, low harmonies, and rhythmic group vocals. Keep the lead vocal clear and make the arrangement feel natural and exciting."
            applyLabel="Apply Vocal Arrangement"
          />

          {/* Vocal timeline */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2">
                <Music2 size={16} className="text-neon-violet" />
                Vocal Timeline
              </h3>
              <span className="text-xs text-muted-text">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 transition-all ${
                    track.muted ? 'opacity-40' : ''
                  }`}
                >
                  {/* Track color indicator */}
                  <div className={`w-1.5 h-12 rounded-full bg-gradient-to-b ${track.color} flex-shrink-0`} />

                  {/* Play controls */}
                  <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Play size={14} className="text-soft-white" />
                  </button>

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={track.name}
                      onChange={(e) => renameTrack(track.id, e.target.value)}
                      className="bg-transparent text-sm font-medium text-soft-white outline-none border-b border-transparent hover:border-white/20 focus:border-cyan-blue transition-colors w-full"
                    />
                    {/* Mini waveform */}
                    <div className="flex items-end gap-[2px] h-6 mt-1">
                      {Array.from({ length: 60 }).map((_, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full bg-gradient-to-t ${track.color} opacity-40`}
                          style={{ height: `${20 + Math.sin(i * 0.3 + track.id.length) * 30 + Math.random() * 40}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Volume */}
                  <div className="hidden sm:flex items-center gap-2 w-28 flex-shrink-0">
                    <Volume2 size={14} className="text-muted-text" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={track.volume}
                      onChange={(e) => setTracks((prev) => prev.map((t) => t.id === track.id ? { ...t, volume: +e.target.value } : t))}
                      className="slider"
                    />
                  </div>

                  {/* Mute / Solo */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleMute(track.id)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        track.muted ? 'bg-magenta/20 text-magenta' : 'bg-white/5 text-muted-text hover:bg-white/10'
                      }`}
                    >
                      M
                    </button>
                    <button
                      onClick={() => toggleSolo(track.id)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        track.solo ? 'bg-golden-yellow/20 text-golden-yellow' : 'bg-white/5 text-muted-text hover:bg-white/10'
                      }`}
                    >
                      S
                    </button>
                  </div>

                  {/* Delete */}
                  {track.type !== 'lead' && (
                    <button
                      onClick={() => removeTrack(track.id)}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-magenta/20 text-muted-text hover:text-magenta flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add track button */}
            <button
              onClick={() => {
                setTracks((prev) => [...prev, {
                  id: `t${Date.now()}`,
                  name: 'New Track',
                  type: 'harmony',
                  color: 'from-cyan-blue to-electric-purple',
                  volume: 70,
                  pan: 0,
                  muted: false,
                  solo: false,
                }])
              }}
              className="mt-3 w-full py-3 rounded-xl border-2 border-dashed border-white/10 hover:border-white/20 text-muted-text hover:text-soft-white transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={16} />
              Add Track
            </button>
          </div>

          {/* Export section */}
          <div className="glass p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-soft-white">Export Vocal Arrangement</h3>
                <p className="text-xs text-muted-text mt-1">Export individual tracks or the full vocal arrangement. Original audio remains unchanged.</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost text-sm">Export Individual Tracks</button>
                <button className="btn-primary text-sm">Render & Export All</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Consent modal */}
      {showConsent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowConsent(false)}>
          <div className="glass-strong p-6 rounded-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <Info size={20} className="text-warm-orange flex-shrink-0 mt-1" />
              <div>
                <h2 className="font-display text-lg font-bold text-soft-white">Voice Consent Required</h2>
                <p className="text-sm text-muted-text mt-1">
                  Voice transformation requires that you have ownership or explicit consent to use the reference voice.
                  Misuse may violate rights of performers and is your responsibility.
                </p>
              </div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="w-4 h-4 rounded accent-warm-orange mt-0.5"
              />
              <span className="text-sm text-soft-white">I confirm I have ownership or explicit consent to use this voice for transformation.</span>
            </label>
            <div className="flex gap-3">
              <button onClick={() => setShowConsent(false)} className="btn-ghost flex-1">Cancel</button>
              <button
                onClick={() => { setShowConsent(false); handleGenerate() }}
                disabled={!consentGiven}
                className="btn-primary flex-1"
              >
                Confirm & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
