export type SimulationStatus = 'draft' | 'published' | 'unpublished'

export interface OrganizationContext {
  clientName: string
  programName: string
  audience: string
  context: string
  showOrganizationToParticipant: boolean
}

export interface Scenario {
  conversationType: string
  description: string
  priorEvents: string
  participantGoal: string
  participantKnownInfo: string
  hiddenInfo: string
}

export interface Character {
  name: string
  role: string
  relationToParticipant: string
  personalityTraits: string[]
  initialEmotionalState: string
  interests: string
  motivations: string
  objections: string
  sensitivities: string
  freelySharedInfo: string
  conditionalInfo: string
  speakingStyle: string
  avoidedBehaviors: string
}

export interface CharacterBehavior {
  difficulty: 'קל' | 'בינוני' | 'מאתגר'
  resistance: 'נמוכה' | 'בינונית' | 'גבוהה'
  canCalmDown: boolean
  openingTriggers: string
  escalationTriggers: string
  successConditions: string
  failureConditions: string
  recommendedMinutes: number
  openingLine: string
  endingConditions: string
}

export interface ParticipantBrief {
  title: string
  shortDescription: string
  participantRole: string
  situationDescription: string
  conversationGoal: string
  allowedInformation: string
  estimatedMinutes: number
  technicalInstructions: string
  consentText: string
  showFeedback: boolean
  allowRetry: boolean
}

export type ParticipantFieldType =
  | 'fullName'
  | 'email'
  | 'employeeId'
  | 'role'
  | 'department'
  | 'cohort'
  | 'custom'

export interface ParticipantField {
  id: string
  type: ParticipantFieldType
  label: string
  enabled: boolean
  required: boolean
}

export interface EvaluationMetric {
  id: string
  name: string
  successMeasure: string
  visibleToParticipant: boolean
  facilitatorOnly: boolean
}

export interface LearningObjective {
  id: string
  name: string
  description: string
  weight?: number
  metric: EvaluationMetric
}

export interface FacilitatorConfiguration {
  internalNotes: string
  futureAgentPrompt: string
}

export interface ShareLink {
  token: string
  url: string
  createdAt: string
  isActive: boolean
}

export interface Simulation {
  id: string
  publicToken: string | null
  shareLink: ShareLink | null
  status: SimulationStatus
  title: string
  organization: OrganizationContext
  facilitatorConfiguration: FacilitatorConfiguration
  scenario: Scenario
  participantBrief: ParticipantBrief
  participantFields: ParticipantField[]
  character: Character
  behavior: CharacterBehavior
  learningObjectives: LearningObjective[]
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  attemptCount: number
}

export interface Participant {
  id: string
  simulationId: string
  details: Record<string, string>
  createdAt: string
}

export type ConversationState = 'listening' | 'thinking' | 'speaking'

export interface TranscriptEntry {
  id: string
  speaker: 'participant' | 'character'
  text: string
  timestampSeconds: number
}

export interface SimulationSession {
  id: string
  simulationId: string
  publicToken: string
  participant: Participant
  startedAt: string
  endedAt: string | null
  durationSeconds: number
  status: 'in_progress' | 'completed'
  conversationState: ConversationState
  transcript: TranscriptEntry[]
}

export interface SimulationReport {
  id: string
  sessionId: string
  summary: string
  scores: Record<string, number>
  strengths: string[]
  improvements: string[]
}

export interface ParticipantSimulationView {
  publicToken: string
  title: string
  organizationLabel?: string
  participantBrief: ParticipantBrief
  participantFields: ParticipantField[]
  character: Pick<Character, 'name' | 'role'>
  scenarioSummary: string
}

export type PublicUnavailableReason = 'not_found' | 'draft' | 'unpublished' | 'deleted' | 'replaced'

export type PublicSimulationResult =
  | { state: 'available'; simulation: ParticipantSimulationView }
  | { state: 'unavailable'; reason: PublicUnavailableReason }

export interface SimulationRepository {
  list(): Simulation[]
  getById(id: string): Simulation | null
  create(input?: Partial<Simulation>): Simulation
  update(id: string, patch: Partial<Simulation>): Simulation
  publish(id: string): Simulation
  unpublish(id: string): Simulation
  regeneratePublicToken(id: string): Simulation
  duplicate(id: string): Simulation
  remove(id: string): void
  lookupPublicToken(token: string): { simulation: Simulation | null; reason?: PublicUnavailableReason }
  createSession(simulationId: string, token: string, details: Record<string, string>): SimulationSession
  getSession(id: string): SimulationSession | null
  listSessions(simulationId: string): SimulationSession[]
  updateSessionProgress(id: string, patch: Partial<Pick<SimulationSession, 'durationSeconds' | 'conversationState' | 'transcript'>>): SimulationSession
  completeSession(id: string, durationSeconds: number, transcript: TranscriptEntry[]): SimulationSession
  getReport(sessionId: string): SimulationReport | null
}
