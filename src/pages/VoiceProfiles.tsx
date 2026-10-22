import { useState, useEffect, useCallback } from 'react'
import { UserCircle, Plus, Trash2, Check, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { VoiceProfile } from '../lib/supabase'
import { showToast } from '../components/Toast'
import { timeAgo } from '../lib/audio-utils'

export function VoiceProfiles() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [consent, setConsent] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('voice_profiles').select('*').order('created_at', { ascending: false })
    setProfiles(data as VoiceProfile[] || [])
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!name.trim()) {
      showToast('Please enter a name', 'error')
      return
    }
    if (!consent) {
      showToast('Consent confirmation is required for voice profiles', 'error')
      return
    }
    const { error } = await supabase.from('voice_profiles').insert({
      name: name.trim(),
      description: description.trim() || null,
      consent_confirmed: consent,
    })
    if (error) {
      showToast(`Failed to create: ${error.message}`, 'error')
      return
    }
    showToast('Voice profile created', 'success')
    setShowNew(false)
    setName('')
    setDescription('')
    setConsent(false)
    load()
  }

  const remove = async (id: string, profileName: string) => {
    if (!confirm(`Delete voice profile "${profileName}"?`)) return
    const { error } = await supabase.from('voice_profiles').delete().eq('id', id)
    if (error) {
      showToast(`Failed to delete: ${error.message}`, 'error')
    } else {
      showToast('Voice profile deleted', 'success')
      load()
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-text">My Voice Profiles</h1>
          <p className="text-sm text-muted-text mt-1">Manage authorised voice references for vocal transformation.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} />
          Add Voice Profile
        </button>
      </div>

      {/* Consent info */}
      <div className="glass p-4 rounded-xl border border-warm-orange/20 bg-warm-orange/5">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-warm-orange flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-soft-white font-medium mb-1">Voice Transformation Consent</p>
            <p className="text-xs text-muted-text">
              Voice profiles require that you have ownership or explicit consent to use the reference voice.
              Misuse of voice transformation may violate rights of performers and is your sole responsibility.
              The platform clearly labels which AI services are configured for voice processing.
            </p>
          </div>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="glass p-12 text-center">
          <UserCircle size={48} className="mx-auto text-muted-text/40 mb-3" />
          <h2 className="font-display text-lg font-semibold text-soft-white mb-2">No Voice Profiles</h2>
          <p className="text-sm text-muted-text mb-4">Add a voice profile to use vocal transformation features.</p>
          <button onClick={() => setShowNew(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Add Voice Profile
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="glass p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-violet to-cyan-blue flex items-center justify-center">
                  <UserCircle size={18} className="text-white" />
                </div>
                <button
                  onClick={() => remove(profile.id, profile.name)}
                  className="p-1.5 rounded-lg text-muted-text hover:text-magenta hover:bg-magenta/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <h3 className="font-display text-sm font-semibold text-soft-white mb-1">{profile.name}</h3>
              {profile.description && <p className="text-xs text-muted-text mb-3">{profile.description}</p>}
              <div className="flex items-center gap-2">
                {profile.consent_confirmed ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-400">
                    <Check size={12} /> Consent confirmed
                  </span>
                ) : (
                  <span className="text-xs text-magenta">Consent not confirmed</span>
                )}
                <span className="text-xs text-muted-text ml-auto">{timeAgo(profile.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowNew(false)}>
          <div className="glass-strong p-6 rounded-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold gradient-text mb-4">Add Voice Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-text mb-1.5">Profile Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="My Signature Voice" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-muted-text mb-1.5">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field resize-none" rows={3} placeholder="Describe the vocal characteristics..." />
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 rounded accent-warm-orange mt-0.5" />
                <span className="text-sm text-soft-white">I confirm I have ownership or explicit consent to use this voice for transformation.</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNew(false)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={create} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
