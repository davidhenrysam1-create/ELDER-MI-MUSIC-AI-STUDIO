import { useState, useEffect, useCallback } from 'react'
import { Download, Music, FileAudio } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ExportRecord } from '../lib/supabase'
import { formatFileSize, timeAgo } from '../lib/audio-utils'
import { showToast } from '../components/Toast'

type ExportWithProject = ExportRecord & { projects?: { name: string } }

export function ExportHistory() {
  const [exports, setExports] = useState<ExportWithProject[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('exports')
      .select('*, projects(name)')
      .order('created_at', { ascending: false })
    setExports(data as ExportWithProject[] || [])
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold gradient-text">Export History</h1>
        <p className="text-sm text-muted-text mt-1">View and download your exported audio files.</p>
      </div>

      {exports.length === 0 ? (
        <div className="glass p-12 text-center">
          <Download size={48} className="mx-auto text-muted-text/40 mb-3" />
          <h2 className="font-display text-lg font-semibold text-soft-white mb-2">No Exports Yet</h2>
          <p className="text-sm text-muted-text">Finish a project and export audio to see it here.</p>
        </div>
      ) : (
        <div className="glass divide-y divide-white/5">
          {exports.map((exp) => (
            <div key={exp.id} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-electric-purple to-cyan-blue flex items-center justify-center flex-shrink-0">
                <FileAudio size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-soft-white truncate">{exp.filename}</p>
                <p className="text-xs text-muted-text">
                  {exp.projects?.name || 'Unknown project'} · {exp.format.toUpperCase()} · {formatFileSize(exp.file_size)} · {timeAgo(exp.created_at)}
                </p>
              </div>
              <button
                onClick={() => showToast('Download link will be available once processing is configured.', 'info')}
                className="btn-ghost text-sm inline-flex items-center gap-2"
              >
                <Download size={14} />
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function showToast(message: string, type: 'info' | 'success' | 'error') {
  const { showToast: st } = require('../components/Toast')
  st(message, type)
}
