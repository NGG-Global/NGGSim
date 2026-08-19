import type { ConversationState } from '../../types/simulation'

export const stateLabels: Record<ConversationState, string> = {
  listening: 'הדמות מקשיבה',
  thinking: 'הדמות חושבת',
  speaking: 'הדמות מדברת',
}

export function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

/**
 * The single source of truth for what the participant sees during a live call.
 *
 * The panel used to treat the SDK's `disconnected` status as an active call, so a call
 * that lost its socket kept showing "the character is listening" with a running timer and
 * no error. The voice transport we use (an ElevenLabs signed URL, i.e. WebSocket) has no
 * reconnection logic of its own, so a dropped socket is permanent until the participant
 * starts a new one — it has to be surfaced, not absorbed.
 */
export type ConversationPhase = 'idle' | 'starting' | 'connecting' | 'active' | 'stopped' | 'ending'

/** Why a call stopped on its own. `user` never reaches here — it is an intended end. */
export type StopReason = 'error' | 'agent'

export type SdkStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface PhaseInput {
  /** The participant pressed start and we have not finished the call yet. */
  started: boolean
  /** We are minting a signed URL, before the SDK has a status of its own. */
  starting: boolean
  /** The participant pressed "finish" and we are persisting the attempt. */
  ending: boolean
  /** Set once the call stopped without the participant asking for it. */
  stopped: StopReason | null
  /** True from the first successful connect onwards. */
  everConnected: boolean
  status: SdkStatus
}

export function resolvePhase({ started, starting, ending, stopped, everConnected, status }: PhaseInput): ConversationPhase {
  if (ending) return 'ending'
  if (stopped) return 'stopped'
  if (starting) return 'starting'
  if (!started) return 'idle'
  if (status === 'connected') return 'active'
  // The SDK still reports `disconnected` for the moment between startSession() and the
  // socket opening, so a call that has never connected is still connecting, not stopped.
  if (status === 'connecting' || !everConnected) return 'connecting'
  // Connected once and no longer: the call is gone even if no callback fired.
  return 'stopped'
}

/** Only an active call may advance the timer and the persisted conversation state. */
export function isCallRunning(phase: ConversationPhase): boolean {
  return phase === 'active'
}

export interface StopNotice {
  message: string
  /** Whether offering another connection attempt makes sense. */
  canReconnect: boolean
}

export function describeStop(reason: StopReason, detail?: string): StopNotice {
  if (reason === 'agent') {
    return { message: 'הדמות סיימה את השיחה. אפשר לסיים את הסימולציה ולעבור לסיכום.', canReconnect: false }
  }
  const suffix = detail && detail.trim() ? ` (${detail.trim()})` : ''
  return {
    message: `החיבור לשיחה נקטע${suffix}. אפשר להתחבר מחדש ולהמשיך את התרגול, או לסיים כאן.`,
    canReconnect: true,
  }
}

/**
 * How long the local microphone level may stay flat before we tell the participant.
 * This detects the failure the SDK does not recover from: the browser or the operating
 * system suspends audio capture mid-call (tab in the background, an incoming call, a
 * headset switch), the socket stays open, and the character keeps talking into a void.
 *
 * The window is deliberately generous, and the caller does not count the stretches where
 * the character is speaking, because a participant who is listening is legitimately quiet.
 * A false alarm here costs the participant's trust mid-exercise, so the detector only ever
 * informs — it never ends or restarts a call.
 */
export const MIC_STALL_LIMIT_MS = 45_000

/** Anything at or below this is treated as "no capture", not as a quiet room. */
export const MIC_SILENCE_LEVEL = 0.002

/**
 * `lastInputAt` is null while we have no baseline yet — right after connecting, and after
 * the tab becomes visible again, since requestAnimationFrame does not run while hidden and
 * would otherwise report a stall the moment the participant returns.
 */
export function isMicInputStalled(now: number, lastInputAt: number | null): boolean {
  if (lastInputAt === null) return false
  return now - lastInputAt >= MIC_STALL_LIMIT_MS
}
