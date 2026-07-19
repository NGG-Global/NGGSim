import { BarChart3, CheckCircle2, Clock3, MessageSquareText, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { RepositoryErrorState, RepositoryLoadingState } from '../../components/RepositoryStates'
import { useRepositoryQuery } from '../../hooks/useRepositoryQuery'
import { useSimulationRepository } from '../../repositories/SimulationRepositoryProvider'

export function SimulationResultsPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const repository = useSimulationRepository()
  const query = useRepositoryQuery(async () => {
    const [simulation, sessions] = await Promise.all([repository.getById(id), repository.listSessions(id)])
    const reports = new Map((await Promise.all(sessions.map(async (session) => [session.id, await repository.getReport(session.id)] as const))))
    return { simulation, sessions, reports }
  }, [repository, id])
  const simulation = query.data?.simulation
  const sessions = query.data?.sessions ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = sessions.find((session) => session.id === selectedId) ?? sessions[0]
  const report = selected ? query.data?.reports.get(selected.id) ?? null : null

  if (query.isLoading && query.data === undefined) return <RepositoryLoadingState label="טוענים ניסיונות ודוחות…" />
  if (query.error) return <RepositoryErrorState error={query.error} onRetry={query.reload} />

  if (!simulation) return <div className="rounded-3xl bg-white p-10 text-center"><h1 className="text-2xl font-bold">הסימולציה לא נמצאה</h1><Button className="mt-5" onClick={() => navigate('/admin/simulations')}>חזרה</Button></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">תוצאות ודוחות</p>
          <h1 className="page-title">{simulation.title}</h1>
          <p className="mt-2 text-[#60756f]">{repository.provider === 'local' ? 'כל הסיכומים, הציונים והתמלולים במסך זה הם נתוני הדגמה.' : 'הנתונים במסך זה נטענים מסביבת העבודה המאובטחת של המנחה.'}</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/admin/simulations')}>חזרה לסימולציות</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ResultStat icon={<Users />} label="ניסיונות" value={String(sessions.length)} />
        <ResultStat icon={<CheckCircle2 />} label="הושלמו" value={String(sessions.filter((session) => session.status === 'completed').length)} />
        <ResultStat icon={<Clock3 />} label="משך ממוצע" value={averageDuration(sessions.map((session) => session.durationSeconds))} />
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#b9cbc6] bg-white p-12 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-[#80958f]" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold">עדיין אין ניסיונות</h2>
          <p className="mt-2 text-[#60756f]">לאחר השלמת סימולציה דרך הקישור הציבורי, הניסיון יופיע כאן.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-[#dce5e1] bg-white p-4">
            <h2 className="px-2 pb-3 text-lg font-bold">רשימת משתתפים</h2>
            <div className="space-y-2">
              {sessions.map((session) => (
                <button key={session.id} type="button" onClick={() => setSelectedId(session.id)} className={`w-full rounded-2xl border p-4 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f7b3d6] ${selected?.id === session.id ? 'border-forest bg-[#edf4f1]' : 'border-[#e0e7e4] hover:bg-[#f7f9f8]'}`}>
                  <span className="block font-bold text-ink">{session.participant.details.fullName || 'משתתף אנונימי'}</span>
                  <span className="mt-1 block text-xs text-[#677c76]">{formatDateTime(session.startedAt)} · {formatDuration(session.durationSeconds)}</span>
                  <span className={`mt-2 inline-block text-xs font-bold ${session.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'}`}>{session.status === 'completed' ? 'הושלם' : 'בתהליך'}</span>
                </button>
              ))}
            </div>
          </aside>

          {selected && (
            <div className="space-y-5">
              <section className="rounded-3xl border border-[#dce5e1] bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-[#667b75]">דוח ניסיון</p>
                    <h2 className="mt-1 text-xl font-bold">{selected.participant.details.fullName || 'משתתף אנונימי'}</h2>
                    <p className="mt-1 text-sm text-[#657a74]">התחלה: {formatDateTime(selected.startedAt)} · סיום: {selected.endedAt ? formatDateTime(selected.endedAt) : 'טרם הסתיים'}</p>
                  </div>
                  <span className="rounded-full bg-[#edf4f1] px-3 py-1.5 text-sm font-bold text-forest">{formatDuration(selected.durationSeconds)}</span>
                </div>
                <p className="mt-5 rounded-2xl bg-[#f5f7f6] p-4 leading-7 text-[#405b55]">{report?.summary ?? 'הדוח יופק לאחר השלמת הניסיון.'}</p>
              </section>

              {report && (
                <>
                  <section className="rounded-3xl border border-[#dce5e1] bg-white p-6">
                    <h2 className="text-lg font-bold">ציונים מדומים</h2>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {Object.entries(report.scores).map(([label, score]) => (
                        <div key={label}>
                          <div className="mb-2 flex justify-between text-sm"><span className="font-bold">{label}</span><span>{score}/100</span></div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#e5ece9]"><div className="h-full rounded-full bg-forest" style={{ width: `${score}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <div className="grid gap-5 md:grid-cols-2">
                    <ListCard title="נקודות חוזקה" items={report.strengths} tone="positive" />
                    <ListCard title="נקודות לשיפור" items={report.improvements} tone="improve" />
                  </div>
                </>
              )}

              <section className="rounded-3xl border border-[#dce5e1] bg-white p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquareText className="h-5 w-5" aria-hidden="true" /> תמלול לדוגמה</h2>
                {selected.transcript.length ? (
                  <div className="mt-5 space-y-3">
                    {selected.transcript.map((entry) => (
                      <div key={entry.id} className={`max-w-[85%] rounded-2xl p-4 ${entry.speaker === 'participant' ? 'mr-auto bg-forest text-white' : 'ml-auto bg-[#edf2ef] text-ink'}`}>
                        <p className="text-xs font-bold opacity-70">{entry.speaker === 'participant' ? 'המשתתף/ת' : simulation.character.name || 'הדמות'} · {formatDuration(entry.timestampSeconds)}</p>
                        <p className="mt-1 leading-6">{entry.text}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-3 text-sm text-[#657a74]">אין תמלול לניסיון זה.</p>}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-[#dce5e1] bg-white p-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage text-forest [&>svg]:h-5 [&>svg]:w-5">{icon}</span><span><span className="block text-xs font-bold text-[#667b75]">{label}</span><span className="mt-1 block text-xl font-black">{value}</span></span></div>
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: 'positive' | 'improve' }) {
  return <section className={`rounded-3xl border p-6 ${tone === 'positive' ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}><h2 className="font-bold">{title}</h2><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6"><span aria-hidden="true">•</span>{item}</li>)}</ul></section>
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${remaining.toString().padStart(2, '0')}`
}

function averageDuration(durations: number[]): string {
  if (!durations.length) return '0:00'
  return formatDuration(Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length))
}
