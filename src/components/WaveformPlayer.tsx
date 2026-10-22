import { useState, useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'

type WaveformPlayerProps = {
  audioUrl: string
  height?: number
  waveColor?: string
  progressColor?: string
  onReady?: (duration: number) => void
}

export function WaveformPlayer({
  audioUrl,
  height = 64,
  waveColor = 'rgba(139, 92, 246, 0.4)',
  progressColor = '#22D3EE',
  onReady,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height,
      waveColor,
      progressColor,
      cursorColor: '#EC4899',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      url: audioUrl,
    })

    wsRef.current = ws

    ws.on('ready', () => {
      const d = ws.getDuration()
      setDuration(d)
      setLoading(false)
      onReady?.(d)
    })

    ws.on('audioprocess', (t: number) => setCurrentTime(t))
    ws.on('seeking', (t: number) => setCurrentTime(t))
    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => setPlaying(false))

    return () => {
      ws.destroy()
    }
  }, [audioUrl, height, waveColor, progressColor, onReady])

  const togglePlay = () => wsRef.current?.playPause()

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <button
        onClick={togglePlay}
        disabled={loading}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-electric-purple to-cyan-blue
                   flex items-center justify-center text-white hover:scale-110 transition-transform
                   disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3" height="12" rx="1"/><rect x="10" y="2" width="3" height="12" rx="1"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2v12l11-6z"/></svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div ref={containerRef} className="w-full" />
      </div>
      <span className="flex-shrink-0 text-xs text-muted-text font-mono tabular-nums">
        {fmt(currentTime)} / {fmt(duration)}
      </span>
    </div>
  )
}
