import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type Project = {
  id: string
  name: string
  studio: 'vocal' | 'mix' | 'mastering'
  status: 'draft' | 'processing' | 'completed' | 'failed'
  description: string | null
  genre: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export type AudioFile = {
  id: string
  project_id: string
  filename: string
  file_path: string
  file_type: string
  file_size: number
  duration: number | null
  category: 'instrumental' | 'lead_vocal' | 'stem' | 'mix' | 'master' | 'reference'
  created_at: string
}

export type ProcessingJob = {
  id: string
  project_id: string
  job_type: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  parameters: Record<string, unknown>
  result: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export type ExportRecord = {
  id: string
  project_id: string
  filename: string
  file_path: string
  format: string
  file_size: number
  created_at: string
}

export type VoiceProfile = {
  id: string
  name: string
  description: string | null
  consent_confirmed: boolean
  created_at: string
}

export type Database = {
  projects: Project
  audio_files: AudioFile
  processing_jobs: ProcessingJob
  exports: ExportRecord
  voice_profiles: VoiceProfile
}
