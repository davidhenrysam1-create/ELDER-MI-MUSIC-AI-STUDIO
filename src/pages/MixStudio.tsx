import { useState } from 'react'
import {
  Sliders, Upload, FileAudio, Info, Play, Pause,
  Volume2, Headphones, Settings2, ChevronDown, ChevronUp,
  Music, Zap,
} from 'lucide-react'
import { useStudioProject } from '../lib/use-studio-project'
import { ProjectSelector } from '../components/ProjectSelector'
import { AudioUploader } from '../components/AudioUploader'
import { PromptEditor } from '../components/PromptEditor'
import { AnimatedWaves, EqualizerBars } from '../components/Decor'
import { formatFileSize } from '../lib/audio-utils'
import { showToast } from '../components/Toast'

const genrePresets = [
  { name: 'Modern Afrobeats', desc: 'Balanced mix with punchy percussion and clear vocals', settings: { vocalClarity: 70, bassControl: 60, percussionEnergy: 75, reverb: 30, delay: 20, stereoWidth: 65 } },
  { name: 'Afro-Pop', desc: 'Polished, radio-friendly sound with smooth vocals', settings: { vocalClarity: 80, bassControl: 55, percussionEnergy: 60, reverb: 40, delay: 30, stereoWidth: 70 } },
  { name: 'Afro-Fusion', desc: 'Warm, organic blend with natural dynamics', settings: { vocalClarity: 65, bassControl: 65, percussionEnergy: 60, reverb: 35, delay: 25, stereoWidth: 60 } },
  { name: 'Amapiano-Influenced', desc: 'Deep bass, wide percussion, atmospheric pads', settings: { vocalClarity: 60, bassControl: 80, percussionEnergy: 70, reverb: 50, delay: 35, stereoWidth: 80 } },
]

const mixControls = [
  { id: 'gain', label: 'Track Gain', min: -12, max: 12, unit: 'dB', default: 0 },
  { id: 'pan', label: 'Pan', min: -100, max: 100, unit: '%', default: 0 },
  { id: 'eq', label: 'Equalisation', min: 0, max: 100, unit: '%', default: 50 },
  { id: 'compression', label: 'Compression', min: 0, max: 100, unit: '%', default: 40 },
  { id: 'reverb', label: 'Reverb', min: 0, max: 100, unit: '%', default: 30 },
  { id: 'delay', label: 'Delay', min: 0, max: 100, unit: '%', default: 20 },
  { id: 'stereoWidth', label: 'Stereo Width', min: 0, max: 100, unit: '%', default: 65 },
  { id: 'vocalBalance', label: 'Vocal Balance', min: 0, max: 100, unit: '%', default: 70 },
  { id: 'bassControl', label: 'Bass Control', min: 0, max: 100, unit: '%', default: 60 },
  { id: 'kickBalance', label: 'Kick Balance', min: 0, max: 100, unit: '%', default: 65 },
  { id: 'percussionClarity', label: 'Percussion Clarity', min: 0, max: 100, unit: '%', default: 70 },
]

type MixChannel = {
  id: string
  name: string
  gain: number
  pan: number
  muted: boolean
  solo: boolean
  color: string
}

const defaultChannels: MixChannel[] = [
  { id: 'ch1', name: 'Kick', gain: 0, pan: 0, muted: false, solo: false, color: 'from-warm-orange to-golden-yellow' },
  { id: 'ch2', name: 'Bass', gain: 0, pan: 0, muted: false, solo: false, color: 'from-electric-purple to-neon-violet' },
  { id: 'ch3', name: 'Lead Vocal', gain: 0, pan: 0, muted: false, solo: false, color: 'from-cyan-blue to-electric-purple' },
  { id: 'ch4', name: 'Percussion', gain: 0, pan: 20, muted: false, solo: false, color: 'from-magenta to-warm-orange' },
  { id: 'ch5', name: 'Backing Vocals', gain: -3, pan: -15, muted: false, solo: false, color: 'from-neon-violet to-magenta' },
  { id: 'ch6', name: 'Keys / Pads', gain: -2, pan: 10, muted: false, solo: false, color: 'from-cyan-blue to-neon-violet' },
]

export function MixStudio() {
  const studio = useStudioProject('mix')
  const [channels, setChannels] = useState<MixChannel[]>(defaultChannels)
  const [controlValues, setControlValues] = useState<Record<string, number>>(
    Object.fromEntries(mixControls.map((c) => [c.id, c.default]))
  )
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showStemGuide, setShowStemGuide] = useState(false)

  const applyPreset = (preset: typeof genrePresets[0]) => {
    setActivePreset(preset.name)
    setControlValues((prev) => ({ ...prev, ...preset.settings }))
    showToast(`Applied "${preset.name}" preset — adjust to taste`, 'success')
  }

  const toggleMute = (id: string) => setChannels((prev) => prev.map((c) => c.id === id ? { ...c, muted: !c.muted } : c))
  const toggleSolo = (id: string) => setChannels((prev) => prev.map((c) => c.id === id ? { ...c, solo: !c.solo } : c))

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Studio header */}
      <div className="glass p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-24 opacity-30">
          <EqualizerBars active={true} bars={20} className="h-full" />
        </div>
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold gradient-text-mix flex items-center gap-3">
              <Sliders size={28} />
              Sam Mix Studio
            </h1>
            <p className="text-sm text-muted-text mt-1">
              AI-assisted mixing for Afrobeats — analyse tracks, improve balance, and refine your sound.
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
          <Sliders size={48} className="mx-auto text-muted-text/40 mb-3" />
          <h2 className="font-display text-lg font-semibold text-soft-white mb-2">No Project Selected</h2>
          <p className="text-sm text-muted-text mb-4">Create or select a project to start mixing.</p>
        </div>
      ) : (
        <>
          {/* Upload area */}
          <div className="space-y-3">
            <AudioUploader projectId={studio.activeProject.id} category="stem" />

            {/* FL Studio / Cubase guide */}
            <div className="glass p-4">
              <button
                onClick={() => setShowStemGuide(!showStemGuide)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-cyan-blue" />
                  <span className="text-sm font-medium text-soft-white">How to export stems from FL Studio or Cubase</span>
                </div>
                {showStemGuide ? <ChevronUp size={16} className="text-muted-text" /> : <ChevronDown size={16} className="text-muted-text" />}
              </button>
              {showStemGuide && (
                <div className="mt-4 space-y-4 animate-slide-up">
                  <div className="rounded-xl bg-white/5 p-4">
                    <h4 className="text-sm font-medium text-cyan-blue mb-2">FL Studio</h4>
                    <ol className="text-xs text-muted-text space-y-1.5 list-decimal list-inside">
                      <li>Open your project in FL Studio</li>
                      <li>Go to File &gt; Export &gt; Zipped loop package, or export each track individually</li>
                      <li>For individual stems: right-click each mixer track &gt; "Render track" or use the "Split mixer tracks" option in the export dialog</li>
                      <li>Select WAV format at your project's sample rate and bit depth</li>
                      <li>Upload the exported stems here using the upload area above</li>
                    </ol>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <h4 className="text-sm font-medium text-cyan-blue mb-2">Cubase</h4>
                    <ol className="text-xs text-muted-text space-y-1.5 list-decimal list-inside">
                      <li>Open your project in Cubase</li>
                      <li>Go to File &gt; Export &gt; Audio Mixdown</li>
                      <li>Select "Import to Pool" and choose WAV format</li>
                      <li>For all stems: use File &gt; Export &gt; Stems (or select tracks and export each one)</li>
                      <li>Ensure you export from the same start position for alignment</li>
                      <li>Upload the exported stems here using the upload area above</li>
                    </ol>
                  </div>
                  <div className="rounded-xl bg-warm-orange/5 border border-warm-orange/20 p-3 flex items-start gap-2">
                    <Info size={14} className="text-warm-orange flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-text">
                      Native project files (.flp, .cpr) depend on plugins, virtual instruments, and audio libraries that this platform cannot reproduce.
                      Always export audio stems for accurate processing.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Genre presets */}
          <div>
            <h2 className="font-display text-sm font-semibold text-soft-white mb-3 flex items-center gap-2">
              <Zap size={16} className="text-cyan-blue" />
              Genre-Aware Starting Points
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {genrePresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className={`glass p-4 text-left transition-all hover:scale-[1.02] ${
                    activePreset === preset.name ? 'border-glow-cyan ring-1 ring-cyan-blue/50' : ''
                  }`}
                >
                  <h3 className="text-sm font-medium text-soft-white mb-1">{preset.name}</h3>
                  <p className="text-xs text-muted-text leading-relaxed">{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt editor */}
          <PromptEditor
            studioType="mix"
            placeholder="Example: Give this Afrobeats song a balanced, modern mix. Improve vocal clarity, control the low frequencies, create space between the bass and kick, keep the percussion energetic, and make the backing vocals sit naturally behind the lead vocal."
            applyLabel="Apply Mixing Recommendations"
          />

          {/* Mixing controls */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2">
                <Settings2 size={16} className="text-cyan-blue" />
                Mixing Controls
              </h3>
              {activePreset && (
                <span className="text-xs text-cyan-blue">Active preset: {activePreset}</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mixControls.slice(0, 6).map((ctrl) => (
                <div key={ctrl.id}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-muted-text">{ctrl.label}</label>
                    <span className="text-xs text-cyan-blue font-mono">{controlValues[ctrl.id]}{ctrl.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={ctrl.min}
                    max={ctrl.max}
                    value={controlValues[ctrl.id]}
                    onChange={(e) => setControlValues((prev) => ({ ...prev, [ctrl.id]: +e.target.value }))}
                    className="slider"
                  />
                </div>
              ))}
            </div>

            {/* Advanced controls */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="mt-4 flex items-center gap-1.5 text-xs text-cyan-blue hover:underline"
            >
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showAdvanced ? 'Hide' : 'Show'} Advanced Controls
            </button>

            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
                {mixControls.slice(6).map((ctrl) => (
                  <div key={ctrl.id}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs text-muted-text">{ctrl.label}</label>
                      <span className="text-xs text-cyan-blue font-mono">{controlValues[ctrl.id]}{ctrl.unit}</span>
                    </div>
                    <input
                      type="range"
                      min={ctrl.min}
                      max={ctrl.max}
                      value={controlValues[ctrl.id]}
                      onChange={(e) => setControlValues((prev) => ({ ...prev, [ctrl.id]: +e.target.value }))}
                      className="slider"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mixer channels */}
          <div className="glass p-5">
            <h3 className="font-display text-sm font-semibold text-soft-white mb-4 flex items-center gap-2">
              <Sliders size={16} className="text-cyan-blue" />
              Mixer Channels
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-4">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`flex-shrink-0 w-28 rounded-xl bg-white/5 border border-white/10 p-3 transition-all ${channel.muted ? 'opacity-40' : ''}`}
                >
                  {/* Channel name */}
                  <p className="text-xs font-medium text-soft-white text-center mb-3 truncate">{channel.name}</p>

                  {/* Level meter */}
                  <div className="h-32 flex items-end justify-center gap-[2px] mb-3 bg-black/30 rounded-lg p-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 rounded-full ${
                          i < 2 ? 'bg-green-400' : i < 4 ? 'bg-golden-yellow' : 'bg-magenta'
                        } ${channel.muted ? 'opacity-20' : 'opacity-80'}`}
                        style={{ height: `${20 + Math.random() * 70}%` }}
                      />
                    ))}
                  </div>

                  {/* Gain knob */}
                  <div className="text-center mb-2">
                    <p className="text-[10px] text-muted-text mb-1">Gain</p>
                    <p className="text-xs text-cyan-blue font-mono">{channel.gain > 0 ? '+' : ''}{channel.gain}dB</p>
                  </div>

                  {/* Pan */}
                  <div className="text-center mb-3">
                    <p className="text-[10px] text-muted-text mb-1">Pan</p>
                    <p className="text-xs text-cyan-blue font-mono">
                      {channel.pan === 0 ? 'C' : channel.pan > 0 ? `R${channel.pan}` : `L${Math.abs(channel.pan)}`}
                    </p>
                  </div>

                  {/* Mute / Solo */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleMute(channel.id)}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                        channel.muted ? 'bg-magenta/20 text-magenta' : 'bg-white/5 text-muted-text hover:bg-white/10'
                      }`}
                    >
                      M
                    </button>
                    <button
                      onClick={() => toggleSolo(channel.id)}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                        channel.solo ? 'bg-golden-yellow/20 text-golden-yellow' : 'bg-white/5 text-muted-text hover:bg-white/10'
                      }`}
                    >
                      S
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload file list */}
          {studio.audioFiles.length > 0 && (
            <div className="glass p-5">
              <h3 className="font-display text-sm font-semibold text-soft-white mb-3 flex items-center gap-2">
                <FileAudio size={16} className="text-cyan-blue" />
                Uploaded Files ({studio.audioFiles.length})
              </h3>
              <div className="space-y-2">
                {studio.audioFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                    <FileAudio size={18} className="text-cyan-blue flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-soft-white truncate">{file.filename}</p>
                      <p className="text-xs text-muted-text">{formatFileSize(file.file_size)} · {file.file_type.toUpperCase()} · {file.category}</p>
                    </div>
                    <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                      <Play size={14} className="text-soft-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
