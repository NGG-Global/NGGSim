import { ConversationProvider, useConversation } from '@elevenlabs/react'
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

/** useConversation must live inside a ConversationProvider, so wrap here. */
export function LiveConversationPanel(props: Props) {
  return (
    <ConversationProvider>
      <LiveConversationInner {...props} />
    </ConversationProvider>
  )
}

/**
 * Live voice conversation via ElevenLabs. The browser connects with a short-lived
 * signed URL minted server-side; the per-simulation character is injected by the
 * server (initiation webhook), never from here, so hidden info stays off the client.
 */
function LiveConversationInner({ session, simulation, publicToken }: Props) {
  const navigate = useNavigate()
  const repository = useSimulationRepository()
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(session.durationSeconds)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(session.transcript)
  const transcriptRef = useRef<TranscriptEntry[]>(session.transcript)
  const elapsedRef = useRef(session.durationSeconds)
  const lastPersistedState = useRef<ConversationState | null>(null)
  const blobRef = useRef<HTMLDivElement>(null)

  const conversation = useConversation({
    onError: (message: unknown) => {
      const text = typeof message === 'string' ? message : ''
      setError(/permission|denied|microphone|not\s?allowed|getusermedia|audio/i.test(text)
        ? 'כדי לדבר עם הדמות יש לאשר גישה למיקרופון בדפדפן ולנסות שוב.'
        : (text || 'אירעה שגיאה בשיחה הקולית. נסו שוב.'))
      setStarted(false)
    },
    onMessage: (payload: unknown) => {
      const data = payload as { message?: unknown; source?: unknown }
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

  // Keep a live reference so the animation loop always reads the current audio getters.
  const convRef = useRef(conversation)
  convRef.current = conversation

  const isConnected = conversation.status === 'connected'
  const conversationState: ConversationState = isConnected
    ? (conversation.isSpeaking ? 'speaking' : 'listening')
    : 'thinking'

  // Timer while a call is running; persist duration every few seconds.
  useEffect(() => {
    if (!started) return
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
  }, [started, repository, session.id])

  // Persist the conversation state (listening/speaking) when it changes.
  useEffect(() => {
    if (!started || !isConnected) return
    if (lastPersistedState.current === conversationState) return
    lastPersistedState.current = conversationState
    repository.updateSessionProgress(session.id, { conversationState }).catch(() => undefined)
  }, [conversationState, isConnected, started, repository, session.id])

  // Hang up if the participant leaves the screen mid-call.
  useEffect(() => {
    return () => {
      try { conversation.endSession() } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drive the blob's scale from live microphone / agent volume, each frame.
  useEffect(() => {
    if (!started) return
    let raf = 0
    const tick = () => {
      const c = convRef.current
      let level = 0
      try {
        const inVol = typeof c.getInputVolume === 'function' ? c.getInputVolume() : 0
        const outVol = typeof c.getOutputVolume === 'function' ? c.getOutputVolume() : 0
        level = Math.min(1, Math.max(0, inVol, outVol))
      } catch {
        level = 0
      }
      if (blobRef.current) blobRef.current.style.setProperty('--level', level.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started])

  const start = async () => {
    setError('')
    setStarting(true)
    try {
      const { signedUrl, overrides } = await repository.requestVoiceSignedUrl(session.id)
      const sessionConfig = { signedUrl, ...(overrides ? { overrides } : {}) }
      conversation.startSession(sessionConfig as Parameters<typeof conversation.startSession>[0])
      setStarted(true)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'לא הצלחנו להתחיל את השיחה הקולית. נסו שוב.')
    } finally {
      setStarting(false)
    }
  }

  const finish = async () => {
    if (started && isConnected && !window.confirm('לסיים את הסימולציה? לאחר הסיום לא ניתן להמשיך את השיחה הזו.')) return
    setEnding(true)
    setError('')
    try {
      try { conversation.endSession() } catch { /* ignore */ }
      await repository.completeSession(session.id, elapsedRef.current, transcriptRef.current)
      navigate(`/simulation/${publicToken}/complete?session=${session.id}`)
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : 'לא הצלחנו לסיים את הסימולציה.')
      setEnding(false)
    }
  }

  const connecting = started && conversation.status === 'connecting'
  const active = started && (conversation.status === 'connected' || conversation.status === 'disconnected')

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
            {active && (
              <div className={`conversation-status conversation-status-${conversationState}`} role="status" aria-live="polite">
                {conversationState === 'speaking' && <Volume2 className="h-4 w-4" aria-hidden="true" />}
                <span className="status-pulse" aria-hidden="true" /> {stateLabels[conversationState]}
              </div>
            )}
          </div>

          <div className="my-10 flex min-h-[16rem] flex-col items-center justify-center">
            {!started && !starting && (
              <>
                <button type="button" onClick={start} className="sim-start-button">
                  <Mic className="h-6 w-6" aria-hidden="true" /> התחל סימולציה
                </button>
                <p className="mt-4 text-sm font-bold text-[#566f69]">בלחיצה יתחיל התרגול והדפדפן יבקש הרשאה למיקרופון.</p>
              </>
            )}
            {(starting || connecting) && (
              <div className="flex flex-col items-center text-[#566f69]">
                <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
                <p className="mt-4 text-sm font-bold">מתחברים לדמות…</p>
              </div>
            )}
            {active && !connecting && (
              <div className="flex flex-col items-center gap-6">
                <div ref={blobRef} className={`sim-blob ${conversation.isSpeaking ? 'sim-blob-speaking' : ''}`} aria-hidden="true" />
                <p className="text-base font-bold text-[#566f69]" role="status" aria-live="polite">
                  {conversation.isSpeaking ? 'הדמות מדברת…' : 'מדברים — הדמות מקשיבה 🎙️'}
                </p>
              </div>
            )}
            {ending && (
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

          {started && (
            <div className="flex justify-center">
              <Button variant="danger" icon={<CircleStop className="h-4 w-4" />} onClick={finish} disabled={ending}>סיום הסימולציה</Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
