import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  LayoutDashboard,
  Mic,
  Sliders,
  Sparkles,
  FolderOpen,
  UserCircle,
  Download,
  Settings,
  LogOut,
  X,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/vocal-studio', label: 'Sam Vocal Studio', icon: Mic, gradient: 'gradient-text-vocal' },
  { to: '/mix-studio', label: 'Sam Mix Studio', icon: Sliders, gradient: 'gradient-text-mix' },
  { to: '/mastering-studio', label: 'Sam Mastering Studio', icon: Sparkles, gradient: 'gradient-text-master' },
  { to: '/projects', label: 'My Projects', icon: FolderOpen },
  { to: '/voice-profiles', label: 'My Voice Profiles', icon: UserCircle },
  { to: '/exports', label: 'Export History', icon: Download },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth()
  const location = useLocation()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 glass-nav z-50 transform transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-electric-purple via-cyan-blue to-magenta flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="white">
                  <path d="M4 18v-4h3v-2h3v5h3V10h3v11h3v-7h3v5h3v-2h3v4H4z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-sm font-bold gradient-text leading-tight truncate">
                  Elder Mi
                </h1>
                <p className="text-[10px] text-muted-text leading-tight">Music AI Studio</p>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden text-muted-text hover:text-soft-white">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className={item.gradient && isActive ? item.gradient : ''}>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="p-3 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-electric-purple to-cyan-blue flex items-center justify-center text-xs font-bold text-white">
                {user?.email?.[0]?.toUpperCase() || 'P'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-soft-white truncate">{user?.email}</p>
                <p className="text-[10px] text-muted-text">Producer</p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="nav-item w-full text-magenta/80 hover:text-magenta"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
