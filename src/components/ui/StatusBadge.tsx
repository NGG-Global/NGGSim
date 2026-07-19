import type { SimulationStatus } from '../../types/simulation'

const labels: Record<SimulationStatus, string> = {
  draft: 'טיוטה',
  published: 'פורסמה',
  unpublished: 'הפרסום בוטל',
}

export function StatusBadge({ status }: { status: SimulationStatus }) {
  const color = status === 'published'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : status === 'draft'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${color}`}>{labels[status]}</span>
}
