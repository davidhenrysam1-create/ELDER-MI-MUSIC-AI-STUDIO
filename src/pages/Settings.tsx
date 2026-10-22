import { useState } from 'react'
import { Settings as SettingsIcon, User, Bell, Shield, Info, Check } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { showToast } from '../components/Toast'

export function Settings() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [highQuality, setHighQuality] = useState(false)

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold gradient-text flex items-center gap-2">
          <SettingsIcon size={24} />
          Settings
        </h1>
        <p className="text-sm text-muted-text mt-1">Manage your account and application preferences.</p>
      </div>

      {/* Account */}
      <div className="glass p-5">
        <h2 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2 mb-4">
          <User size={16} className="text-cyan-blue" />
          Account
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <div>
              <p className="text-sm text-soft-white">Email</p>
              <p className="text-xs text-muted-text">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <div>
              <p className="text-sm text-soft-white">User ID</p>
              <p className="text-xs text-muted-text font-mono">{user?.id?.slice(0, 8)}...{user?.id?.slice(-4)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="glass p-5">
        <h2 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2 mb-4">
          <Bell size={16} className="text-cyan-blue" />
          Preferences
        </h2>
        <div className="space-y-3">
          <ToggleRow
            label="Notifications"
            desc="Receive alerts for processing completions and errors"
            value={notifications}
            onChange={setNotifications}
          />
          <ToggleRow
            label="Auto-save projects"
            desc="Automatically save project state as you work"
            value={autoSave}
            onChange={setAutoSave}
          />
          <ToggleRow
            label="High-quality rendering"
            desc="Use higher quality settings for audio processing (slower)"
            value={highQuality}
            onChange={setHighQuality}
          />
        </div>
      </div>

      {/* Privacy */}
      <div className="glass p-5">
        <h2 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2 mb-4">
          <Shield size={16} className="text-cyan-blue" />
          Privacy & Data
        </h2>
        <div className="space-y-3">
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-sm text-soft-white mb-1">Audio File Storage</p>
            <p className="text-xs text-muted-text mb-3">
              Your uploaded audio files are stored privately and can only be accessed by you.
              Files are used for processing and are never shared with other users.
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-sm text-soft-white mb-1">Data Deletion</p>
            <p className="text-xs text-muted-text mb-3">
              Delete a project to remove all associated audio files, processing jobs, and exports.
              This action cannot be undone.
            </p>
            <button
              onClick={() => showToast('Go to My Projects to delete projects and their data.', 'info')}
              className="btn-ghost text-sm"
            >
              Manage Data
            </button>
          </div>
        </div>
      </div>

      {/* AI Service Status */}
      <div className="glass p-5">
        <h2 className="font-display text-sm font-semibold text-soft-white flex items-center gap-2 mb-4">
          <Info size={16} className="text-cyan-blue" />
          AI Service Status
        </h2>
        <div className="space-y-2">
          {[
            { name: 'Prompt Improvement', status: 'configured' },
            { name: 'Vocal Generation', status: 'awaiting' },
            { name: 'Harmony Generation', status: 'awaiting' },
            { name: 'Voice Transformation', status: 'awaiting' },
            { name: 'Mix Processing', status: 'awaiting' },
            { name: 'Mastering Processing', status: 'awaiting' },
          ].map((service) => (
            <div key={service.name} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-sm text-soft-white">{service.name}</span>
              {service.status === 'configured' ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                  <Check size={12} /> Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-golden-yellow/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-golden-yellow/70" />
                  Awaiting configuration
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="glass p-5">
        <h2 className="font-display text-sm font-semibold text-soft-white mb-3">About</h2>
        <p className="text-sm text-muted-text leading-relaxed">
          Elder Mi Music AI Studio is an AI-powered music production platform designed for Afrobeats and African music genres.
          Your Sound. Your Culture. Your Studio.
        </p>
        <p className="text-xs text-muted-text mt-3">Version 1.0.0</p>
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, value, onChange }: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
      <div className="flex-1">
        <p className="text-sm text-soft-white">{label}</p>
        <p className="text-xs text-muted-text">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          value ? 'bg-gradient-to-r from-electric-purple to-cyan-blue' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            value ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}
