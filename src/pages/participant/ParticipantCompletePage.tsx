import { CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PublicUnavailableState } from '../../components/PublicUnavailableState'
import { Button } from '../../components/ui/Button'
import { simulationRepository } from '../../repositories/localSimulationRepository'
import { getParticipantSimulationByToken } from '../../services/participantSimulationService'

export function ParticipantCompletePage() {
  const { publicToken = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const result = useMemo(() => getParticipantSimulationByToken(publicToken), [publicToken])
  const session = useMemo(() => simulationRepository.getSession(searchParams.get('session') ?? ''), [searchParams])

  if (result.state === 'unavailable') return <PublicUnavailableState reason={result.reason} />

  return (
    <div className="mx-auto mt-6 max-w-2xl rounded-[2rem] border border-[#d8e3df] bg-white p-7 text-center shadow-card sm:p-12">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-8 w-8" aria-hidden="true" /></span>
      <p className="mt-5 text-sm font-bold text-[#5b756e]">{result.simulation.title}</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">הסימולציה הסתיימה</h1>
      <p className="mx-auto mt-4 max-w-lg leading-7 text-[#526b65]">תודה על ההשתתפות. התשובות והניסיון נשמרו בהצלחה בסביבת ההדגמה המקומית.</p>

      {result.simulation.participantBrief.showFeedback && (
        <section className="mt-8 rounded-2xl border border-[#dbe6e2] bg-[#f1f6f3] p-5 text-right">
          <h2 className="flex items-center gap-2 font-bold text-forest"><Sparkles className="h-5 w-5" aria-hidden="true" /> משוב כללי להדגמה</h2>
          <p className="mt-2 leading-7 text-[#48635c]">השלמת את התרגול ושמרת על התקדמות רציפה בשיחה. בחיבור העתידי למנוע הקולי יוצג כאן משוב קצר המבוסס על השיחה בפועל.</p>
          <p className="mt-2 text-xs text-[#6a807a]">זהו משוב מדומה ואינו דוח הערכה.</p>
        </section>
      )}

      {session && <p className="mt-6 text-sm text-[#687e78]">משך הניסיון: {formatDuration(session.durationSeconds)}</p>}

      {result.simulation.participantBrief.allowRetry && (
        <Button className="mt-7" icon={<RefreshCw className="h-4 w-4" />} onClick={() => navigate(`/simulation/${publicToken}`)}>התחלה מחדש</Button>
      )}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')} דקות`
}
