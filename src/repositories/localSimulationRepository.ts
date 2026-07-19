import { createBlankSimulation } from '../data/defaults'
import { createDemoReports, createDemoSessions, createDemoSimulations } from '../data/demoData'
import type {
  PublicUnavailableReason,
  PublicSimulationResult,
  Simulation,
  SimulationReport,
  SimulationRepository,
  SimulationSession,
  TranscriptEntry,
} from '../types/simulation'
import { toParticipantSimulationView } from '../services/participantSimulationMapper'
import { validatePublishable } from './simulationValidation'

const SIMULATIONS_KEY = 'simulab.simulations.v1'
const SESSIONS_KEY = 'simulab.sessions.v1'
const REPORTS_KEY = 'simulab.reports.v1'
const REVOKED_KEY = 'simulab.revoked-links.v1'
export const STORAGE_CHANGED_EVENT = 'simulab:storage-changed'

interface RevokedLink {
  reason: Exclude<PublicUnavailableReason, 'draft' | 'not_found'>
  revokedAt: string
}

function uid(prefix: string): string {
  const value = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  return `${prefix}-${value}`
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function notify(): void {
  window.dispatchEvent(new CustomEvent(STORAGE_CHANGED_EVENT))
}

function ensureSeeded(): void {
  if (!window.localStorage.getItem(SIMULATIONS_KEY)) {
    writeJson(SIMULATIONS_KEY, createDemoSimulations())
  }
  if (!window.localStorage.getItem(SESSIONS_KEY)) {
    writeJson(SESSIONS_KEY, createDemoSessions())
  }
  if (!window.localStorage.getItem(REPORTS_KEY)) {
    writeJson(REPORTS_KEY, createDemoReports())
  }
  if (!window.localStorage.getItem(REVOKED_KEY)) {
    writeJson(REVOKED_KEY, {})
  }
}

function currentBaseUrl(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
}

export class LocalSimulationRepository implements SimulationRepository {
  readonly provider = 'local' as const

  async list(): Promise<Simulation[]> {
    ensureSeeded()
    return clone(readJson<Simulation[]>(SIMULATIONS_KEY, []))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getById(id: string): Promise<Simulation | null> {
    return (await this.list()).find((simulation) => simulation.id === id) ?? null
  }

  async create(input: Partial<Simulation> = {}): Promise<Simulation> {
    const simulations = await this.list()
    const simulation = { ...createBlankSimulation(uid('sim')), ...clone(input) }
    simulations.unshift(simulation)
    writeJson(SIMULATIONS_KEY, simulations)
    notify()
    return clone(simulation)
  }

  async update(id: string, patch: Partial<Simulation>): Promise<Simulation> {
    const simulations = await this.list()
    const index = simulations.findIndex((simulation) => simulation.id === id)
    if (index < 0) throw new Error('הסימולציה לא נמצאה.')
    const updated: Simulation = {
      ...simulations[index],
      ...clone(patch),
      id,
      updatedAt: new Date().toISOString(),
    }
    simulations[index] = updated
    writeJson(SIMULATIONS_KEY, simulations)
    notify()
    return clone(updated)
  }

  async publish(id: string): Promise<Simulation> {
    const simulation = await this.getById(id)
    if (!simulation) throw new Error('הסימולציה לא נמצאה.')
    validatePublishable(simulation)
    const token = simulation.publicToken ?? this.createPublicToken()
    const now = new Date().toISOString()
    const revoked = readJson<Record<string, RevokedLink>>(REVOKED_KEY, {})
    delete revoked[token]
    writeJson(REVOKED_KEY, revoked)
    return this.update(id, {
      status: 'published',
      publicToken: token,
      publishedAt: now,
      shareLink: {
        token,
        url: `${currentBaseUrl()}/simulation/${token}`,
        createdAt: now,
        isActive: true,
      },
    })
  }

  async unpublish(id: string): Promise<Simulation> {
    const simulation = await this.getById(id)
    if (!simulation) throw new Error('הסימולציה לא נמצאה.')
    if (simulation.publicToken) this.revoke(simulation.publicToken, 'unpublished')
    return this.update(id, {
      status: 'unpublished',
      shareLink: simulation.shareLink ? { ...simulation.shareLink, isActive: false } : null,
    })
  }

  async regeneratePublicToken(id: string): Promise<Simulation> {
    const simulation = await this.getById(id)
    if (!simulation) throw new Error('הסימולציה לא נמצאה.')
    validatePublishable(simulation)
    if (simulation.publicToken) this.revoke(simulation.publicToken, 'replaced')
    const token = this.createPublicToken()
    const now = new Date().toISOString()
    return this.update(id, {
      publicToken: token,
      status: 'published',
      publishedAt: simulation.publishedAt ?? now,
      shareLink: {
        token,
        url: `${currentBaseUrl()}/simulation/${token}`,
        createdAt: now,
        isActive: true,
      },
    })
  }

  async duplicate(id: string): Promise<Simulation> {
    const source = await this.getById(id)
    if (!source) throw new Error('הסימולציה לא נמצאה.')
    const duplicate = clone(source)
    duplicate.id = uid('sim')
    duplicate.title = `${source.title} — עותק`
    duplicate.status = 'draft'
    duplicate.publicToken = null
    duplicate.shareLink = null
    duplicate.publishedAt = null
    duplicate.attemptCount = 0
    duplicate.createdAt = new Date().toISOString()
    duplicate.updatedAt = duplicate.createdAt
    const simulations = await this.list()
    simulations.unshift(duplicate)
    writeJson(SIMULATIONS_KEY, simulations)
    notify()
    return clone(duplicate)
  }

  async remove(id: string): Promise<void> {
    const simulations = await this.list()
    const simulation = simulations.find((item) => item.id === id)
    if (!simulation) return
    if (simulation.publicToken) this.revoke(simulation.publicToken, 'deleted')
    writeJson(SIMULATIONS_KEY, simulations.filter((item) => item.id !== id))
    notify()
  }

  async lookupPublicToken(token: string): Promise<PublicSimulationResult> {
    const normalizedToken = token.trim()
    const simulation = (await this.list()).find((item) => item.publicToken === normalizedToken)
    if (simulation) {
      if (simulation.status === 'published' && simulation.shareLink?.isActive) {
        return { state: 'available', simulation: toParticipantSimulationView(simulation) }
      }
      if (simulation.status === 'draft') return { state: 'unavailable', reason: 'draft' }
      return { state: 'unavailable', reason: 'unpublished' }
    }
    const revoked = readJson<Record<string, RevokedLink>>(REVOKED_KEY, {})
    return { state: 'unavailable', reason: revoked[normalizedToken]?.reason ?? 'not_found' }
  }

  async createSession(token: string, details: Record<string, string>): Promise<SimulationSession> {
    const simulation = (await this.list()).find((item) => item.publicToken === token)
    if (!simulation || simulation.status !== 'published') {
      throw new Error('לא ניתן להתחיל את הסימולציה מהקישור הזה.')
    }
    const simulationId = simulation.id
    const session: SimulationSession = {
      id: uid('session'),
      simulationId,
      publicToken: token,
      participant: {
        id: uid('participant'),
        simulationId,
        details: clone(details),
        createdAt: new Date().toISOString(),
      },
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationSeconds: 0,
      status: 'in_progress',
      conversationState: 'listening',
      transcript: [],
    }
    const sessions = readJson<SimulationSession[]>(SESSIONS_KEY, [])
    sessions.unshift(session)
    writeJson(SESSIONS_KEY, sessions)
    notify()
    return clone(session)
  }

  async getSession(id: string): Promise<SimulationSession | null> {
    return clone(readJson<SimulationSession[]>(SESSIONS_KEY, []).find((session) => session.id === id) ?? null)
  }

  async listSessions(simulationId: string): Promise<SimulationSession[]> {
    return clone(readJson<SimulationSession[]>(SESSIONS_KEY, []))
      .filter((session) => session.simulationId === simulationId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async updateSessionProgress(id: string, patch: Partial<Pick<SimulationSession, 'durationSeconds' | 'conversationState' | 'transcript'>>): Promise<SimulationSession> {
    const sessions = readJson<SimulationSession[]>(SESSIONS_KEY, [])
    const index = sessions.findIndex((session) => session.id === id)
    if (index < 0) throw new Error('הניסיון לא נמצא.')
    sessions[index] = { ...sessions[index], ...clone(patch) }
    writeJson(SESSIONS_KEY, sessions)
    return clone(sessions[index])
  }

  async completeSession(id: string, durationSeconds: number, transcript: TranscriptEntry[]): Promise<SimulationSession> {
    const sessions = readJson<SimulationSession[]>(SESSIONS_KEY, [])
    const index = sessions.findIndex((session) => session.id === id)
    if (index < 0) throw new Error('הניסיון לא נמצא.')
    sessions[index] = {
      ...sessions[index],
      endedAt: new Date().toISOString(),
      durationSeconds,
      status: 'completed',
      conversationState: 'listening',
      transcript: clone(transcript),
    }
    writeJson(SESSIONS_KEY, sessions)

    const simulations = await this.list()
    const simulationIndex = simulations.findIndex((simulation) => simulation.id === sessions[index].simulationId)
    if (simulationIndex >= 0) {
      simulations[simulationIndex].attemptCount = (await this.listSessions(sessions[index].simulationId)).length
      simulations[simulationIndex].updatedAt = new Date().toISOString()
      writeJson(SIMULATIONS_KEY, simulations)
    }

    const reports = readJson<SimulationReport[]>(REPORTS_KEY, [])
    if (!reports.some((report) => report.sessionId === id)) {
      reports.unshift({
        id: uid('report'),
        sessionId: id,
        summary: 'השיחה הושלמה בסביבת ההדגמה. לאחר חיבור מנוע השיחה יופק כאן סיכום המבוסס על התמלול.',
        scores: { 'הקשבה פעילה': 82, 'שאלות פתוחות': 78, אמפתיה: 86, 'בהירות המסר': 74 },
        strengths: ['שמירה על טון ענייני', 'מתן מקום לתגובה', 'חתירה להבנת נקודת המבט'],
        improvements: ['לנסח שאלות פתוחות יותר', 'לסכם צעדים ומועד מעקב'],
      })
      writeJson(REPORTS_KEY, reports)
    }
    notify()
    return clone(sessions[index])
  }

  async getReport(sessionId: string): Promise<SimulationReport | null> {
    return clone(readJson<SimulationReport[]>(REPORTS_KEY, []).find((report) => report.sessionId === sessionId) ?? null)
  }

  private createPublicToken(): string {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`
    return uuid.replace(/-/g, '')
  }

  private revoke(token: string, reason: RevokedLink['reason']): void {
    const revoked = readJson<Record<string, RevokedLink>>(REVOKED_KEY, {})
    revoked[token] = { reason, revokedAt: new Date().toISOString() }
    writeJson(REVOKED_KEY, revoked)
  }
}

export const simulationRepository: SimulationRepository = new LocalSimulationRepository()

export function resetDemoStorage(): void {
  writeJson(SIMULATIONS_KEY, createDemoSimulations())
  writeJson(SESSIONS_KEY, createDemoSessions())
  writeJson(REPORTS_KEY, createDemoReports())
  writeJson(REVOKED_KEY, {})
  notify()
}
