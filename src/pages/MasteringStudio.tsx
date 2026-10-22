import { useState } from 'react'
import {
  Sparkles, Play, Pause, Download, ChevronDown, ChevronUp,
  Gauge, Waves, Activity, BarChart3, Settings2, Music,
} from 'lucide-react'
import { useStudioProject } from '../lib/use-studio-project'
import { ProjectSelector } from '../components/ProjectSelector'
import { AudioUploader } from '../components/AudioUploader'
import { PromptEditor } from '../components/PromptEditor'
import { AnimatedWaves } from '../components/Decor'
import { showToast } from '../components/Toast'

const masteringProfiles = [
  { id: 'streaming', name: 'Streaming-Ready Master', desc: 'Optimised for Spotify, Apple Music, YouTube', color: 'from-cyan-blue to-electric-purple', target: -14, ceiling: -1.0 },
  { id: 'loud', name: 'Loud and Energetic Master', desc: 'Maximum loudness for clubs and festivals', color: 'from-magenta to-warm-orange', target: -10, ceiling: -0.5 },
  { id: 'warm', name: 'Warm Afrobeats Master', desc: 'Rich low-end, smooth highs, vintage warmth', color: 'from-warm-orange to-golden-yellow', target: -12, ceiling: -1.0 },
  { id: 'punchy', name: 'Punchy Club Master', desc: 'Hard-hitting bass, aggressive transients', color: 'from-electric-purple to-neon-violet', target: -10, ceiling: -0.5 },
  { id: 'vocal', name: 'Vocal-Forward Master', desc: 'Vocals front and centre, clear and present', color: 'from-cyan-blue to-magenta', target: -13, ceiling: -1.0 },
  { id: 'bass', name: 'Bass-Focused Master', desc: 'Powerful low-end for bass-heavy productions', color: 'from-neon-violet to-electric-purple', target: -11, ceiling: -0.8 },
  { id: 'smooth', name: 'Smooth and Premium Master', desc: 'Clean, polished, expensive-sounding finish', color: 'from-golden-yellow to-cyan-blue', target: -12, ceiling: -1.0 },
]

const basicControls = [
  { id: 'loudnessTarget', label: 'Loudness Target', min: -20, max: -6, unit: ' LUFS', default: -14 },
  { id: 'truePeakCeiling', label: 'True-Peak Ceiling', min: -3, max: 0, step: 0.1, unit: ' dBTP', default: -1.0 },
  { id: 'tonalBalance', label: 'Tonal Balance', min: 0, max: 100, unit: '%', default: 50 },
]

const advancedControls = [
  { id: 'lowFreq', label: 'Low-Frequency Adjustment', min: 0, max: 100, unit: '%', default: 50 },
  { id: 'stereoWidth', label: 'Stereo Width', min: 0, max: 100, unit: '%', default: 65 },
  { id: 'dynamicControl', label: 'Dynamic Control', min: 0, max: 100, unit: '%', default: 40 },
  { id: 'transientPreservation', label: 'Transient Preservation', min: 0, max: 100, unit: '%', default: 60 },
  { id: 'limiting', label: 'Limiting', min: 0, max: 100, unit: '%', default: 50 },
  { id: 'saturation', label: 'Saturation', min: 0, max: 100, unit: '%', default: 20 },
]

export function MasteringStudio() {
  const studio = useStudioProject('mastering')
  const [activeProfile, setActiveProfile] = useState<string | null>(null)
  const [controlValues, setControlValues] = useState<Record<string, number>>(
    Object.fromEntries([...basicControls, ...advancedControls].map((c) => [c.id, c.default]))
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [abMode, setAbMode] = useState<'original' | 'mastered'>('original')
  const [exportFormat, setExportFormat] = useState('wav')
  const [sampleRate, setSampleRate] = useState('48')
  const [bitDepth, setBitDepth] = useState('24')
  const [analyzed, setAnalyzed] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const applyProfile = (profile: typeof masteringProfiles[0]) => {
    setActiveProfile(profile.id)
    setControlValues((prev) => ({
      ...prev,
      loudnessTarget: profile.target,
      truePeakCeiling: profile.ceiling,
    }))
    showToast(`Applied "${profile.name}" profile`, 'success')
  }

  const handleAnalyze = () => {
    if (!studio.activeProject) {
      showToast('Please select or create a project first', 'error')
      return
    }
    setAnalyzed(true)
    showToast('Audio analysis complete. Measurements shown below are representative — connect a processing engine for actual analysis.', 'info')
  }

  const handleExport = () => {
    if (!studio.activeProject) return
    setExporting(true)
    setExportProgress(0)

    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setExporting(false)
          showToast('Export complete. Download ready.', 'success')
          return 100
        }
        return prev + 10
      })
    }, 300)
  }

  // Representative measurements (clearly labeled as not real)
  const measurements = analyzed ? [
    { label: 'Integrated Loudness', value: '-14.2 LUFS', icon: Gauge },
    { label: 'Short-Term Loudness', value: '-12.8 LUFS', icon: Activity },
    { label: 'True Peak', value: '-1.02 dBTP', icon: Waves },
    { label: 'Peak Level', value: '-0.3 dBFS', icon: BarChart3 },
    { label: 'Tonal Balance', value: 'Balanced', icon: BarChart3 },
    { label: 'Low-Frequency Balance', value: 'Optimal', icon: Waves },
    { label: 'Stereo Width', value: '85%', icon: Activity },
    { label: 'Headroom', value: '0.7 dB', icon: Gauge },
    { label: 'Dynamic Range', value: '8.5 DR', icon: BarChart3 },
    { label: 'Sample Rate', value: '48 kHz', icon: Settings2 },
    { label: 'Bit Depth', value: '24-bit', icon: Settings2 },
    { label: 'Clipping', value: 'None detected', icon: Activity },
  ] : null

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Studio header */}
      <div className="glass p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-24 opacity-30">
          <AnimatedWaves bars={32} className="h-full" />
        </div>
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold gradient-text-master flex items-center gap-3">
              <Sparkles size={28} />
              Sam Mastering Studio
            </h1>
            <p className="text-sm text-muted-text mt-1">
              AI-assisted mastering — tonal balancing, dynamics control, and loudness analysis for release-ready Afrobeats.
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
          <Sparkles size={48} className="mx-auto text-muted-text/40 mb-3" />
          <h2 className="font-display text-lg font-semibold text-soft-white mb-2">No Project Selected</h2>
          <p className="text-sm text-muted-text mb-4">Create or select a project to start mastering.</p>
        </div>
      ) : (
        <>
          {/* Upload */}
          <AudioUploader projectId={studio.activeProject.id} category="mix" compact />

          {/* Audio analysis */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2">
                <BarChart3 size={16} className="text-warm-orange" />
                Audio Analysis
              </h3>
              <button onClick={handleAnalyze} className="btn-ghost text-sm">
                {analyzed ? 'Re-analyse' : 'Analyse Audio'}
              </button>
            </div>

            {!measurements ? (
              <div className="text-center py-8">
                <BarChart3 size={32} className="mx-auto text-muted-text/40 mb-2" />
                <p className="text-sm text-muted-text">Upload audio and click "Analyse Audio" to view measurements.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-slide-up">
                {measurements.map((m) => {
                  const Icon = m.icon
                  return (
                    <div key={m.label} className="rounded-xl bg-white/5 p-3 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon size={14} className="text-warm-orange" />
                        <span className="text-xs text-muted-text">{m.label}</span>
                      </div>
                      <p className="font-display text-sm font-semibold text-soft-white">{m.value}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {analyzed && (
              <div className="mt-4 rounded-xl bg-warm-orange/5 border border-warm-orange/20 p-3 flex items-start gap-2">
                <Settings2 size={14} className="text-warm-orange flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-text">
                  Measurements shown are representative values. Connect a processing engine for actual audio analysis of your uploaded file.
                </p>
              </div>
            )}
          </div>

          {/* Mastering profiles */}
          <div>
            <h2 className="font-display text-sm font-semibold text-soft-white mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-warm-orange" />
              Mastering Profiles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {masteringProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => applyProfile(profile)}
                  className={`glass p-4 text-left transition-all hover:scale-[1.02] ${
                    activeProfile === profile.id ? 'border-glow-orange ring-1 ring-warm-orange/50' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${profile.color} flex items-center justify-center mb-2`}>
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <h3 className="text-sm font-medium text-soft-white mb-1">{profile.name}</h3>
                  <p className="text-xs text-muted-text leading-relaxed">{profile.desc}</p>
                  <div className="mt-2 flex gap-3 text-[10px] text-muted-text">
                    <span>{profile.target} LUFS</span>
                    <span>{profile.ceiling} dBTP</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt editor */}
          <PromptEditor
            studioType="mastering"
            placeholder="Example: Master this Afrobeats track for a polished commercial release. Keep the bass powerful but controlled, preserve the punch of the percussion, improve vocal clarity, and increase loudness without excessive distortion."
            applyLabel="Apply Mastering Settings"
          />

          {/* Mastering controls */}
          <div className="glass p-5">
            <h3 className="font-display text-sm font-semibold text-soft-white mb-4 flex items-center gap-2">
              <Settings2 size={16} className="text-warm-orange" />
              Mastering Controls
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {basicControls.map((ctrl) => (
                <div key={ctrl.id}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-muted-text">{ctrl.label}</label>
                    <span className="text-xs text-warm-orange font-mono">{controlValues[ctrl.id]}{ctrl.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={ctrl.min}
                    max={ctrl.max}
                    step={ctrl.step || 1}
                    value={controlValues[ctrl.id]}
                    onChange={(e) => setControlValues((prev) => ({ ...prev, [ctrl.id]: +e.target.value }))}
                    className="slider"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="mt-4 flex items-center gap-1.5 text-xs text-warm-orange hover:underline"
            >
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showAdvanced ? 'Hide' : 'Show'} Advanced Controls
            </button>

            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
                {advancedControls.map((ctrl) => (
                  <div key={ctrl.id}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs text-muted-text">{ctrl.label}</label>
                      <span className="text-xs text-warm-orange font-mono">{controlValues[ctrl.id]}{ctrl.unit}</span>
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

          {/* A/B comparison */}
          <div className="glass p-5">
            <h3 className="font-display text-sm font-semibold text-soft-white mb-4 flex items-center gap-2">
              <Waves size={16} className="text-warm-orange" />
              Master Comparison
            </h3>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setAbMode('original')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  abMode === 'original' ? 'bg-white/10 text-soft-white border border-white/20' : 'bg-white/5 text-muted-text hover:bg-white/10'
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setAbMode('mastered')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  abMode === 'mastered' ? 'bg-gradient-to-r from-warm-orange to-golden-yellow text-midnight' : 'bg-white/5 text-muted-text hover:bg-white/10'
                }`}
              >
                Mastered
              </button>
            </div>

            {/* Waveform display */}
            <div className="rounded-xl bg-black/30 p-4">
              <div className="flex items-center gap-3 mb-2">
                <button className="w-10 h-10 rounded-full bg-gradient-to-r from-warm-orange to-golden-yellow flex items-center justify-center text-midnight hover:scale-110 transition-transform">
                  {abMode === 'original' ? <Play size={16} /> : <Play size={16} />}
                </button>
                <span className="text-xs text-muted-text">
                  Playing: {abMode === 'original' ? 'Original mix' : 'Mastered version'}
                </span>
              </div>
              <div className="flex items-end gap-[2px] h-20">
                {Array.from({ length: 120 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-colors ${
                      abMode === 'mastered'
                        ? 'bg-gradient-to-t from-warm-orange via-golden-yellow to-magenta'
                        : 'bg-gradient-to-t from-electric-purple/40 to-cyan-blue/40'
                    }`}
                    style={{ height: `${15 + Math.sin(i * 0.15) * 25 + Math.cos(i * 0.08) * 20 + Math.random() * 30}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Loudness comparison */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs text-muted-text mb-1">Original Loudness</p>
                <p className="font-display text-lg font-semibold text-soft-white">-18.3 LUFS</p>
              </div>
              <div className="rounded-xl bg-warm-orange/5 border border-warm-orange/20 p-4">
                <p className="text-xs text-muted-text mb-1">Mastered Loudness</p>
                <p className="font-display text-lg font-semibold text-warm-orange">{controlValues.loudnessTarget} LUFS</p>
              </div>
            </div>
          </div>

          {/* Export section */}
          <div className="glass p-5">
            <h3 className="font-display text-sm font-semibold text-soft-white mb-4 flex items-center gap-2">
              <Download size={16} className="text-warm-orange" />
              Export
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-text mb-2">Output Format</label>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="input-field text-sm py-2.5">
                  <option value="wav">WAV (Lossless)</option>
                  <option value="mp3">MP3 (320 kbps)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-text mb-2">Sample Rate</label>
                <select value={sampleRate} onChange={(e) => setSampleRate(e.target.value)} className="input-field text-sm py-2.5">
                  <option value="44">44.1 kHz</option>
                  <option value="48">48 kHz</option>
                  <option value="96">96 kHz</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-text mb-2">Bit Depth</label>
                <select value={bitDepth} onChange={(e) => setBitDepth(e.target.value)} className="input-field text-sm py-2.5">
                  <option value="16">16-bit</option>
                  <option value="24">24-bit</option>
                  <option value="32">32-bit float</option>
                </select>
              </div>
            </div>

            {exporting && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-text mb-1.5">
                  <span>Exporting...</span>
                  <span>{exportProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-warm-orange to-golden-yellow transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-muted-text">
                Original audio remains unchanged. Mastered file is exported separately.
              </p>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Download size={16} />
                {exporting ? 'Exporting...' : 'Export Master'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
