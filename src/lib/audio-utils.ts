export const SUPPORTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/aiff',
  'audio/x-aiff',
  'audio/mpeg',
  'audio/mp3',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/midi',
  'audio/x-midi',
  'audio/mid',
]

export const SUPPORTED_EXTENSIONS = [
  '.wav', '.aiff', '.aif', '.mp3', '.flac', '.ogg', '.mid', '.midi',
]

export const SUPPORTED_ARCHIVE_TYPES = ['application/zip', 'application/x-zip-compressed']
export const SUPPORTED_ARCHIVE_EXTENSIONS = ['.zip']

export const MAX_FILE_SIZE = 100 * 1024 * 1024

export function isValidAudioFile(file: File): { valid: boolean; reason?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, reason: `File "${file.name}" exceeds the 100 MB limit.` }
  }

  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  const typeMatches = SUPPORTED_AUDIO_TYPES.includes(file.type)
  const extMatches = SUPPORTED_EXTENSIONS.includes(ext)

  if (!typeMatches && !extMatches) {
    const isArchive = SUPPORTED_ARCHIVE_TYPES.includes(file.type) || SUPPORTED_ARCHIVE_EXTENSIONS.includes(ext)
    if (isArchive) {
      return { valid: true }
    }
    return {
      valid: false,
      reason: `File "${file.name}" is not a supported audio format. Supported: WAV, AIFF, MP3, FLAC, OGG, MIDI, ZIP.`,
    }
  }

  return { valid: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
}
