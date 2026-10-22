import { useState, useRef, useCallback } from 'react'
import { Upload, FileAudio, X, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isValidAudioFile, formatFileSize } from '../lib/audio-utils'
import { showToast } from './Toast'
import { useAuth } from '../lib/auth'

type UploadedFile = {
  id: string
  filename: string
  file_type: string
  file_size: number
  file_path: string
  category: string
}

type AudioUploaderProps = {
  projectId: string
  category?: 'instrumental' | 'lead_vocal' | 'stem' | 'mix' | 'master' | 'reference'
  onUploaded?: (file: UploadedFile) => void
  compact?: boolean
}

export function AudioUploader({ projectId, category = 'stem', onUploaded, compact = false }: AudioUploaderProps) {
  const { user } = useAuth()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList) => {
    if (!user) return
    setUploading(true)
    setProgress(0)

    for (const file of Array.from(files)) {
      const validation = isValidAudioFile(file)
      if (!validation.valid) {
        showToast(validation.reason || 'Invalid file', 'error')
        continue
      }

      const ext = file.name.split('.').pop()
      const filePath = `${user.id}/${projectId}/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filePath, file, {
          upsert: false,
        })

      if (uploadError) {
        showToast(`Upload failed: ${uploadError.message}`, 'error')
        continue
      }

      const { data: dbData, error: dbError } = await supabase
        .from('audio_files')
        .insert({
          project_id: projectId,
          filename: file.name,
          file_path: filePath,
          file_type: ext || 'audio',
          file_size: file.size,
          category,
        })
        .select()
        .single()

      if (dbError) {
        showToast(`Database error: ${dbError.message}`, 'error')
        continue
      }

      const uploaded: UploadedFile = {
        id: dbData.id,
        filename: dbData.filename,
        file_type: dbData.file_type,
        file_size: dbData.file_size,
        file_path: dbData.file_path,
        category: dbData.category,
      }

      setUploadedFiles((prev) => [...prev, uploaded])
      onUploaded?.(uploaded)
      showToast(`Uploaded "${file.name}" successfully`, 'success')
      setProgress((prev) => prev + Math.round(100 / files.length))
    }

    setUploading(false)
    setProgress(0)
  }, [projectId, category, user, onUploaded])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300
          ${dragging
            ? 'border-cyan-blue bg-cyan-blue/10 scale-[1.01]'
            : 'border-white/15 hover:border-white/25 bg-white/5 hover:bg-white/[0.07]'
          }
          ${compact ? 'p-4' : 'p-8'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".wav,.aiff,.aif,.mp3,.flac,.ogg,.mid,.midi,.zip"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <div className="text-center">
          <div className={`mx-auto ${compact ? 'w-10 h-10' : 'w-14 h-14'} rounded-2xl bg-gradient-to-br from-electric-purple to-cyan-blue flex items-center justify-center mb-3 transition-transform ${dragging ? 'scale-110' : ''}`}>
            <Upload size={compact ? 18 : 24} className="text-white" />
          </div>
          {!compact && (
            <>
              <p className="font-display font-semibold text-soft-white text-sm mb-1">
                Drop Your Music Project Here
              </p>
              <p className="text-xs text-muted-text">
                Upload your audio tracks, stems, or a supported project package to begin.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {['WAV', 'AIFF', 'MP3', 'FLAC', 'MIDI', 'ZIP'].map((fmt) => (
                  <span key={fmt} className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-mono text-muted-text border border-white/10">
                    {fmt}
                  </span>
                ))}
              </div>
            </>
          )}
          {compact && (
            <p className="text-sm text-muted-text">Click or drag to upload audio</p>
          )}
        </div>

        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 rounded-b-2xl overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-electric-purple to-cyan-blue transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploadedFiles.map((file) => (
            <div key={file.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 animate-slide-up">
              <FileAudio size={18} className="text-cyan-blue flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-soft-white truncate">{file.filename}</p>
                <p className="text-xs text-muted-text">{formatFileSize(file.file_size)} · {file.file_type.toUpperCase()}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(file.id) }}
                className="p-1 rounded-lg hover:bg-white/10 text-muted-text hover:text-magenta transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
