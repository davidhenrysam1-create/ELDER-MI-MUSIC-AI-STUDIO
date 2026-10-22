export function AnimatedWaves({ bars = 32, className = '' }: { bars?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-[2px] ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] bg-gradient-to-t from-electric-purple via-cyan-blue to-magenta rounded-full animate-wave-pulse"
          style={{
            height: '100%',
            animationDelay: `${i * 80}ms`,
            animationDuration: `${1.5 + (i % 4) * 0.3}s`,
          }}
        />
      ))}
    </div>
  )
}

export function BackgroundDecor() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-electric-purple/10 rounded-full blur-[120px] animate-float" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-blue/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-magenta/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '4s' }} />
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  )
}

export function EqualizerBars({ active = false, bars = 5, className = '' }: { active?: boolean; bars?: number; className?: string }) {
  return (
    <div className={`flex items-end justify-center gap-[3px] ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full bg-gradient-to-t from-cyan-blue to-electric-purple ${active ? 'animate-wave-pulse' : ''}`}
          style={{
            height: active ? '100%' : '20%',
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  )
}
