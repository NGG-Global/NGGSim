import { describe, expect, it } from 'vitest'
import {
  describeStop,
  formatTimer,
  isCallRunning,
  isMicInputStalled,
  MIC_STALL_LIMIT_MS,
  resolvePhase,
  type PhaseInput,
} from './conversationShared'

function phaseInput(overrides: Partial<PhaseInput> = {}): PhaseInput {
  return { started: false, starting: false, ending: false, stopped: null, everConnected: false, status: 'disconnected', ...overrides }
}

describe('conversation phase', () => {
  it('is idle before the participant starts', () => {
    expect(resolvePhase(phaseInput())).toBe('idle')
  })

  it('stays connecting between startSession and the open socket', () => {
    // The SDK still reports `disconnected` in that window; treating it as a stop would
    // show a connection error on every single call.
    expect(resolvePhase(phaseInput({ starting: true }))).toBe('starting')
    expect(resolvePhase(phaseInput({ started: true, status: 'disconnected' }))).toBe('connecting')
    expect(resolvePhase(phaseInput({ started: true, status: 'connecting' }))).toBe('connecting')
  })

  it('is active only while the socket is connected', () => {
    expect(resolvePhase(phaseInput({ started: true, everConnected: true, status: 'connected' }))).toBe('active')
    expect(isCallRunning('active')).toBe(true)
    expect(isCallRunning('stopped')).toBe(false)
    expect(isCallRunning('connecting')).toBe(false)
  })

  it('reports a stop once a connected call is no longer connected', () => {
    // This is the case the panel used to render as an active call with a running timer.
    expect(resolvePhase(phaseInput({ started: true, everConnected: true, status: 'disconnected' }))).toBe('stopped')
    expect(resolvePhase(phaseInput({ started: true, everConnected: true, status: 'error' }))).toBe('stopped')
  })

  it('lets an explicit stop reason win over the socket status', () => {
    expect(resolvePhase(phaseInput({ started: true, everConnected: true, status: 'connected', stopped: 'error' }))).toBe('stopped')
  })

  it('puts ending ahead of every other phase', () => {
    expect(resolvePhase(phaseInput({ started: true, everConnected: true, status: 'connected', stopped: 'error', ending: true }))).toBe('ending')
  })
})

describe('stop notices', () => {
  it('offers a reconnection after a dropped connection', () => {
    const notice = describeStop('error', 'socket closed')
    expect(notice.canReconnect).toBe(true)
    expect(notice.message).toContain('נקטע')
    expect(notice.message).toContain('socket closed')
  })

  it('omits an empty detail instead of showing empty parentheses', () => {
    expect(describeStop('error', '   ').message).not.toContain('(')
    expect(describeStop('error').message).not.toContain('(')
  })

  it('does not offer a reconnection when the character ended the call', () => {
    const notice = describeStop('agent')
    expect(notice.canReconnect).toBe(false)
    expect(notice.message).toContain('סיימה את השיחה')
  })
})

describe('microphone stall detection', () => {
  it('reports nothing without a baseline', () => {
    expect(isMicInputStalled(1_000_000, null)).toBe(false)
  })

  it('reports a stall only past the limit', () => {
    const now = 1_000_000
    expect(isMicInputStalled(now, now - 1000)).toBe(false)
    expect(isMicInputStalled(now, now - (MIC_STALL_LIMIT_MS - 1))).toBe(false)
    expect(isMicInputStalled(now, now - MIC_STALL_LIMIT_MS)).toBe(true)
  })

  it('keeps the limit generous enough for a listening participant', () => {
    expect(MIC_STALL_LIMIT_MS).toBeGreaterThanOrEqual(30_000)
  })
})

describe('timer formatting', () => {
  it('formats minutes and seconds', () => {
    expect(formatTimer(0)).toBe('00:00')
    expect(formatTimer(65)).toBe('01:05')
    expect(formatTimer(3600)).toBe('60:00')
  })
})
