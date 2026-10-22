import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { AnimatedWaves } from '../components/Decor'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-electric-purple via-cyan-blue to-magenta flex items-center justify-center border-glow">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="white">
                <path d="M4 18v-4h3v-2h3v5h3V10h3v11h3v-7h3v5h3v-2h3v4H4z" />
              </svg>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold gradient-text-shimmer mb-2">
            Elder Mi Music AI Studio
          </h1>
          <p className="text-muted-text text-sm">Your Sound. Your Culture. Your Studio.</p>
        </div>

        <div className="glass p-8 animate-fade-in">
          <div className="flex gap-2 mb-6 p-1 rounded-xl bg-white/5">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signin' ? 'bg-gradient-to-r from-electric-purple to-neon-violet text-white' : 'text-muted-text hover:text-soft-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-gradient-to-r from-electric-purple to-neon-violet text-white' : 'text-muted-text hover:text-soft-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-text mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
                placeholder="producer@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-text mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-field"
                placeholder="At least 6 characters"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-magenta/10 border border-magenta/30 text-magenta-200 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 h-12 flex items-center justify-center">
            <AnimatedWaves bars={24} className="h-8 opacity-40" />
          </div>
        </div>

        <p className="text-center text-xs text-muted-text mt-6">
          AI-powered music production for Afrobeats and African music genres
        </p>
      </div>
    </div>
  )
}
