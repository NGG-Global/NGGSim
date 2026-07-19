import { LoaderCircle } from 'lucide-react'

export function AuthLoadingScreen({ message = 'בודקים את מצב ההתחברות…' }: { message?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f6] p-6" dir="rtl">
      <div role="status" aria-live="polite" className="rounded-xl border border-[#e5e4e7] bg-white px-8 py-7 text-center shadow-card">
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-forest" aria-hidden="true" />
        <p className="mt-4 font-bold text-ink">{message}</p>
      </div>
    </main>
  )
}
