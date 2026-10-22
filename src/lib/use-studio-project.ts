import { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Project, AudioFile } from '../lib/supabase'
import { showToast } from '../components/Toast'

type OutletContext = {
  activeProject: Project | null
  setActiveProject: (p: Project | null) => void
}

export function useStudioProject(studioType: 'vocal' | 'mix' | 'mastering') {
  const { activeProject, setActiveProject } = useOutletContext<OutletContext>()
  const [projects, setProjects] = useState<Project[]>([])
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('studio', studioType)
      .order('updated_at', { ascending: false })
    setProjects(data as Project[] || [])
  }, [studioType])

  const loadAudioFiles = useCallback(async () => {
    if (!activeProject) {
      setAudioFiles([])
      return
    }
    const { data } = await supabase
      .from('audio_files')
      .select('*')
      .eq('project_id', activeProject.id)
      .order('created_at', { ascending: false })
    setAudioFiles(data as AudioFile[] || [])
  }, [activeProject])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    loadAudioFiles()
  }, [loadAudioFiles])

  const createProject = async () => {
    if (!newProjectName.trim()) {
      showToast('Please enter a project name', 'error')
      return
    }
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: newProjectName.trim(), studio: studioType, status: 'draft' })
      .select()
      .single()

    if (error) {
      showToast(`Failed to create project: ${error.message}`, 'error')
      return
    }

    const newProject = data as Project
    sessionStorage.setItem('activeProjectId', newProject.id)
    setActiveProject(newProject)
    setNewProjectName('')
    setShowProjectPicker(false)
    showToast(`Project "${newProject.name}" created`, 'success')
    loadProjects()
  }

  const selectProject = (project: Project) => {
    sessionStorage.setItem('activeProjectId', project.id)
    setActiveProject(project)
    setShowProjectPicker(false)
  }

  return {
    activeProject,
    projects,
    audioFiles,
    showProjectPicker,
    setShowProjectPicker,
    newProjectName,
    setNewProjectName,
    createProject,
    selectProject,
    loadProjects,
    loadAudioFiles,
  }
}
