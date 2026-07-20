import type { SupabaseClient } from '@supabase/supabase-js'
import { createBlankSimulation } from '../data/defaults'
import type {
  PublicSimulationResult,
  Simulation,
  SimulationReport,
  SimulationRepository,
  SimulationSession,
  TranscriptEntry,
} from '../types/simulation'
import { supabaseConfiguration } from '../services/supabaseClient'
import { RepositoryError, toRepositoryError } from './repositoryErrors'
import { validatePublishable } from './simulationValidation'
import {
  mapParticipantSimulationRpc,
  mapReportRow,
  mapSessionRow,
  mapSimulationRow,
  simulationToDatabaseFields,
  type ReportRow,
  type SessionRow,
  type ShareLinkRow,
  type SimulationRow,
} from './supabaseSimulationMappers'

const SESSION_ACCESS_PREFIX = 'simulab.supabase-session-access.'
const SESSION_SELECT = '*, participant:participants(*), share_link:simulation_share_links(token)'

interface PublicSessionRpcPayload {
  accessToken?: string
  session?: SessionRow
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function currentBaseUrl(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
}

export class SupabaseSimulationRepository implements SimulationRepository {
  readonly provider = 'supabase' as const
  private readonly versions = new Map<string, number>()

  constructor(
    private readonly client: SupabaseClient | null,
    private readonly baseUrl = currentBaseUrl(),
    private readonly supabaseUrl: string | null = supabaseConfiguration.url,
  ) {}

  async list(): Promise<Simulation[]> {
    const client = this.requireClient()
    const simulationsResponse = await client
      .from('simulations')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (simulationsResponse.error) throw toRepositoryError(simulationsResponse.error, 'לא הצלחנו לטעון את הסימולציות.')
    const rows = (simulationsResponse.data ?? []) as unknown as SimulationRow[]
    if (!rows.length) return []

    const ids = rows.map((row) => row.id)
    const [linksResponse, sessionsResponse] = await Promise.all([
      client.from('simulation_share_links').select('*').in('simulation_id', ids).order('created_at', { ascending: false }),
      client.from('simulation_sessions').select('simulation_id').in('simulation_id', ids),
    ])
    if (linksResponse.error) throw toRepositoryError(linksResponse.error, 'לא הצלחנו לטעון את קישורי השיתוף.')
    if (sessionsResponse.error) throw toRepositoryError(sessionsResponse.error, 'לא הצלחנו לטעון את נתוני הניסיונות.')

    const latestLinks = new Map<string, ShareLinkRow>()
    for (const link of (linksResponse.data ?? []) as unknown as ShareLinkRow[]) {
      if (!latestLinks.has(link.simulation_id)) latestLinks.set(link.simulation_id, link)
    }
    const attemptCounts = new Map<string, number>()
    for (const session of (sessionsResponse.data ?? []) as Array<{ simulation_id: string }>) {
      attemptCounts.set(session.simulation_id, (attemptCounts.get(session.simulation_id) ?? 0) + 1)
    }

    return rows.map((row) => {
      this.versions.set(row.id, row.version)
      return mapSimulationRow(row, latestLinks.get(row.id) ?? null, attemptCounts.get(row.id) ?? 0, this.baseUrl)
    })
  }

  async getById(id: string): Promise<Simulation | null> {
    const client = this.requireClient()
    const simulationResponse = await client
      .from('simulations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (simulationResponse.error) throw toRepositoryError(simulationResponse.error, 'לא הצלחנו לטעון את הסימולציה.')
    if (!simulationResponse.data) return null
    const row = simulationResponse.data as unknown as SimulationRow

    const [linkResponse, sessionsResponse] = await Promise.all([
      client.from('simulation_share_links').select('*').eq('simulation_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      client.from('simulation_sessions').select('*', { count: 'exact', head: true }).eq('simulation_id', id),
    ])
    if (linkResponse.error) throw toRepositoryError(linkResponse.error, 'לא הצלחנו לטעון את קישור השיתוף.')
    if (sessionsResponse.error) throw toRepositoryError(sessionsResponse.error, 'לא הצלחנו לטעון את מספר הניסיונות.')
    this.versions.set(row.id, row.version)
    return mapSimulationRow(
      row,
      (linkResponse.data as unknown as ShareLinkRow | null) ?? null,
      sessionsResponse.count ?? 0,
      this.baseUrl,
    )
  }

  async create(input: Partial<Simulation> = {}): Promise<Simulation> {
    const client = this.requireClient()
    const ownerId = await this.requireOwnerId()
    const blank = createBlankSimulation('')
    const candidate: Simulation = { ...blank, ...clone(input), id: '' }
    const response = await client
      .from('simulations')
      .insert({ ...simulationToDatabaseFields(candidate), owner_id: ownerId })
      .select('*')
      .single()
    if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו ליצור טיוטה חדשה.')
    const row = response.data as unknown as SimulationRow
    this.versions.set(row.id, row.version)
    return mapSimulationRow(row, null, 0, this.baseUrl)
  }

  async update(id: string, patch: Partial<Simulation>): Promise<Simulation> {
    const client = this.requireClient()
    const current = await this.getById(id)
    if (!current) throw new RepositoryError('הסימולציה לא נמצאה.', 'not_found')
    const expectedVersion = this.versions.get(id)
    if (!expectedVersion) throw new RepositoryError('לא ניתן לזהות את גרסת הסימולציה. רעננו ונסו שוב.', 'conflict')
    const candidate: Simulation = { ...current, ...clone(patch), id }
    const response = await client
      .from('simulations')
      .update({ ...simulationToDatabaseFields(candidate), version: expectedVersion + 1 })
      .eq('id', id)
      .eq('version', expectedVersion)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle()
    if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לשמור את הסימולציה.')
    if (!response.data) {
      throw new RepositoryError('הסימולציה השתנתה בחלון אחר. רעננו את המסך לפני שמירה נוספת.', 'conflict')
    }
    const row = response.data as unknown as SimulationRow
    this.versions.set(row.id, row.version)
    return mapSimulationRow(row, this.toShareLinkRow(current), current.attemptCount, this.baseUrl)
  }

  async publish(id: string): Promise<Simulation> {
    const simulation = await this.getRequiredSimulation(id)
    validatePublishable(simulation)
    await this.callMutationRpc('publish_simulation', { p_simulation_id: id }, 'לא הצלחנו לפרסם את הסימולציה.')
    return this.getRequiredSimulation(id)
  }

  async unpublish(id: string): Promise<Simulation> {
    await this.callMutationRpc('unpublish_simulation', { p_simulation_id: id }, 'לא הצלחנו לבטל את הפרסום.')
    return this.getRequiredSimulation(id)
  }

  async regeneratePublicToken(id: string): Promise<Simulation> {
    const simulation = await this.getRequiredSimulation(id)
    validatePublishable(simulation)
    await this.callMutationRpc('regenerate_simulation_public_token', { p_simulation_id: id }, 'לא הצלחנו ליצור קישור חדש.')
    return this.getRequiredSimulation(id)
  }

  async duplicate(id: string): Promise<Simulation> {
    const source = await this.getRequiredSimulation(id)
    const now = new Date().toISOString()
    return this.create({
      ...clone(source),
      id: '',
      title: `${source.title} — עותק`,
      status: 'draft',
      publicToken: null,
      shareLink: null,
      publishedAt: null,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    })
  }

  async remove(id: string): Promise<void> {
    await this.callMutationRpc('archive_simulation', { p_simulation_id: id }, 'לא הצלחנו למחוק את הסימולציה.')
    this.versions.delete(id)
  }

  async lookupPublicToken(token: string): Promise<PublicSimulationResult> {
    const normalizedToken = token.trim()
    if (!normalizedToken) return { state: 'unavailable', reason: 'not_found' }
    const client = this.requireClient()
    const response = await client.rpc('get_participant_simulation', { public_token: normalizedToken })
    if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לטעון את הסימולציה הציבורית.')
    if (!response.data) return { state: 'unavailable', reason: 'not_found' }
    return { state: 'available', simulation: mapParticipantSimulationRpc(response.data) }
  }

  async createSession(
    token: string,
    details: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<SimulationSession> {
    const client = this.requireClient()
    const response = await client.rpc('start_public_simulation_session', {
      p_public_token: token,
      p_details: details,
      p_consent_version: 'pilot-v1',
      p_idempotency_key: idempotencyKey ?? null,
    })
    if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו להתחיל את הסימולציה.')
    const payload = response.data as unknown as PublicSessionRpcPayload
    if (!payload?.session || !payload.accessToken) throw new RepositoryError('השרת החזיר ניסיון לא תקין.', 'unknown')
    const session = mapSessionRow(payload.session)
    this.writeSessionAccessToken(session.id, payload.accessToken)
    return session
  }

  async requestVoiceSignedUrl(sessionId: string): Promise<string> {
    this.requireClient()
    if (!this.supabaseUrl) {
      throw new RepositoryError('כתובת Supabase הציבורית אינה מוגדרת, ולכן לא ניתן להתחיל שיחה קולית.', 'configuration')
    }
    const accessToken = this.readSessionAccessToken(sessionId)
    if (!accessToken) {
      throw new RepositoryError('לא נמצאה הרשאת שיחה תקפה. התחילו את הסימולציה מהקישור מחדש.', 'forbidden')
    }
    let response: Response
    try {
      response = await fetch(`${this.supabaseUrl.replace(/\/$/, '')}/functions/v1/elevenlabs-signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, accessToken }),
      })
    } catch {
      throw new RepositoryError('לא הצלחנו להתחבר לשירות השיחה הקולית. בדקו את החיבור לרשת.', 'unknown')
    }
    if (!response.ok) {
      throw new RepositoryError('לא הצלחנו להתחיל את השיחה הקולית. נסו שוב או פנו למנחה.', 'unknown')
    }
    const data = (await response.json().catch(() => null)) as { signedUrl?: unknown } | null
    if (!data || typeof data.signedUrl !== 'string' || !data.signedUrl) {
      throw new RepositoryError('השרת לא החזיר כתובת שיחה תקפה.', 'unknown')
    }
    return data.signedUrl
  }

  async getSession(id: string): Promise<SimulationSession | null> {
    const client = this.requireClient()
    const accessToken = this.readSessionAccessToken(id)
    if (accessToken) {
      const response = await client.rpc('get_public_simulation_session', { p_session_id: id, p_access_token: accessToken })
      if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לטעון את הניסיון.')
      return response.data ? mapSessionRow(response.data as unknown as SessionRow) : null
    }
    const response = await client.from('simulation_sessions').select(SESSION_SELECT).eq('id', id).maybeSingle()
    if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לטעון את הניסיון.')
    return response.data ? mapSessionRow(response.data as unknown as SessionRow) : null
  }

  async listSessions(simulationId: string): Promise<SimulationSession[]> {
    const client = this.requireClient()
    const response = await client
      .from('simulation_sessions')
      .select(SESSION_SELECT)
      .eq('simulation_id', simulationId)
      .order('created_at', { ascending: false })
    if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לטעון את הניסיונות.')
    return ((response.data ?? []) as unknown as SessionRow[]).map(mapSessionRow)
  }

  async updateSessionProgress(
    id: string,
    patch: Partial<Pick<SimulationSession, 'durationSeconds' | 'conversationState' | 'transcript'>>,
  ): Promise<SimulationSession> {
    const client = this.requireClient()
    const accessToken = this.readSessionAccessToken(id)
    if (accessToken) {
      const response = await client.rpc('update_public_simulation_session', {
        p_session_id: id,
        p_access_token: accessToken,
        p_duration_seconds: patch.durationSeconds,
        p_conversation_state: patch.conversationState,
        p_transcript: patch.transcript,
      })
      if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לשמור את התקדמות השיחה.')
      if (!response.data) throw new RepositoryError('הרשאת הניסיון אינה תקפה או שהניסיון כבר הסתיים.', 'forbidden')
      return mapSessionRow(response.data as unknown as SessionRow)
    }
    const response = await client
      .from('simulation_sessions')
      .update({
        ...(patch.durationSeconds !== undefined ? { duration_seconds: patch.durationSeconds } : {}),
        ...(patch.conversationState !== undefined ? { conversation_state: patch.conversationState } : {}),
        ...(patch.transcript !== undefined ? { transcript: patch.transcript } : {}),
      })
      .eq('id', id)
      .select(SESSION_SELECT)
      .single()
    if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לשמור את התקדמות השיחה.')
    return mapSessionRow(response.data as unknown as SessionRow)
  }

  async completeSession(id: string, durationSeconds: number, transcript: TranscriptEntry[]): Promise<SimulationSession> {
    const client = this.requireClient()
    const accessToken = this.readSessionAccessToken(id)
    if (accessToken) {
      const response = await client.rpc('complete_public_simulation_session', {
        p_session_id: id,
        p_access_token: accessToken,
        p_duration_seconds: durationSeconds,
        p_transcript: transcript,
      })
      if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לסיים את הסימולציה.')
      if (!response.data) throw new RepositoryError('הרשאת הניסיון אינה תקפה או שלא ניתן לסיים אותו במצב הנוכחי.', 'forbidden')
      return mapSessionRow(response.data as unknown as SessionRow)
    }
    const response = await client
      .from('simulation_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        conversation_state: 'listening',
        transcript,
      })
      .eq('id', id)
      .select(SESSION_SELECT)
      .single()
    if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לסיים את הסימולציה.')
    return mapSessionRow(response.data as unknown as SessionRow)
  }

  async getReport(sessionId: string): Promise<SimulationReport | null> {
    const client = this.requireClient()
    const response = await client.from('simulation_reports').select('*').eq('session_id', sessionId).maybeSingle()
    if (response.error) throw toRepositoryError(response.error, 'לא הצלחנו לטעון את הדוח.')
    return response.data ? mapReportRow(response.data as unknown as ReportRow) : null
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new RepositoryError(
        'ספק הנתונים Supabase נבחר, אך משתני הסביבה הציבוריים עדיין אינם מוגדרים.',
        'configuration',
      )
    }
    return this.client
  }

  private async requireOwnerId(): Promise<string> {
    const client = this.requireClient()
    const response = await client.auth.getClaims()
    if (response.error) throw toRepositoryError(response.error)
    const claims = response.data?.claims
    const ownerId = claims?.sub
    if (!ownerId || claims?.is_anonymous === true) {
      throw new RepositoryError('יש להתחבר כמנחה לפני שמירת נתונים.', 'authentication')
    }
    return ownerId
  }

  private async getRequiredSimulation(id: string): Promise<Simulation> {
    const simulation = await this.getById(id)
    if (!simulation) throw new RepositoryError('הסימולציה לא נמצאה.', 'not_found')
    return simulation
  }

  private async callMutationRpc(name: string, args: Record<string, unknown>, fallback: string): Promise<void> {
    const response = await this.requireClient().rpc(name, args)
    if (response.error) throw toRepositoryError(response.error, fallback)
  }

  private toShareLinkRow(simulation: Simulation): ShareLinkRow | null {
    if (!simulation.shareLink || !simulation.publicToken) return null
    return {
      id: '',
      simulation_id: simulation.id,
      owner_id: '',
      token: simulation.publicToken,
      status: simulation.shareLink.isActive ? 'active' : 'revoked',
      expires_at: null,
      revoked_at: simulation.shareLink.isActive ? null : simulation.updatedAt,
      created_at: simulation.shareLink.createdAt,
    }
  }

  private readSessionAccessToken(sessionId: string): string | null {
    try {
      return typeof window === 'undefined' ? null : window.sessionStorage.getItem(`${SESSION_ACCESS_PREFIX}${sessionId}`)
    } catch {
      return null
    }
  }

  private writeSessionAccessToken(sessionId: string, accessToken: string): void {
    try {
      if (typeof window !== 'undefined') window.sessionStorage.setItem(`${SESSION_ACCESS_PREFIX}${sessionId}`, accessToken)
    } catch {
      throw new RepositoryError('לא הצלחנו לשמור את הרשאת הניסיון בדפדפן.', 'unknown')
    }
  }
}
