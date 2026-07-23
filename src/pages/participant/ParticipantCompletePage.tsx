import { CheckCircle2, Loader2, RefreshCw, Sparkles, ThumbsUp, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PublicUnavailableState } from '../../components/PublicUnavailableState'
import { RepositoryErrorState, RepositoryLoadingState } from '../../components/RepositoryStates'
import { Button } from '../../components/ui/Button'
import { getParticipantSimulationByToken } from '../../services/participantSimulationService'
import { useRepositoryQuery } from '../../hooks/useRepositoryQuery'
import { useSimulationRepository } from '../../repositories/SimulationRepositoryProvider'
import type { SimulationReport } from '../../types/simulation'

type ReportState = 'idle' | 'pending' | 'ready' | 'timeout'

export function ParticipantCompletePage() {
  const { publicToken = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const repository = useSimulationRepository()
  const sessionId = searchParams.get('session') ?? ''
  const query = useRepositoryQuery(async () => {
    const [result, session] = await Promise.all([
      getParticipantSimulationByToken(repository, publicToken),
      repository.getSession(sessionId),
    ])
    return { result, session }
  }, [repository, publicToken, sessionId])
  const result = query.data?.result
  const session = query.data?.session

  const [report, setReport] = useState<SimulationReport | null>(null)
  const [reportState, setReportState] = useState<ReportState>('idle')

  const showFeedback = result?.state === 'available' && result.simulation.participantBrief.showFeedback

  // The report is produced asynchronously by the post-call webhook, so poll for it a
  // few times after the call ends rather than assuming it is already there.
  useEffect(() => {
    if (repository.provider === 'local' || !sessionId || !showFeedback) return
    let cancelled = false
    let attempts = 0
    let timer = 0
    setReportState('pending')
    const poll = async () => {
      attempts += 1
      try {
        const found = await repository.getReport(sessionId)
        if (cancelled) return
        if (found) { setReport(found); setReportState('ready'); return }
      } catch { /* transient — keep polling */ }
      if (cancelled) return
      if (attempts >= 12) { setReportState('timeout'); return }
      timer = window.setTimeout(poll, 4000)
    }
    timer = window.setTimeout(poll, 1500)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [repository, sessionId, showFeedback])

  if (query.isLoading && !query.data) return <RepositoryLoadingState label="טוענים את סיכום הניסיון…" />
  if (query.error) return <RepositoryErrorState error={query.error} onRetry={query.reload} />
  if (!result) return <PublicUnavailableState reason="not_found" />

  if (result.state === 'unavailable') return <PublicUnavailableState reason={result.reason} />

  return (
    <div className="mx-auto mt-6 max-w-2xl rounded-[2rem] border border-[#d8e3df] bg-white p-7 text-center shadow-card sm:p-12">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-8 w-8" aria-hidden="true" /></span>
      <p className="mt-5 text-sm font-bold text-[#5b756e]">{result.simulation.title}</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">הסימולציה הסתיימה</h1>
      <p className="mx-auto mt-4 max-w-lg leading-7 text-[#526b65]">{repository.provider === 'local' ? 'תודה על ההשתתפות. התשובות והניסיון נשמרו בהצלחה בסביבת ההדגמה המקומית.' : 'תודה על ההשתתפות. הניסיון נשמר בהצלחה בסביבת הפיילוט המאובטחת.'}</p>

      {showFeedback && (
        repository.provider === 'local' ? (
          <section className="mt-8 rounded-2xl border border-[#dbe6e2] bg-[#f1f6f3] p-5 text-right">
            <h2 className="flex items-center gap-2 font-bold text-forest"><Sparkles className="h-5 w-5" aria-hidden="true" /> משוב כללי להדגמה</h2>
            <p className="mt-2 leading-7 text-[#48635c]">השלמת את התרגול ושמרת על התקדמות רציפה בשיחה. בחיבור העתידי למנוע הקולי יוצג כאן משוב קצר המבוסס על השיחה בפועל.</p>
            <p className="mt-2 text-xs text-[#6a807a]">זהו משוב מדומה ואינו דוח הערכה.</p>
          </section>
        ) : reportState === 'ready' && report ? (
          <FeedbackReport report={report} />
        ) : reportState === 'timeout' ? (
          <section className="mt-8 rounded-2xl border border-[#dbe6e2] bg-[#f1f6f3] p-5 text-right">
            <h2 className="flex items-center gap-2 font-bold text-forest"><Sparkles className="h-5 w-5" aria-hidden="true" /> המשוב בהכנה</h2>
            <p className="mt-2 leading-7 text-[#48635c]">ניתוח השיחה אורך לעיתים דקה או שתיים. אפשר לרענן את הדף בעוד רגע כדי לראות את המשוב המלא.</p>
            <Button variant="secondary" className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={() => query.reload()}>רענון</Button>
          </section>
        ) : (
          <section className="mt-8 flex flex-col items-center rounded-2xl border border-[#dbe6e2] bg-[#f1f6f3] p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-forest" aria-hidden="true" />
            <p className="mt-3 font-bold text-forest">מנתחים את השיחה…</p>
            <p className="mt-1 text-sm text-[#48635c]">המשוב האישי יופיע כאן בעוד רגע.</p>
          </section>
        )
      )}

      {session && <p className="mt-6 text-sm text-[#687e78]">משך הניסיון: {formatDuration(session.durationSeconds)}</p>}

      {result.simulation.participantBrief.allowRetry && (
        <Button className="mt-7" icon={<RefreshCw className="h-4 w-4" />} onClick={() => navigate(`/simulation/${publicToken}`)}>התחלה מחדש</Button>
      )}
    </div>
  )
}

const SCORE_MAX = 5

function FeedbackReport({ report }: { report: SimulationReport }) {
  const scores = Object.values(report.scores)
  const overall = scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null
  return (
    <section className="mt-8 space-y-4 text-right">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#dbe6e2] bg-[#f1f6f3] p-5">
        <h2 className="flex items-center gap-2 font-bold text-forest"><Sparkles className="h-5 w-5" aria-hidden="true" /> המשוב שלך</h2>
        {overall !== null && <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-forest">ציון כולל {overall}/{SCORE_MAX}</span>}
      </div>

      {report.summary && (
        <div className="rounded-2xl border border-[#dbe6e2] bg-white p-5">
          <p className="leading-7 text-[#405b55]">{report.summary}</p>
        </div>
      )}

      {report.strengths.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
          <h3 className="flex items-center gap-2 font-bold text-emerald-800"><ThumbsUp className="h-4 w-4" aria-hidden="true" /> נקודות חוזקה</h3>
          <ul className="mt-3 space-y-2">{report.strengths.map((item) => <li key={item} className="flex gap-2 text-sm leading-6"><span aria-hidden="true">•</span>{item}</li>)}</ul>
        </div>
      )}

      {report.improvements.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h3 className="flex items-center gap-2 font-bold text-amber-800"><TrendingUp className="h-4 w-4" aria-hidden="true" /> נקודות לשיפור</h3>
          <ul className="mt-3 space-y-2">{report.improvements.map((item) => <li key={item} className="flex gap-2 text-sm leading-6"><span aria-hidden="true">•</span>{item}</li>)}</ul>
        </div>
      )}
    </section>
  )
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')} דקות`
}
