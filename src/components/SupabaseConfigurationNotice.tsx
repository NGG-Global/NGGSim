import { Info } from 'lucide-react'
import { supabaseConfiguration } from '../services/supabaseClient'

export function SupabaseConfigurationNotice() {
  if (supabaseConfiguration.isConfigured) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-bold">נדרשת הגדרת Supabase</p>
        <p>{supabaseConfiguration.message}</p>
      </div>
    </div>
  )
}
