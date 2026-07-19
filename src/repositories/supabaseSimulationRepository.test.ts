// @vitest-environment jsdom
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlankSimulation } from '../data/defaults'
import { RepositoryError } from './repositoryErrors'
import { SupabaseSimulationRepository } from './supabaseSimulationRepository'
import {
  mapParticipantSimulationRpc,
  mapSimulationRow,
  type SessionRow,
  type ShareLinkRow,
  type SimulationRow,
} from './supabaseSimulationMappers'

interface FakeResponse {
  data: unknown
  error: { code?: string; message: string } | null
  count?: number | null
}

interface FakeCall {
  source: 'table' | 'rpc'
  name: string
  operation: string
  values?: unknown
  filters?: Array<[string, unknown]>
  args?: Record<string, unknown>
}

function success(data: unknown, count?: number): FakeResponse {
  return { data, error: null, ...(count === undefined ? {} : { count }) }
}

function createFakeClient(script: Record<string, FakeResponse[]>) {
  const queues = new Map(Object.entries(script).map(([key, value]) => [key, [...value]]))
  const calls: FakeCall[] = []

  const next = (key: string): FakeResponse => {
    const queue = queues.get(key)
    if (!queue?.length) throw new Error(`Missing fake response for ${key}`)
    return queue.shift()!
  }

  const from = vi.fn((table: string) => {
    let operation = 'select'
    let values: unknown
    const filters: Array<[string, unknown]> = []
    const builder: Record<string, unknown> & PromiseLike<FakeResponse> = {
      select: vi.fn(() => builder),
      insert: vi.fn((input: unknown) => { operation = 'insert'; values = input; return builder }),
      update: vi.fn((input: unknown) => { operation = 'update'; values = input; return builder }),
      eq: vi.fn((column: string, value: unknown) => { filters.push([`eq:${column}`, value]); return builder }),
      is: vi.fn((column: string, value: unknown) => { filters.push([`is:${column}`, value]); return builder }),
      in: vi.fn((column: string, value: unknown) => { filters.push([`in:${column}`, value]); return builder }),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(async () => execute()),
      maybeSingle: vi.fn(async () => execute()),
      then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject),
    }
    const execute = () => {
      calls.push({ source: 'table', name: table, operation, values, filters: [...filters] })
      return next(`${table}:${operation}`)
    }
    return builder
  })

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push({ source: 'rpc', name, operation: 'rpc', args })
    return next(`rpc:${name}`)
  })

  const client = {
    from,
    rpc,
    auth: {
      getClaims: vi.fn(async () => success({ claims: { sub: 'facilitator-a', is_anonymous: false } })),
    },
  } as unknown as SupabaseClient

  return { client, calls }
}

function simulationRow(overrides: Partial<SimulationRow> = {}): SimulationRow {
  const simulation = createBlankSimulation('11111111-1111-4111-8111-111111111111')
  return {
    id: simulation.id,
    owner_id: 'facilitator-a',
    status: 'draft',
    title: 'שיחה ממסד הנתונים',
    organization: { ...simulation.organization, clientName: 'ארגון בדיקה' },
    scenario: simulation.scenario,
    character: simulation.character,
    behavior: simulation.behavior,
    participant_brief: simulation.participantBrief,
    participant_fields: simulation.participantFields,
    facilitator_configuration: simulation.facilitatorConfiguration,
    learning_objectives: simulation.learningObjectives,
    version: 1,
    published_at: null,
    deleted_at: null,
    created_at: '2026-07-19T08:00:00.000Z',
    updated_at: '2026-07-19T09:00:00.000Z',
    ...overrides,
  }
}

function publishableRow(overrides: Partial<SimulationRow> = {}): SimulationRow {
  const base = simulationRow()
  const defaults = createBlankSimulation(base.id)
  return {
    ...base,
    title: 'סימולציה מוכנה לפרסום',
    scenario: { ...defaults.scenario, description: 'תיאור סיטואציה מלא' },
    character: { ...defaults.character, name: 'דמות בדיקה' },
    participant_brief: {
      ...defaults.participantBrief,
      title: 'תדריך',
      shortDescription: 'תיאור קצר',
      participantRole: 'מנהל/ת',
      conversationGoal: 'להגיע להסכמה',
    },
    ...overrides,
  }
}

function shareLinkRow(overrides: Partial<ShareLinkRow> = {}): ShareLinkRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    simulation_id: '11111111-1111-4111-8111-111111111111',
    owner_id: 'facilitator-a',
    token: 'a'.repeat(64),
    status: 'active',
    expires_at: null,
    revoked_at: null,
    created_at: '2026-07-19T09:00:00.000Z',
    ...overrides,
  }
}

function sessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    simulation_id: '11111111-1111-4111-8111-111111111111',
    status: 'in_progress',
    transcript: [],
    duration_seconds: 0,
    conversation_state: 'listening',
    started_at: '2026-07-19T10:00:00.000Z',
    ended_at: null,
    created_at: '2026-07-19T10:00:00.000Z',
    participant: {
      id: '44444444-4444-4444-8444-444444444444',
      simulation_id: '11111111-1111-4111-8111-111111111111',
      details: { fullName: 'משתתפת בדיקה' },
      created_at: '2026-07-19T10:00:00.000Z',
    },
    share_link: { token: 'a'.repeat(64) },
    ...overrides,
  }
}

beforeEach(() => window.sessionStorage.clear())

describe('SupabaseSimulationRepository list/get mapping', () => {
  it('maps snake_case rows explicitly to the existing camelCase domain model', () => {
    const row = simulationRow({ participant_brief: { title: 'תדריך ממופה' } })
    const simulation = mapSimulationRow(row, shareLinkRow(), 3, 'https://pilot.example')

    expect(simulation.participantBrief.title).toBe('תדריך ממופה')
    expect(simulation.publicToken).toBe('a'.repeat(64))
    expect(simulation.shareLink?.url).toBe(`https://pilot.example/simulation/${'a'.repeat(64)}`)
    expect(simulation.attemptCount).toBe(3)
    expect(simulation.updatedAt).toBe(row.updated_at)
  })

  it('allowlists the public RPC response even if unexpected internal keys are present', () => {
    const publicView = mapParticipantSimulationRpc({
      publicToken: 'token',
      title: 'כותרת',
      participantBrief: { title: 'תדריך', showFeedback: true },
      participantFields: [],
      character: { name: 'דמות', role: 'תפקיד', conditionalInfo: 'אסור' },
      scenarioSummary: 'סיכום',
      hiddenInfo: 'אסור',
      learningObjectives: ['אסור'],
    })

    expect(publicView.character).toEqual({ name: 'דמות', role: 'תפקיד' })
    expect(publicView).not.toHaveProperty('hiddenInfo')
    expect(publicView).not.toHaveProperty('learningObjectives')
    expect(publicView.character).not.toHaveProperty('conditionalInfo')
  })

  it('returns an empty workspace without demo seed when the shared database has no rows', async () => {
    const fake = createFakeClient({ 'simulations:select': [success([])] })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    await expect(repository.list()).resolves.toEqual([])
    expect(fake.calls).toEqual([
      expect.objectContaining({ source: 'table', name: 'simulations', operation: 'select' }),
    ])
  })

  it('loads simulations from multiple creators in the shared admin workspace', async () => {
    const row = simulationRow()
    const otherAdminRow = simulationRow({
      id: '22222222-2222-4222-8222-222222222223',
      owner_id: 'facilitator-b',
      title: 'סימולציה של אדמין אחר',
    })
    const fake = createFakeClient({
      'simulations:select': [success([row, otherAdminRow])],
      'simulation_share_links:select': [success([shareLinkRow()])],
      'simulation_sessions:select': [success([{ simulation_id: row.id }, { simulation_id: row.id }])],
    })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    const simulations = await repository.list()
    expect(simulations).toHaveLength(2)
    expect(simulations[0]).toMatchObject({ id: row.id, attemptCount: 2, title: row.title })
    expect(simulations[1]).toMatchObject({
      id: otherAdminRow.id,
      attemptCount: 0,
      title: 'סימולציה של אדמין אחר',
    })
  })
})

describe('SupabaseSimulationRepository create/update', () => {
  it('writes owner_id and explicit snake_case fields when creating a draft', async () => {
    const row = simulationRow()
    const fake = createFakeClient({ 'simulations:insert': [success(row)] })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    const created = await repository.create({ title: 'טיוטה חדשה' })
    expect(created.id).toBe(row.id)
    const insert = fake.calls.find((call) => call.operation === 'insert')
    expect(insert?.values).toMatchObject({
      owner_id: 'facilitator-a',
      participant_brief: expect.any(Object),
      facilitator_configuration: expect.any(Object),
    })
    expect(insert?.values).not.toHaveProperty('participantBrief')
    expect(insert?.values).not.toHaveProperty('publicToken')
  })

  it('uses the version as a compare-and-swap guard and reports a conflict instead of overwriting', async () => {
    const row = simulationRow()
    const fake = createFakeClient({
      'simulations:select': [success(row)],
      'simulation_share_links:select': [success(null)],
      'simulation_sessions:select': [success(null, 0)],
      'simulations:update': [success(null)],
    })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    await expect(repository.update(row.id, { title: 'שינוי מתנגש' }))
      .rejects.toEqual(expect.objectContaining<Partial<RepositoryError>>({ code: 'conflict' }))
    const update = fake.calls.find((call) => call.operation === 'update')
    expect(update?.filters).toContainEqual(['eq:version', 1])
    expect(update?.values).toMatchObject({ title: 'שינוי מתנגש', version: 2 })
    expect(update?.values).not.toHaveProperty('owner_id')
  })

  it('updates another admin\'s simulation without changing its creator identity', async () => {
    const row = simulationRow({ owner_id: 'facilitator-b' })
    const updatedRow = simulationRow({
      owner_id: 'facilitator-b',
      title: 'כותרת משותפת מעודכנת',
      version: 2,
    })
    const fake = createFakeClient({
      'simulations:select': [success(row)],
      'simulation_share_links:select': [success(null)],
      'simulation_sessions:select': [success(null, 0)],
      'simulations:update': [success(updatedRow)],
    })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    await expect(repository.update(row.id, { title: updatedRow.title })).resolves.toMatchObject({
      id: row.id,
      title: updatedRow.title,
    })
    const update = fake.calls.find((call) => call.operation === 'update')
    expect(update?.values).not.toHaveProperty('owner_id')
  })
})

describe('SupabaseSimulationRepository publication lifecycle', () => {
  it('publishes through one atomic RPC and returns only the confirmed server state', async () => {
    const draft = publishableRow()
    const published = publishableRow({
      status: 'published',
      published_at: '2026-07-19T11:00:00.000Z',
      version: 2,
      title: 'כותרת שאושרה בשרת',
    })
    const fake = createFakeClient({
      'simulations:select': [success(draft), success(published)],
      'simulation_share_links:select': [success(null), success(shareLinkRow())],
      'simulation_sessions:select': [success(null, 0), success(null, 0)],
      'rpc:publish_simulation': [success({ token: 'a'.repeat(64) })],
    })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    const result = await repository.publish(draft.id)
    expect(result).toMatchObject({ status: 'published', title: 'כותרת שאושרה בשרת', publicToken: 'a'.repeat(64) })
    expect(fake.calls.find((call) => call.name === 'publish_simulation')?.args).toEqual({ p_simulation_id: draft.id })
  })

  it('unpublishes through the atomic RPC and keeps the revoked link visible as inactive', async () => {
    const unpublished = publishableRow({ status: 'unpublished', version: 3 })
    const revoked = shareLinkRow({ status: 'revoked', revoked_at: '2026-07-19T12:00:00.000Z' })
    const fake = createFakeClient({
      'rpc:unpublish_simulation': [success({ status: 'unpublished' })],
      'simulations:select': [success(unpublished)],
      'simulation_share_links:select': [success(revoked)],
      'simulation_sessions:select': [success(null, 0)],
    })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    const result = await repository.unpublish(unpublished.id)
    expect(result.status).toBe('unpublished')
    expect(result.shareLink?.isActive).toBe(false)
    expect(fake.calls.some((call) => call.name === 'unpublish_simulation')).toBe(true)
  })

  it('regenerates a token atomically and does not reuse the old capability', async () => {
    const current = publishableRow({ status: 'published', published_at: '2026-07-19T11:00:00.000Z' })
    const nextToken = 'b'.repeat(64)
    const confirmed = publishableRow({ status: 'published', published_at: current.published_at, version: 2 })
    const fake = createFakeClient({
      'simulations:select': [success(current), success(confirmed)],
      'simulation_share_links:select': [success(shareLinkRow()), success(shareLinkRow({ token: nextToken }))],
      'simulation_sessions:select': [success(null, 0), success(null, 0)],
      'rpc:regenerate_simulation_public_token': [success({ token: nextToken })],
    })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    const result = await repository.regeneratePublicToken(current.id)
    expect(result.publicToken).toBe(nextToken)
    expect(result.publicToken).not.toBe(shareLinkRow().token)
  })
})

describe('SupabaseSimulationRepository duplicate/archive', () => {
  it('duplicates another admin\'s source into a new draft owned by the duplicating admin', async () => {
    const source = publishableRow({
      owner_id: 'facilitator-b',
      status: 'published',
      published_at: '2026-07-19T11:00:00.000Z',
    })
    const copyId = '55555555-5555-4555-8555-555555555555'
    const confirmedCopy = publishableRow({
      id: copyId,
      status: 'draft',
      published_at: null,
      title: `${source.title} — עותק`,
      version: 1,
    })
    const fake = createFakeClient({
      'simulations:select': [success(source)],
      'simulation_share_links:select': [success(shareLinkRow())],
      'simulation_sessions:select': [success(null, 4)],
      'simulations:insert': [success(confirmedCopy)],
    })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    const result = await repository.duplicate(source.id)
    expect(result).toMatchObject({ id: copyId, status: 'draft', publishedAt: null, attemptCount: 0 })
    const insert = fake.calls.find((call) => call.operation === 'insert')
    expect(insert?.values).toMatchObject({
      owner_id: 'facilitator-a',
      status: 'draft',
      title: `${source.title} — עותק`,
      published_at: null,
    })
  })

  it('archives through a soft-delete RPC and never issues a table DELETE', async () => {
    const row = simulationRow()
    const fake = createFakeClient({ 'rpc:archive_simulation': [success({ archived: true })] })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    await repository.remove(row.id)
    expect(fake.calls).toContainEqual(expect.objectContaining({
      source: 'rpc',
      name: 'archive_simulation',
      args: { p_simulation_id: row.id },
    }))
    expect(fake.calls.some((call) => call.operation === 'delete')).toBe(false)
  })
})

describe('SupabaseSimulationRepository sessions/reports', () => {
  it('keeps the public session capability inside the repository and uses it for every participant write', async () => {
    const accessToken = 'c'.repeat(64)
    const initial = sessionRow()
    const progressed = sessionRow({ duration_seconds: 12, conversation_state: 'speaking' })
    const completed = sessionRow({
      status: 'completed',
      duration_seconds: 73,
      ended_at: '2026-07-19T10:02:00.000Z',
    })
    const fake = createFakeClient({
      'rpc:start_public_simulation_session': [success({ accessToken, session: initial })],
      'rpc:get_public_simulation_session': [success(initial)],
      'rpc:update_public_simulation_session': [success(progressed)],
      'rpc:complete_public_simulation_session': [success(completed)],
      'simulation_sessions:select': [success([completed])],
      'simulation_reports:select': [success({
        id: '66666666-6666-4666-8666-666666666666',
        session_id: completed.id,
        summary: 'סיכום מאומת',
        scores: { הקשבה: 88 },
        strengths: ['הקשבה'],
        improvements: ['סיכום'],
      })],
    })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')

    const created = await repository.createSession('a'.repeat(64), { fullName: 'משתתפת בדיקה', ignored: 'מסונן בשרת' })
    expect(created.id).toBe(initial.id)
    expect(window.sessionStorage.length).toBe(1)
    expect(window.sessionStorage.getItem(window.sessionStorage.key(0)!)).toBe(accessToken)

    await repository.getSession(initial.id)
    await repository.updateSessionProgress(initial.id, { durationSeconds: 12, conversationState: 'speaking' })
    const finished = await repository.completeSession(initial.id, 73, [])
    const sessions = await repository.listSessions(initial.simulation_id)
    const report = await repository.getReport(initial.id)

    expect(finished.status).toBe('completed')
    expect(sessions).toHaveLength(1)
    expect(report).toMatchObject({ sessionId: initial.id, summary: 'סיכום מאומת', scores: { הקשבה: 88 } })
    expect(fake.calls.find((call) => call.name === 'update_public_simulation_session')?.args)
      .toMatchObject({ p_session_id: initial.id, p_access_token: accessToken, p_duration_seconds: 12 })
    expect(fake.calls.find((call) => call.name === 'complete_public_simulation_session')?.args)
      .toMatchObject({ p_session_id: initial.id, p_access_token: accessToken, p_duration_seconds: 73 })
  })

  it('fails closed when the public session capability is rejected by the server', async () => {
    const accessToken = 'd'.repeat(64)
    const initial = sessionRow()
    const fake = createFakeClient({
      'rpc:start_public_simulation_session': [success({ accessToken, session: initial })],
      'rpc:update_public_simulation_session': [success(null)],
    })
    const repository = new SupabaseSimulationRepository(fake.client, 'https://pilot.example')
    await repository.createSession('a'.repeat(64), {})

    await expect(repository.updateSessionProgress(initial.id, { durationSeconds: 1 }))
      .rejects.toEqual(expect.objectContaining<Partial<RepositoryError>>({ code: 'forbidden' }))
  })
})

export { createFakeClient, publishableRow, sessionRow, shareLinkRow, simulationRow, success }
