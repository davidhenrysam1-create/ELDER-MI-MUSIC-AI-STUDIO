import { useEffect, useState } from 'react'

export type Toast = {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let toastId = 0
const listeners: ((toast: Toast) => void)[] = []

export function showToast(message: string, type: Toast['type'] = 'info') {
  const toast = { id: `toast-${++toastId}`, message, type }
  listeners.forEach((l) => l(toast))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((prev) => [...prev, toast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 4000)
    }
    listeners.push(listener)
    return () => {
      const idx = listeners.indexOf(listener)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }, [])

  const colors: Record<string, string> = {
    success: 'border-green-400/30 bg-green-400/10 text-green-200',
    error: 'border-magenta/30 bg-magenta/10 text-magenta-200',
    info: 'border-cyan-blue/30 bg-cyan-blue/10 text-cyan-blue-200',
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`glass-strong px-4 py-3 rounded-xl border ${colors[toast.type]} text-sm font-medium animate-slide-up shadow-xl`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
