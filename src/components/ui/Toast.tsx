import { CheckCircle2, CircleAlert, X } from 'lucide-react'

interface ToastProps {
  message: string
  tone?: 'success' | 'error'
  onClose?: () => void
}

export function Toast({ message, tone = 'success', onClose }: ToastProps) {
  const Icon = tone === 'success' ? CheckCircle2 : CircleAlert
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} aria-live="polite" className={`fixed left-5 top-5 z-50 flex max-w-md items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-card ${tone === 'error' ? 'border-red-200 text-red-800' : 'border-emerald-200 text-emerald-900'}`}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="text-sm font-bold">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="סגירת ההודעה" className="rounded-lg p-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
