import {
  BarChart3,
  Copy,
  Eye,
  FilePenLine,
  Link2,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Toast } from '../../components/ui/Toast'
import { useRepositoryRevision } from '../../hooks/useRepositoryRevision'
import { simulationRepository } from '../../repositories/localSimulationRepository'
import type { Simulation } from '../../types/simulation'

export function AdminDashboardPage() {
  const revision = useRepositoryRevision()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
  const simulations = useMemo(() => simulationRepository.list(), [revision])
  const publishedCount = simulations.filter((simulation) => simulation.status === 'published').length
  const draftCount = simulations.filter((simulation) => simulation.status !== 'published').length
  const attemptCount = simulations.reduce((total, simulation) => total + simulation.attemptCount, 0)

  const duplicate = (simulation: Simulation) => {
    const copy = simulationRepository.duplicate(simulation.id)
    setToast('נוצר עותק חדש ונשמר כטיוטה.')
    window.setTimeout(() => navigate(`/admin/simulations/${copy.id}/edit`), 400)
  }

  const remove = (simulation: Simulation) => {
    const confirmed = window.confirm(`למחוק את „${simulation.title || 'הסימולציה ללא שם'}”? הפעולה תבטל גם את הקישור הציבורי.`)
    if (!confirmed) return
    simulationRepository.remove(simulation.id)
    setToast('הסימולציה נמחקה והקישור שלה אינו פעיל עוד.')
  }

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="eyebrow">מרחב המנחים</p>
          <h1 className="page-title">סימולציות ניהוליות</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#55706a]">בנו תרגול שיחה מותאם, פרסמו קישור למשתתפים ועקבו אחר ניסיונות ותוצאות — הכול במקום אחד.</p>
        </div>
        <Link to="/admin/simulations/new" className="button-link-primary">
          <Plus className="h-5 w-5" aria-hidden="true" /> יצירת סימולציה חדשה
        </Link>
      </section>

      <section aria-label="סיכום פעילות" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="סימולציות פעילות" value={publishedCount} note="קישורים פתוחים למשתתפים" />
        <StatCard label="טיוטות ובוטלו" value={draftCount} note="ממתינות להשלמה או לפרסום" />
        <StatCard label="ניסיונות שנשמרו" value={attemptCount} note="כולל נתוני הדגמה" />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">הסימולציות שלי</h2>
            <p className="mt-1 text-sm text-[#647b75]">{simulations.length} סימולציות בסביבת העבודה</p>
          </div>
        </div>

        {simulations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#b9cbc6] bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage text-forest"><MoreHorizontal aria-hidden="true" /></div>
            <h3 className="mt-5 text-xl font-bold">עדיין לא נוצרו סימולציות</h3>
            <p className="mx-auto mt-2 max-w-md leading-7 text-[#617770]">אשף קצר ינחה אותך בהגדרת הסיטואציה, הדמות והתדריך שיוצג למשתתף.</p>
            <Link to="/admin/simulations/new" className="button-link-primary mt-6">יצירת הסימולציה הראשונה</Link>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {simulations.map((simulation) => (
              <article key={simulation.id} className="rounded-3xl border border-[#dce4e1] bg-white p-5 shadow-[0_2px_4px_rgba(8,8,16,0.06),0_6px_16px_rgba(8,8,16,0.08)] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={simulation.status} />
                      <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-xs font-bold text-[#5d716c]">{simulation.behavior.difficulty}</span>
                    </div>
                    <h3 className="truncate text-xl font-bold text-ink">{simulation.title || 'סימולציה ללא שם'}</h3>
                    <p className="mt-1 truncate text-sm text-[#647b75]">{simulation.organization.clientName || 'ללא ארגון'} · {simulation.scenario.conversationType}</p>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-[#edf3f0] px-3 py-2 text-center">
                    <span className="block text-xl font-black text-forest">{simulation.attemptCount}</span>
                    <span className="block text-[11px] font-bold text-[#607871]">ניסיונות</span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ef] pt-4">
                  <span className="text-xs text-[#71827e]">עודכן {formatDate(simulation.updatedAt)}</span>
                  <div className="flex flex-wrap gap-1.5" aria-label={`פעולות עבור ${simulation.title}`}>
                    <IconLink to={`/admin/simulations/${simulation.id}/preview`} label="צפייה"><Eye /></IconLink>
                    <IconLink to={`/admin/simulations/${simulation.id}/edit`} label="עריכה"><FilePenLine /></IconLink>
                    <Button variant="ghost" className="min-h-10 px-2.5" onClick={() => duplicate(simulation)} title="שכפול" aria-label={`שכפול ${simulation.title}`}><Copy className="h-4 w-4" /></Button>
                    {simulation.status === 'published' && <IconLink to={`/admin/simulations/${simulation.id}/share`} label="שיתוף"><Link2 /></IconLink>}
                    <IconLink to={`/admin/simulations/${simulation.id}/results`} label="תוצאות"><BarChart3 /></IconLink>
                    <Button variant="ghost" className="min-h-10 px-2.5 text-red-700 hover:bg-red-50" onClick={() => remove(simulation)} title="מחיקה" aria-label={`מחיקת ${simulation.title}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-2xl border border-[#dce4e1] bg-white p-5">
      <p className="text-sm font-bold text-[#5b716b]">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-[#748580]">{note}</p>
    </div>
  )
}

function IconLink({ to, label, children }: { to: string; label: string; children: React.ReactNode }) {
  return (
    <Link to={to} title={label} aria-label={label} className="inline-flex min-h-10 items-center justify-center rounded-xl px-2.5 text-ink transition hover:bg-[#fdeef6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f7b3d6] [&>svg]:h-4 [&>svg]:w-4">
      {children}
    </Link>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
