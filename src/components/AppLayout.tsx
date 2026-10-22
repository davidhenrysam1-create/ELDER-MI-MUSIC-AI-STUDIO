import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { BackgroundDecor } from './Decor'
import { ToastContainer } from './Toast'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Project } from '../lib/supabase'

export function AppLayout() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeProject, setActiveProject] = useState<Project | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth')
    }
  }, [user, loading, navigate])

  useEffect(() => {
    const projectId = sessionStorage.getItem('activeProjectId')
    if (projectId && user) {
      supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setActiveProject(data as Project)
        })
    }
  }, [user, location.pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-electric-purple/30 border-t-electric-purple rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <BackgroundDecor />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          projectName={activeProject?.name}
          projectStatus={activeProject ? 'saved' : undefined}
        />
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet context={{ activeProject, setActiveProject }} />
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
