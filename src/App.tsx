import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { AppLayout } from './components/AppLayout'
import { AuthPage } from './pages/AuthPage'
import { Dashboard } from './pages/Dashboard'
import { VocalStudio } from './pages/VocalStudio'
import { MixStudio } from './pages/MixStudio'
import { MasteringStudio } from './pages/MasteringStudio'
import { Projects } from './pages/Projects'
import { VoiceProfiles } from './pages/VoiceProfiles'
import { ExportHistory } from './pages/ExportHistory'
import { Settings } from './pages/Settings'

export function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-electric-purple/30 border-t-electric-purple rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vocal-studio" element={<VocalStudio />} />
          <Route path="/mix-studio" element={<MixStudio />} />
          <Route path="/mastering-studio" element={<MasteringStudio />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/voice-profiles" element={<VoiceProfiles />} />
          <Route path="/exports" element={<ExportHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
