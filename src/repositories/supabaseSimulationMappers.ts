import { ANALYSIS_CRITERIA_IDS } from '../data/analysisCriteria'
import { createBlankSimulation } from '../data/defaults'
import type {
  Character,
  CharacterBehavior,
  FacilitatorConfiguration,
  LearningObjective,
  OrganizationContext,
  Participant,
  ParticipantBrief,
  ParticipantField,
  ParticipantSimulationView,
  Scenario,
  ShareLink,
  Simulation,
  SimulationReport,
  SimulationSession,
  SimulationStatus,
  TranscriptEntry,
} from '../types/simulation'

export interface SimulationRow {
  id: string
  owner_id: string
  status: SimulationStatus
  title: string
  organization: unknown
  scenario: unknown
  character: unknown
  behavior: unknown
  participant_brief: unknown
  participant_fields: unknown
  facilitator_configuration: unknown
  learning_objectives: unknown
  analysis_criteria: unknown
  version: number
  published_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ShareLinkRow {
  id: string
  simulation_id: string
  owner_id: string
  token: string
  status: 'active' | 'revoked' | 'expired'
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface ParticipantRow {
  id: string
  simulation_id: string
  details: unknown
  created_at: string
}

export interface SessionRow {
  id: string
  simulation_id: string
  status: SimulationSession['status']
  transcript: unknown
  duration_seconds: number
  conversation_state?: SimulationSession['conversationState'] | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  participant?: ParticipantRow | ParticipantRow[] | null
  share_link?: Pick<ShareLinkRow, 'token'> | Array<Pick<ShareLinkRow, 'token'>> | null
}

export interface ReportRow {
  id: string
  session_id: string
  summary: string
  scores: unknown
  strengths: string[]
  improvements: string[]
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function publicUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/simulation/${token}`
}

export function mapShareLinkRow(row: ShareLinkRow | null, baseUrl: string): ShareLink | null {
  if (!row) return null
  const activeByTime = !row.expires_at || new Date(row.expires_at).getTime() > Date.now()
  return {
    token: row.token,
    url: publicUrl(row.token, baseUrl),
    createdAt: row.created_at,
    isActive: row.status === 'active' && !row.revoked_at && activeByTime,
  }
}

export function mapSimulationRow(
  row: SimulationRow,
  shareLink: ShareLinkRow | null,
  attemptCount: number,
  baseUrl: string,
): Simulation {
  const defaults = createBlankSimulation(row.id)
  const mappedShareLink = mapShareLinkRow(shareLink, baseUrl)
  return {
    ...defaults,
    id: row.id,
    status: row.status,
    title: row.title,
    organization: { ...defaults.organization, ...record(row.organization) } as OrganizationContext,
    scenario: { ...defaults.scenario, ...record(row.scenario) } as Scenario,
    character: { ...defaults.character, ...record(row.character) } as Character,
    behavior: { ...defaults.behavior, ...record(row.behavior) } as CharacterBehavior,
    participantBrief: { ...defaults.participantBrief, ...record(row.participant_brief) } as ParticipantBrief,
    participantFields: array<ParticipantField>(row.participant_fields),
    facilitatorConfiguration: {
      ...defaults.facilitatorConfiguration,
      ...record(row.facilitator_configuration),
    } as FacilitatorConfiguration,
    learningObjectives: array<LearningObjective>(row.learning_objectives),
    // Empty/absent means "all criteria" (older rows predate this column and the webhook
    // treats empty the same way), so surface that as every criterion selected in the UI.
    analysisCriteria: (() => {
      const stored = array<string>(row.analysis_criteria).filter((id) => typeof id === 'string' && id)
      return stored.length ? stored : [...ANALYSIS_CRITERIA_IDS]
    })(),
    publicToken: mappedShareLink?.token ?? null,
    shareLink: mappedShareLink,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attemptCount,
  }
}

export function simulationToDatabaseFields(simulation: Simulation): Record<string, unknown> {
  return {
    status: simulation.status,
    title: simulation.title,
    organization: simulation.organization,
    scenario: simulation.scenario,
    character: simulation.character,
    behavior: simulation.behavior,
    participant_brief: simulation.participantBrief,
    participant_fields: simulation.participantFields,
    facilitator_configuration: simulation.facilitatorConfiguration,
    learning_objectives: simulation.learningObjectives,
    analysis_criteria: simulation.analysisCriteria,
    published_at: simulation.publishedAt,
  }
}

export function mapParticipantSimulationRpc(value: unknown): ParticipantSimulationView {
  const source = record(value)
  const brief = record(source.participantBrief)
  const character = record(source.character)
  return {
    publicToken: String(source.publicToken ?? ''),
    title: String(source.title ?? ''),
    ...(source.organizationLabel ? { organizationLabel: String(source.organizationLabel) } : {}),
    participantBrief: {
      title: String(brief.title ?? ''),
      shortDescription: String(brief.shortDescription ?? ''),
      participantRole: String(brief.participantRole ?? ''),
      situationDescription: String(brief.situationDescription ?? ''),
      conversationGoal: String(brief.conversationGoal ?? ''),
      allowedInformation: String(brief.allowedInformation ?? ''),
      estimatedMinutes: Number(brief.estimatedMinutes ?? 8),
      technicalInstructions: String(brief.technicalInstructions ?? ''),
      consentText: String(brief.consentText ?? ''),
      showFeedback: brief.showFeedback === true,
      allowRetry: brief.allowRetry === true,
    },
    participantFields: array<ParticipantField>(source.participantFields).map((field) => ({
      id: String(field.id ?? ''),
      type: field.type,
      label: String(field.label ?? ''),
      enabled: true,
      required: field.required === true,
    })),
    character: { name: String(character.name ?? ''), role: String(character.role ?? '') },
    scenarioSummary: String(source.scenarioSummary ?? ''),
    ...(source.accentColor ? { accentColor: String(source.accentColor) } : {}),
    ...(source.logo ? { logo: String(source.logo) } : {}),
  }
}

export function mapSessionRow(row: SessionRow): SimulationSession {
  const participantRow = relation(row.participant)
  const shareLink = relation(row.share_link)
  const participant: Participant = {
    id: participantRow?.id ?? '',
    simulationId: participantRow?.simulation_id ?? row.simulation_id,
    details: record(participantRow?.details) as Record<string, string>,
    createdAt: participantRow?.created_at ?? row.created_at,
  }
  return {
    id: row.id,
    simulationId: row.simulation_id,
    publicToken: shareLink?.token ?? '',
    participant,
    startedAt: row.started_at ?? row.created_at,
    endedAt: row.ended_at,
    durationSeconds: Math.max(0, row.duration_seconds ?? 0),
    status: row.status,
    conversationState: row.conversation_state ?? 'listening',
    transcript: array<TranscriptEntry>(row.transcript),
  }
}

export function mapReportRow(row: ReportRow): SimulationReport {
  const scores = Object.fromEntries(
    Object.entries(record(row.scores)).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  )
  return {
    id: row.id,
    sessionId: row.session_id,
    summary: row.summary,
    scores,
    strengths: array<string>(row.strengths),
    improvements: array<string>(row.improvements),
  }
}

