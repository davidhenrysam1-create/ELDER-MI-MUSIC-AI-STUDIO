import { useState } from 'react'
import { Menu, Bell, Save, FolderOpen } from 'lucide-react'
import { useAuth } from '../lib/auth'

export function Header({
  onMenuClick,
  projectName,
  projectStatus,
}: {
  onMenuClick: () => void
  projectName?: string
  projectStatus?: string
}) {
  const { user } = useAuth()
  const [showNotifs, setShowNotifs] = useState(false)

  return (
    <header className="sticky top-0 z-30 glass-nav border-b border-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-muted-text hover:text-soft-white transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            {projectName ? (
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-cyan-blue flex-shrink-0" />
                <h2 className="font-display text-sm font-semibold text-soft-white truncate">{projectName}</h2>
                {projectStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-xs text-green-400/80 flex-shrink-0">
                    <Save size={12} />
                    Saved
                  </span>
                )}
              </div>
            ) : (
              <h2 className="font-display text-sm font-semibold gradient-text">Elder Mi Music AI Studio</h2>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 rounded-lg hover:bg-white/10 text-muted-text hover:text-soft-white transition-colors"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-magenta animate-pulse" />
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-72 glass-strong p-4 rounded-xl shadow-xl z-50 animate-fade-in">
                <p className="text-sm font-medium text-soft-white mb-2">Notifications</p>
                <p className="text-xs text-muted-text">No new notifications. Your projects are up to date.</p>
              </div>
            )}
          </div>

          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-electric-purple to-cyan-blue flex items-center justify-center text-xs font-bold text-white">
            {user?.email?.[0]?.toUpperCase() || 'P'}
          </div>
        </div>
      </div>
    </header>
  )
}
