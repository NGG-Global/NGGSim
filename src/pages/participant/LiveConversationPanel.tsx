import { useConversation } from '@elevenlabs/react'
import { CircleStop, Loader2, Mic, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useSimulationRepository } from '../../repositories/SimulationRepositoryProvider'
import type { ConversationState, ParticipantSimulationView, SimulationSession, TranscriptEntry } from '../../types/simulation'
import { formatTimer, stateLabels } from './conversationShared'

interface Props {
  session: SimulationSession
  simulation: ParticipantSimulationView
  publicToken: string
}

type Phase = 'idle' | 'starting' | 'active' | 'ending'

/**
 * Live voice conversation via ElevenLabs. The browser connects with a short-lived
 * signed URL minted server-side; the per-simulation character is injected by the
 * server (initiation webhook), never from here, so hidden info stays off the client.
 */
export function LiveConversationPanel({ session, simulation, publicToken }: Props) {
  const navigate = useNavigate()
  const repository = useSimulationRepository()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(session.durationSeconds)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(session.transcript)
  const transcriptRef = useRef<TranscriptEntry[]>(session.transcript)
  const elapsedRef = useRef(session.durationSeconds)
  const lastPersistedState = useRef<ConversationState | null>(null)

  const conversation = useConversation({
    onError: (err: unknown) => {
      setError(typeof err === 'string' && err ? err : 'אירעה שגיאה בשיחה הקולית.')
    },
    onMessage: (props: unknown) => {
      const data = props as { message?: unknown; source?: unknown }
      if (typeof data.message !== 'string' || !data.message.trim()) return
      const speaker: TranscriptEntry['speaker'] = data.source === 'user' ? 'participant' : 'character'
      const entry: TranscriptEntry = {
        id: `${speaker}-${transcriptRef.current.length}-${elapsedRef.current}`,
        speaker,
        text: data.message,
        timestampSeconds: elapsedRef.current,
      }
      transcriptRef.current = [...transcriptRef.current, entry]
      setTranscript(transcriptRef.current)
    },
  })

  const isConnected = conversation.status === 'connected'
  const conversationState: ConversationState = phase === 'active' && isConnected
    ? (conversation.isSpeaking ? 'speaking' : 'listening')
    : 'thinking'

  // Timer while the call is active; persist duration every few seconds.
  useEffect(() => {
    if (phase !== 'active') return
    const interval = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 1
        elapsedRef.current = next
        if (next % 5 === 0) {
          repository.updateSessionProgress(session.id, { durationSeconds: next }).catch(() => undefined)
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [phase, repository, session.id])

  // Persist the conversation state (listening/speaking) when it changes.
  useEffect(() => {
    if (phase !== 'active') return
    if (lastPersistedState.current === conversationState) return
    lastPersistedState.current = conversationState
    repository.updateSessionProgress(session.id, { conversationState }).catch(() => undefined)
  }, [conversationState, phase, repository, session.id])

  // Hang up if the participant leaves the screen mid-call.
  useEffect(() => {
    return () => {
      void Promise.resolve(conversation.endSession()).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = async () => {
    setError('')
    setPhase('starting')
    try {
      const signedUrl = await repository.requestVoiceSignedUrl(session.id)
      await conversation.startSession({ signedUrl })
      setPhase('active')
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : ''
      setError(/permission|denied|microphone|not\s?allowed|getusermedia/i.test(message)
        ? 'כדי לדבר עם הדמות יש לאשר גישה למיקרופון בדפדפן ולנסות שוב.'
        : (message || 'לא הצלחנו להתחיל את השיחה הקולית. נסו שוב.'))
      setPhase('idle')
    }
  }

  const finish = async () => {
    if (phase === 'active' && !window.confirm('לסיים את הסימולציה? לאחר הסיום לא ניתן להמשיך את השיחה הזו.')) return
    setPhase('ending')
    setError('')
    try {
      await Promise.resolve(conversation.endSession()).catch(() => undefined)
      await repository.completeSession(session.id, elapsedRef.current, transcriptRef.current)
      navigate(`/simulation/${publicToken}/complete?session=${session.id}`)
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : 'לא הצלחנו לסיים את הסימולציה.')
      setPhase('active')
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
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
            {phase === 'active' && (
              <div className={`conversation-status conversation-status-${conversationState}`} role="status" aria-live="polite">
                {conversationState === 'speaking' && <Volume2 className="h-4 w-4" aria-hidden="true" />}
                <span className="status-pulse" aria-hidden="true" /> {stateLabels[conversationState]}
              </div>
            )}
          </div>

          <div className="my-10 flex flex-col items-center">
            {phase === 'idle' && (
              <>
                <button type="button" onClick={start} aria-label="התחלת שיחה קולית" className="microphone-button">
                  <Mic className="h-10 w-10" aria-hidden="true" />
                </button>
                <p className="mt-4 text-sm font-bold text-[#566f69]">לחצו כדי להתחיל לדבר. הדפדפן יבקש הרשאה למיקרופון.</p>
              </>
            )}
            {phase === 'starting' && (
              <div className="flex flex-col items-center text-[#566f69]">
                <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
                <p className="mt-4 text-sm font-bold">מתחברים לדמות…</p>
              </div>
            )}
            {phase === 'active' && (
              <div className="flex flex-col items-center">
                <div className={`microphone-button ${conversation.isSpeaking ? 'microphone-button-busy' : ''}`} aria-hidden="true">
                  <Mic className="h-10 w-10" />
                </div>
                <p className="mt-4 text-sm font-bold text-[#566f69]">דברו באופן טבעי — הדמות מקשיבה ומגיבה.</p>
              </div>
            )}
            {phase === 'ending' && (
              <div className="flex flex-col items-center text-[#566f69]">
                <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
                <p className="mt-4 text-sm font-bold">מסיימים…</p>
              </div>
            )}
          </div>

          {transcript.length > 0 && (
            <div className="mb-8 max-h-48 overflow-y-auto rounded-2xl bg-[#f5f7f6] p-4" aria-label="תמלול השיחה">
              {transcript.slice(-4).map((entry) => <p key={entry.id} className="mb-2 text-sm leading-6"><strong>{entry.speaker === 'participant' ? 'את/ה' : simulation.character.name}:</strong> {entry.text}</p>)}
            </div>
          )}

          {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p>}

          {phase !== 'idle' && (
            <div className="flex justify-center">
              <Button variant="danger" icon={<CircleStop className="h-4 w-4" />} onClick={finish} disabled={phase === 'ending' || phase === 'starting'}>סיום הסימולציה</Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
