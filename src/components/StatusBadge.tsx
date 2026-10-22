type StatusBadgeProps = {
  status: string
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'text-muted-text bg-white/5', dot: 'bg-muted-text' },
  queued: { label: 'Queued', color: 'text-golden-yellow bg-golden-yellow/10', dot: 'bg-golden-yellow' },
  processing: { label: 'Processing', color: 'text-cyan-blue bg-cyan-blue/10', dot: 'bg-cyan-blue animate-pulse' },
  completed: { label: 'Completed', color: 'text-green-400 bg-green-400/10', dot: 'bg-green-400' },
  failed: { label: 'Failed', color: 'text-magenta bg-magenta/10', dot: 'bg-magenta' },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}
