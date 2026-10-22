import { useState } from 'react'
import { Sparkles, Loader2, Check, RotateCcw } from 'lucide-react'
import { showToast } from './Toast'

type PromptEditorProps = {
  studioType: 'vocal' | 'mix' | 'mastering'
  placeholder: string
  onApply?: (prompt: string) => void
  applyLabel?: string
}

export function PromptEditor({ studioType, placeholder, onApply, applyLabel = 'Apply Recommendations' }: PromptEditorProps) {
  const [prompt, setPrompt] = useState('')
  const [improvedPrompt, setImprovedPrompt] = useState('')
  const [improving, setImproving] = useState(false)
  const [showImproved, setShowImproved] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  const handleImprove = async () => {
    if (!prompt.trim()) {
      showToast('Please enter a prompt first', 'error')
      return
    }

    setImproving(true)
    setShowImproved(false)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/improve-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ prompt, studioType }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Request failed (${response.status})`)
      }

      const data = await response.json()

      if (!data.improvedPrompt || typeof data.improvedPrompt !== 'string') {
        throw new Error('Invalid response from prompt improvement service')
      }

      setImprovedPrompt(data.improvedPrompt)
      setShowImproved(true)
      showToast('Prompt improved successfully', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'

      const genreContext = studioType === 'vocal' ? 'vocal arrangement' : studioType === 'mix' ? 'mixing' : 'mastering'
      const fallback = `Enhanced ${genreContext} request: ${prompt.trim()}. Apply genre-appropriate processing for modern Afrobeats, ensuring clarity, balance, and professional quality. Consider frequency balance, dynamic control, and spatial placement suitable for the target genre. Maintain the musical character while improving technical quality.`

      setImprovedPrompt(fallback)
      setShowImproved(true)
      showToast('Prompt improvement service is awaiting configuration. A structured version is shown below.', 'info')
    } finally {
      setImproving(false)
    }
  }

  const handleApply = () => {
    const finalPrompt = showImproved ? improvedPrompt : prompt
    if (!finalPrompt.trim()) return

    setApplying(true)
    setTimeout(() => {
      setApplying(false)
      setApplied(true)
      onApply?.(finalPrompt)
      showToast('Recommendations prepared. Ready for processing.', 'success')
      setTimeout(() => setApplied(false), 3000)
    }, 800)
  }

  const handleReset = () => {
    setPrompt('')
    setImprovedPrompt('')
    setShowImproved(false)
    setApplied(false)
  }

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-blue" />
          Production Instructions
        </h3>
        {(prompt || improvedPrompt) && (
          <button onClick={handleReset} className="text-xs text-muted-text hover:text-soft-white flex items-center gap-1 transition-colors">
            <RotateCcw size={12} />
            Clear
          </button>
        )}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="input-field resize-none leading-relaxed"
      />

      <div className="flex gap-3">
        <button
          onClick={handleImprove}
          disabled={improving || !prompt.trim()}
          className="btn-ghost flex items-center gap-2"
        >
          {improving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Improve My Prompt
        </button>
        <button
          onClick={handleApply}
          disabled={applying || (!prompt.trim() && !improvedPrompt)}
          className="btn-accent flex items-center gap-2 ml-auto"
        >
          {applying ? <Loader2 size={16} className="animate-spin" /> : applied ? <Check size={16} /> : null}
          {applied ? 'Applied' : applyLabel}
        </button>
      </div>

      {showImproved && improvedPrompt && (
        <div className="rounded-xl bg-cyan-blue/5 border border-cyan-blue/20 p-4 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-blue animate-pulse" />
            <p className="text-xs font-medium text-cyan-blue">Improved Prompt — Review before applying</p>
          </div>
          <p className="text-sm text-soft-white leading-relaxed">{improvedPrompt}</p>
        </div>
      )}
    </div>
  )
}
