import { ConversationProvider, useConversation } from '@elevenlabs/react'
import { CircleStop, Loader2, Mic, PlugZap, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useSimulationRepository } from '../../repositories/SimulationRepositoryProvider'
import type { ConversationState, ParticipantSimulationView, SimulationSession, TranscriptEntry } from '../../types/simulation'
import {
  describeStop,
  formatTimer,
  isCallRunning,
  isMicInputStalled,
  MIC_SILENCE_LEVEL,
  resolvePhase,
  stateLabels,
  type SdkStatus,
  type StopReason,
} from './conversationShared'

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
 * server, never from here, so hidden info stays off the client.
 *
 * A signed URL means the WebSocket transport, which has no reconnection logic in the
 * SDK. Every way a call can stop is therefore made visible here — a dropped socket, an
 * agent-ended call, and a microphone the browser stopped capturing from — instead of
 * leaving the participant on a screen that still claims the character is listening.
 */
function LiveConversationInner({ session, simulation, publicToken }: Props) {
  const navigate = useNavigate()
  const repository = useSimulationRepository()
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState('')
  const [everConnected, setEverConnected] = useState(false)
  const [stopped, setStopped] = useState<StopReason | null>(null)
  const [stopDetail, setStopDetail] = useState('')
  const [micStalled, setMicStalled] = useState(false)
  const [elapsed, setElapsed] = useState(session.durationSeconds)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(session.transcript)
  const transcriptRef = useRef<TranscriptEntry[]>(session.transcript)
  const elapsedRef = useRef(session.durationSeconds)
  const lastPersistedState = useRef<ConversationState | null>(null)
  const blobRef = useRef<HTMLDivElement>(null)
  // Set before every endSession() we ask for, so the disconnect callback can tell an
  // intended end apart from a call that fell over on its own.
  const userEndedRef = useRef(false)
  // Last moment the local microphone produced audible input, or null while we have no
  // baseline (just connected, or the tab was hidden and the animation loop was paused).
  const lastInputAtRef = useRef<number | null>(null)
  const lastVadRef = useRef<{ score: number; at: number } | null>(null)
  const micStalledRef = useRef(false)

  const conversation = useConversation({
    onConnect: () => {
      setEverConnected(true)
      setStopped(null)
      setStopDetail('')
      setMicStalled(false)
      lastInputAtRef.current = null
    },
    // The only place a stopped call becomes visible. `user` is our own endSession.
    onDisconnect: (details: unknown) => {
      const data = (details ?? {}) as { reason?: unknown; message?: unknown }
      if (userEndedRef.current || data.reason === 'user') return
      console.warn('[simulation] conversation stopped', {
        reason: data.reason,
        message: data.message,
        elapsedSeconds: elapsedRef.current,
        lastVad: lastVadRef.current,
      })
      setStopped(data.reason === 'agent' ? 'agent' : 'error')
      setStopDetail(typeof data.message === 'string' ? data.message : '')
    },
    // Typed loosely on purpose: the client emits a `disconnecting` status that the React
    // hook's own status union does not carry.
    onStatusChange: ({ status }: { status: string }) => {
      // Kept for diagnosing incident reports: the sequence of statuses is the only
      // record we have of how a call ended.
      console.info('[simulation] conversation status', status)
    },
    onVadScore: ({ vadScore }: { vadScore: number }) => {
      // Recorded for diagnosis only. It is not used to reset the microphone detector: the
      // score's idle cadence and range are not documented well enough to rely on, and a
      // resting value above zero would silently disable the detector.
      lastVadRef.current = { score: vadScore, at: Date.now() }
    },
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

  const phase = resolvePhase({ started, starting, ending, stopped, everConnected, status: conversation.status as SdkStatus })
  const running = isCallRunning(phase)
  const conversationState: ConversationState = running
    ? (conversation.isSpeaking ? 'speaking' : 'listening')
    : 'thinking'

  // Timer while a call is running; persist duration every few seconds. A stopped call
  // must not keep counting — the duration is what the facilitator reads as practice time.
  useEffect(() => {
    if (!running) return
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
  }, [running, repository, session.id])

  // Warn once the local microphone has been flat long enough that a quiet room cannot
  // explain it. We only inform: a false positive must never interrupt a real call.
  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      const stalled = isMicInputStalled(Date.now(), lastInputAtRef.current)
      if (stalled && !micStalledRef.current) {
        console.warn('[simulation] no microphone input detected', {
          elapsedSeconds: elapsedRef.current,
          lastInputAt: lastInputAtRef.current,
          lastVad: lastVadRef.current,
        })
      }
      micStalledRef.current = stalled
      setMicStalled(stalled)
    }, 2000)
    return () => window.clearInterval(interval)
  }, [running])

  // requestAnimationFrame is paused while the tab is hidden, so the baseline is dropped
  // on return instead of reporting a stall the participant never had.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastInputAtRef.current = null
        setMicStalled(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Persist the conversation state (listening/speaking) when it changes.
  useEffect(() => {
    if (!running) return
    if (lastPersistedState.current === conversationState) return
    lastPersistedState.current = conversationState
    repository.updateSessionProgress(session.id, { conversationState }).catch(() => undefined)
  }, [conversationState, running, repository, session.id])

  // Hang up if the participant leaves the screen mid-call.
  useEffect(() => {
    return () => {
      userEndedRef.current = true
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
        // The character's turn is not the participant's silence, so it does not count.
        if (inVol > MIC_SILENCE_LEVEL || c.isSpeaking || lastInputAtRef.current === null) {
          lastInputAtRef.current = Date.now()
        }
        level = Math.min(1, Math.max(0, inVol, outVol))
      } catch {
        level = 0
      }
      if (blobRef.current) blobRef.current.style.setProperty('--level', level.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const start = async () => {
    setError('')
    setStopped(null)
    setStopDetail('')
    setMicStalled(false)
    lastInputAtRef.current = null
    userEndedRef.current = false
    setStarting(true)
    try {
      const { conversationToken, signedUrl, overrides } = await repository.requestVoiceSession(session.id)
      // Tag the call with our session id so the post-call webhook can match the
      // analysis back to this attempt. Both transports send the same initiation payload,
      // so the overrides and this variable reach the agent either way.
      const credential = conversationToken
        ? { conversationToken, connectionType: 'webrtc' as const }
        : { signedUrl: signedUrl ?? '' }
      const sessionConfig = {
        ...credential,
        ...(overrides ? { overrides } : {}),
        dynamicVariables: { ngg_session_id: session.id },
      }
      conversation.startSession(sessionConfig as Parameters<typeof conversation.startSession>[0])
      setStarted(true)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'לא הצלחנו להתחיל את השיחה הקולית. נסו שוב.')
    } finally {
      setStarting(false)
    }
  }

  const finish = async () => {
    if (phase === 'active' && !window.confirm('לסיים את הסימולציה? לאחר הסיום לא ניתן להמשיך את השיחה הזו.')) return
    setEnding(true)
    setError('')
    try {
      userEndedRef.current = true
      try { conversation.endSession() } catch { /* ignore */ }
      await repository.completeSession(session.id, elapsedRef.current, transcriptRef.current)
      navigate(`/simulation/${publicToken}/complete?session=${session.id}`)
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : 'לא הצלחנו לסיים את הסימולציה.')
      setEnding(false)
    }
  }

  const stopNotice = stopped ? describeStop(stopped, stopDetail) : null

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

          <div className="my-10 flex min-h-[16rem] flex-col items-center justify-center">
            {phase === 'idle' && (
              <>
                <button type="button" onClick={start} className="sim-start-button">
                  <Mic className="h-6 w-6" aria-hidden="true" /> התחל סימולציה
                </button>
                <p className="mt-4 text-sm font-bold text-[#566f69]">בלחיצה יתחיל התרגול והדפדפן יבקש הרשאה למיקרופון.</p>
              </>
            )}
            {(phase === 'starting' || phase === 'connecting') && (
              <div className="flex flex-col items-center text-[#566f69]">
                <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
                <p className="mt-4 text-sm font-bold">מתחברים לדמות…</p>
              </div>
            )}
            {phase === 'stopped' && stopNotice && (
              <div className="flex max-w-lg flex-col items-center gap-5 text-center">
                <PlugZap className="h-10 w-10 text-[#b0503f]" aria-hidden="true" />
                <p role="alert" className="text-base font-bold leading-7 text-[#4f6862]">{stopNotice.message}</p>
                {stopNotice.canReconnect && (
                  <Button icon={<Mic className="h-4 w-4" />} onClick={start}>התחברות מחדש</Button>
                )}
              </div>
            )}
            {phase === 'active' && (
              <div className="flex flex-col items-center gap-6">
                <div ref={blobRef} className={`sim-blob ${conversation.isSpeaking ? 'sim-blob-speaking' : ''}`} aria-hidden="true" />
                <p className="text-base font-bold text-[#566f69]" role="status" aria-live="polite">
                  {conversation.isSpeaking ? 'הדמות מדברת…' : 'מדברים — הדמות מקשיבה 🎙️'}
                </p>
              </div>
            )}
            {phase === 'ending' && (
              <div className="flex flex-col items-center text-[#566f69]">
                <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
                <p className="mt-4 text-sm font-bold">מסיימים…</p>
              </div>
            )}
          </div>

          {phase === 'active' && micStalled && (
            <p role="status" className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              לא זוהה קלט מהמיקרופון זמן ממושך. בדקו שהמיקרופון פעיל ושאין אפליקציה אחרת שמשתמשת בו, ונסו לדבר שוב. אם הדמות אינה מגיבה, התחברות מחדש בדרך כלל פותרת את זה.
            </p>
          )}

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
