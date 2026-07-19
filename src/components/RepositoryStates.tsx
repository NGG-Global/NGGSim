import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'

export function RepositoryLoadingState({ label = 'טוענים נתונים…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-[#5a726c]" role="status" aria-live="polite">
      <LoaderCircle className="ml-2 h-5 w-5 animate-spin" aria-hidden="true" /> {label}
    </div>
  )
}

export function RepositoryErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-red-200 bg-white p-8 text-center" role="alert">
      <AlertTriangle className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-bold">לא הצלחנו לטעון את הנתונים</h1>
      <p className="mx-auto mt-2 max-w-xl leading-7 text-[#60756f]">{error.message}</p>
      <Button className="mt-5" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>ניסיון נוסף</Button>
    </div>
  )
}

