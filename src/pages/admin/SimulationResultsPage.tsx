import { BarChart3, CheckCircle2, Clock3, Download, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { RepositoryErrorState, RepositoryLoadingState } from '../../components/RepositoryStates'
import {
  SCORE_MAX,
  TIER_META,
  averageScore,
  cohortCriteriaAverages,
  downloadSessionReport,
  groupSessionsByDate,
  scoreTier,
  type DateGroup,
} from '../../features/analytics/sessionReport'
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
  const reports = query.data?.reports
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = sessions.find((session) => session.id === selectedId) ?? sessions[0]
  const report = selected ? reports?.get(selected.id) ?? null : null

  const cohort = cohortCriteriaAverages(sessions.map((session) => reports?.get(session.id) ?? null))
  const dateGroups = reports ? groupSessionsByDate(sessions, reports) : []
  const scoredTotal = dateGroups.reduce((total, group) => total + group.scored, 0)

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

      {cohort.length > 0 && (
        <section className="rounded-3xl border border-[#dce5e1] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold"><BarChart3 className="h-5 w-5 text-forest" aria-hidden="true" /> ניתוח קבוצתי</h2>
            <span className="text-sm text-[#6a807a]">{scoredTotal} ניסיונות מנותחים</span>
          </div>

          <h3 className="mt-6 text-sm font-bold text-[#4f6862]">תמונת־על — ממוצע לכל קריטריון</h3>
          <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {cohort.map((entry) => <CriterionBar key={entry.label} label={entry.label} score={entry.score} />)}
          </div>

          <DateTrend groups={dateGroups} />

          {dateGroups.length > 0 && (
            <>
              <h3 className="mt-8 text-sm font-bold text-[#4f6862]">פירוט לפי תאריך</h3>
              <div className="mt-3 space-y-3">
                {dateGroups.map((group) => <DateGroupCard key={group.key} group={group} />)}
              </div>
            </>
          )}
        </section>
      )}

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
              {sessions.map((session) => {
                const sessionReport = reports?.get(session.id) ?? null
                const sessionOverall = sessionReport && Object.keys(sessionReport.scores).length ? averageScore(sessionReport.scores) : null
                return (
                  <button key={session.id} type="button" onClick={() => setSelectedId(session.id)} className={`w-full rounded-2xl border p-4 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f7b3d6] ${selected?.id === session.id ? 'border-forest bg-sage' : 'border-[#e0e7e4] hover:bg-[#f7f9f8]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="block font-bold text-ink">{session.participant.details.fullName || 'משתתף אנונימי'}</span>
                      {sessionOverall !== null && <ScorePill value={sessionOverall} />}
                    </div>
                    <span className="mt-1 block text-xs text-[#677c76]">{formatDateTime(session.startedAt)} · {formatDuration(session.durationSeconds)}</span>
                    <span className={`mt-2 inline-block text-xs font-bold ${session.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'}`}>{session.status === 'completed' ? 'הושלם' : 'בתהליך'}</span>
                  </button>
                )
              })}
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
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sage px-3 py-1.5 text-sm font-bold text-forest">{formatDuration(selected.durationSeconds)}</span>
                    <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => downloadSessionReport(simulation, selected, report)}>הורדת דוח</Button>
                  </div>
                </div>
                <p className="mt-5 rounded-2xl bg-[#f5f7f6] p-4 leading-7 text-[#405b55]">{report?.summary ?? 'הדוח יופק לאחר השלמת הניסיון.'}</p>
                <p className="mt-3 text-xs text-[#8a938f]">התמלול המלא של השיחה זמין בקובץ הדוח להורדה.</p>
              </section>

              {report && (
                <>
                  {Object.keys(report.scores).length > 0 && (
                    <section className="rounded-3xl border border-[#dce5e1] bg-white p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-bold">{repository.provider === 'local' ? 'ציונים מדומים' : 'ציונים לפי קריטריונים'}</h2>
                        {repository.provider !== 'local' && <span className="text-xs text-[#6a807a]">סולם 1–{SCORE_MAX}</span>}
                      </div>
                      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
                        <div className="flex flex-col items-center gap-2">
                          <ScoreRing value={averageScore(report.scores)} />
                          <span className="text-xs font-bold text-[#667b75]">ציון כולל</span>
                        </div>
                        <div className="grid gap-4">
                          {Object.entries(report.scores).map(([label, score]) => <CriterionBar key={label} label={label} score={score} />)}
                        </div>
                      </div>
                    </section>
                  )}
                  <div className="grid gap-5 md:grid-cols-2">
                    <ListCard title="נקודות חוזקה" items={report.strengths} tone="positive" />
                    <ListCard title="נקודות לשיפור" items={report.improvements} tone="improve" />
                  </div>
                </>
              )}
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

/** Circular overall-score gauge. The value is in the aria-label, so it does not rely on colour. */
function ScoreRing({ value }: { value: number }) {
  const size = 128
  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, Math.min(1, value / SCORE_MAX))
  const meta = TIER_META[scoreTier(value)]
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`ציון כולל ${value} מתוך ${SCORE_MAX}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef1f0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={meta.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ratio)} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-black leading-none text-ink">{value}</span>
        <span className="mt-0.5 text-xs font-bold text-[#6a807a]">מתוך {SCORE_MAX}</span>
      </div>
    </div>
  )
}

/** Horizontal magnitude bar with the numeric value and a status label — never colour alone. */
function CriterionBar({ label, score }: { label: string; score: number }) {
  const meta = TIER_META[scoreTier(score)]
  const pct = Math.min(100, (score / SCORE_MAX) * 100)
  return (
    <div title={`${label}: ${score}/${SCORE_MAX}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="font-bold text-ink">{label}</span>
        <span className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: meta.bg, color: meta.text }}>{meta.label}</span>
          <span className="font-bold tabular-nums" style={{ color: meta.color }}>{score}/{SCORE_MAX}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#eef1f0]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
      </div>
    </div>
  )
}

function ScorePill({ value }: { value: number }) {
  const meta = TIER_META[scoreTier(value)]
  return <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums" style={{ backgroundColor: meta.bg, color: meta.text }}>{value}/{SCORE_MAX}</span>
}

/** Overall-score-per-date columns. In RTL the row reads right→left, so oldest sits on the right. */
function DateTrend({ groups }: { groups: DateGroup[] }) {
  const data = groups.filter((group) => group.avgOverall !== null)
  if (data.length < 2) return null
  const chronological = [...data].reverse()
  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold text-[#4f6862]">מגמת ציון כולל לאורך זמן</h3>
      <div className="mt-4 flex items-end gap-3" style={{ height: 150 }}>
        {chronological.map((group) => {
          const value = group.avgOverall as number
          const meta = TIER_META[scoreTier(value)]
          const height = Math.max(8, (value / SCORE_MAX) * 118)
          return (
            <div key={group.key} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${group.label}: ${value}/${SCORE_MAX} · ${group.scored} מנותחים`}>
              <span className="text-xs font-bold" style={{ color: meta.color }}>{value}</span>
              <div className="w-full max-w-[56px] rounded-t-lg" style={{ height, backgroundColor: meta.color }} />
              <span className="text-[10px] font-bold text-[#6a807a]">{group.shortLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DateGroupCard({ group }: { group: DateGroup }) {
  return (
    <div className="rounded-2xl border border-[#e0e7e4] bg-[#fbfcfb] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-ink">{group.label}</h3>
          <p className="mt-0.5 text-xs text-[#6a807a]">{group.scored} מנותחים · {group.attempts} ניסיונות · משך ממוצע {formatDuration(group.avgDuration)}</p>
        </div>
        {group.avgOverall !== null && <ScorePill value={group.avgOverall} />}
      </div>
      {group.criteria.length > 0 ? (
        <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {group.criteria.map((entry) => <CriterionBar key={entry.label} label={entry.label} score={entry.score} />)}
        </div>
      ) : <p className="mt-3 text-sm text-[#6a807a]">אין עדיין ניתוח לתאריך זה.</p>}
    </div>
  )
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: 'positive' | 'improve' }) {
  return <section className={`rounded-3xl border p-6 ${tone === 'positive' ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}><h2 className="font-bold">{title}</h2>{items.length ? <ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6"><span aria-hidden="true">•</span>{item}</li>)}</ul> : <p className="mt-3 text-sm text-[#6a807a]">{tone === 'positive' ? 'לא זוהו נקודות חוזקה בולטות בניסיון זה.' : 'לא זוהו נקודות לשיפור בולטות בניסיון זה.'}</p>}</section>
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
