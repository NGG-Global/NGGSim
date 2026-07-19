import { CircleStop, Mic, Sparkles, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PublicUnavailableState } from '../../components/PublicUnavailableState'
import { RepositoryErrorState, RepositoryLoadingState } from '../../components/RepositoryStates'
import { Button } from '../../components/ui/Button'
import { elevenLabsService } from '../../services/elevenLabsService'
import { getParticipantSimulationByToken } from '../../services/participantSimulationService'
import { useRepositoryQuery } from '../../hooks/useRepositoryQuery'
import { useSimulationRepository } from '../../repositories/SimulationRepositoryProvider'
import type { ConversationState, TranscriptEntry } from '../../types/simulation'

const stateLabels: Record<ConversationState, string> = {
  listening: 'הדמות מקשיבה',
  thinking: 'הדמות חושבת',
  speaking: 'הדמות מדברת',
}

const demoCharacterLines = [
  'אני שומע/ת. אפשר להסביר למה הנושא עולה דווקא עכשיו?',
  'מנקודת המבט שלי, יש כאן גם נסיבות שכדאי להביא בחשבון.',
  'אני מוכן/ה לחשוב על צעד המשך, אם נגדיר אותו יחד.',
]

export function ParticipantSessionPage() {
  const { publicToken = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const repository = useSimulationRepository()
  const sessionId = searchParams.get('session') ?? ''
  const query = useRepositoryQuery(async () => {
    const [publicResult, session] = await Promise.all([
      getParticipantSimulationByToken(repository, publicToken),
      repository.getSession(sessionId),
    ])
    return { publicResult, session }
  }, [repository, publicToken, sessionId])
  const publicResult = query.data?.publicResult
  const session = query.data?.session
  const [elapsed, setElapsed] = useState(0)
  const [conversationState, setConversationState] = useState<ConversationState>('listening')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [turn, setTurn] = useState(0)
  const [busy, setBusy] = useState(false)
  const conversationId = useRef('')
  const timers = useRef<number[]>([])
  const initializedSession = useRef('')
  const transcriptRef = useRef<TranscriptEntry[]>([])
  const [persistenceError, setPersistenceError] = useState('')

  useEffect(() => {
    if (!session || initializedSession.current === session.id) return
    initializedSession.current = session.id
    const elapsedFromStart = session.status === 'completed'
      ? session.durationSeconds
      : Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000))
    setElapsed(Math.max(session.durationSeconds, elapsedFromStart))
    transcriptRef.current = session.transcript
    setTranscript(session.transcript)
    setConversationState(session.conversationState)
  }, [session])

  useEffect(() => {
    if (!session || session.status === 'completed') return
    const interval = window.setInterval(() => setElapsed((value) => {
      const next = value + 1
      if (next % 5 === 0) {
        repository.updateSessionProgress(session.id, { durationSeconds: next })
          .catch((error: unknown) => setPersistenceError(error instanceof Error ? error.message : 'לא הצלחנו לשמור את זמן השיחה.'))
      }
      return next
    }), 1000)
    return () => window.clearInterval(interval)
  }, [repository, session])

  useEffect(() => {
    let active = true
    elevenLabsService.createConversationSession().then((created) => {
      if (!active) return
      conversationId.current = created.conversationId
      return elevenLabsService.startConversation(created.conversationId)
    }).catch(() => undefined)
    return () => {
      active = false
      timers.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  if (query.isLoading && !query.data) return <RepositoryLoadingState label="טוענים את הניסיון…" />
  if (query.error) return <RepositoryErrorState error={query.error} onRetry={query.reload} />
  if (!publicResult) return <PublicUnavailableState reason="not_found" />
  if (publicResult.state === 'unavailable') return <PublicUnavailableState reason={publicResult.reason} />
  if (!session || session.publicToken !== publicToken) {
    return <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-[#dce5e1] bg-white p-10 text-center"><h1 className="text-2xl font-bold">לא נמצא ניסיון פעיל</h1><p className="mt-3 leading-7 text-[#60756f]">אפשר לחזור לקישור שקיבלת ולהתחיל את הסימולציה מחדש.</p></div>
  }
  if (session.status === 'completed') {
    return <Navigate to={`/simulation/${publicToken}/complete?session=${session.id}`} replace />
  }

  const simulation = publicResult.simulation
  const advanceConversation = async () => {
    if (busy) return
    setBusy(true)
    setPersistenceError('')
    const participantTranscript: TranscriptEntry[] = [...transcriptRef.current, {
        id: `participant-${Date.now()}`,
        speaker: 'participant',
        text: 'המשתתף/ת דיבר/ה דרך כפתור המיקרופון המדומה.',
        timestampSeconds: elapsed,
    }]
    try {
      await repository.updateSessionProgress(session.id, {
        durationSeconds: elapsed,
        conversationState: 'thinking',
        transcript: participantTranscript,
      })
      transcriptRef.current = participantTranscript
      setTranscript(participantTranscript)
      setConversationState('thinking')
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : 'לא הצלחנו לשמור את ההתקדמות.')
      setBusy(false)
      return
    }

    timers.current.push(window.setTimeout(async () => {
      const characterTranscript: TranscriptEntry[] = [...transcriptRef.current, {
          id: `character-${Date.now()}`,
          speaker: 'character',
          text: demoCharacterLines[turn % demoCharacterLines.length],
          timestampSeconds: elapsed + 1,
      }]
      try {
        await repository.updateSessionProgress(session.id, {
          durationSeconds: elapsed + 1,
          conversationState: 'speaking',
          transcript: characterTranscript,
        })
        transcriptRef.current = characterTranscript
        setTranscript(characterTranscript)
        setConversationState('speaking')
      } catch (error) {
        setPersistenceError(error instanceof Error ? error.message : 'לא הצלחנו לשמור את תגובת הדמות.')
        setBusy(false)
        return
      }

      timers.current.push(window.setTimeout(async () => {
        try {
          await repository.updateSessionProgress(session.id, { durationSeconds: elapsed + 2, conversationState: 'listening' })
          setConversationState('listening')
          setTurn((value) => value + 1)
        } catch (error) {
          setPersistenceError(error instanceof Error ? error.message : 'לא הצלחנו לשמור את מצב השיחה.')
        } finally {
          setBusy(false)
        }
      }, 1650))
    }, 850))
  }

  const finish = async () => {
    if (!window.confirm('לסיים את הסימולציה? לאחר הסיום לא ניתן להמשיך את השיחה הזו.')) return
    setBusy(true)
    setPersistenceError('')
    try {
      if (conversationId.current) await elevenLabsService.endConversation(conversationId.current)
      await repository.completeSession(session.id, elapsed, transcriptRef.current)
      navigate(`/simulation/${publicToken}/complete?session=${session.id}`)
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : 'לא הצלחנו לסיים את הסימולציה.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 sm:mx-auto sm:w-fit">
        <Sparkles className="h-4 w-4" aria-hidden="true" /> הדגמה בלבד — אין שימוש במיקרופון אמיתי
      </div>
      <section className="overflow-hidden rounded-[2rem] border border-[#d8e3df] bg-white shadow-card">
        <header className="border-b border-[#e3e9e6] p-6 text-center sm:p-8">
          <p className="text-sm font-bold text-[#648078]">שיחה עם</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{simulation.character.name || 'הדמות'}</h1>
          <p className="mt-2 text-sm text-[#627872]">{simulation.character.role}</p>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-[#4f6862]">{simulation.scenarioSummary}</p>
        </header>

        <div className="p-6 sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="block text-xs font-bold text-[#6d817c]">זמן שחלף</span>
              <time className="mt-1 block font-mono text-2xl font-bold" dateTime={`PT${elapsed}S`}>{formatTimer(elapsed)}</time>
            </div>
            <div className={`conversation-status conversation-status-${conversationState}`} role="status" aria-live="polite">
              {conversationState === 'speaking' && <Volume2 className="h-4 w-4" aria-hidden="true" />}
              <span className="status-pulse" aria-hidden="true" /> {stateLabels[conversationState]}
            </div>
          </div>

          <div className="my-10 flex flex-col items-center">
            <button type="button" onClick={advanceConversation} disabled={busy} aria-label="הפעלת מיקרופון מדומה" className={`microphone-button ${busy ? 'microphone-button-busy' : ''}`}>
              <Mic className="h-10 w-10" aria-hidden="true" />
            </button>
            <p className="mt-4 text-sm font-bold text-[#566f69]">{busy ? 'התגובה מתקדמת אוטומטית…' : 'לחצו כדי לדמות אמירה'}</p>
          </div>

          {transcript.length > 0 && (
            <div className="mb-8 max-h-48 overflow-y-auto rounded-2xl bg-[#f5f7f6] p-4" aria-label="תמלול מקוצר של ההדגמה">
              {transcript.slice(-3).map((entry) => <p key={entry.id} className="mb-2 text-sm leading-6"><strong>{entry.speaker === 'participant' ? 'את/ה' : simulation.character.name}:</strong> {entry.text}</p>)}
            </div>
          )}

          {persistenceError && <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{persistenceError}</p>}

          <div className="flex justify-center">
            <Button variant="danger" icon={<CircleStop className="h-4 w-4" />} onClick={finish} disabled={busy}>סיום הסימולציה</Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
