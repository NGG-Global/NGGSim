import { ANALYSIS_CRITERIA_IDS } from './analysisCriteria'
import type { ParticipantField, Simulation } from '../types/simulation'

export const participantFieldDefaults: ParticipantField[] = [
  { id: 'field-full-name', type: 'fullName', label: 'שם מלא', enabled: true, required: true },
  { id: 'field-email', type: 'email', label: 'כתובת אימייל', enabled: false, required: false },
  { id: 'field-employee', type: 'employeeId', label: 'מספר עובד', enabled: false, required: false },
  { id: 'field-role', type: 'role', label: 'תפקיד', enabled: true, required: false },
  { id: 'field-department', type: 'department', label: 'מחלקה', enabled: false, required: false },
  { id: 'field-cohort', type: 'cohort', label: 'קבוצה או מחזור', enabled: false, required: false },
  { id: 'field-custom', type: 'custom', label: 'שדה מותאם אישית', enabled: false, required: false },
]

export function createBlankSimulation(id: string): Simulation {
  const now = new Date().toISOString()
  return {
    id,
    publicToken: null,
    shareLink: null,
    status: 'draft',
    title: '',
    organization: {
      clientName: '',
      programName: '',
      audience: '',
      context: '',
      showOrganizationToParticipant: true,
    },
    facilitatorConfiguration: {
      internalNotes: '',
      futureAgentPrompt: '',
    },
    scenario: {
      conversationType: 'שיחת משוב',
      description: '',
      priorEvents: '',
      participantKnownInfo: '',
      hiddenInfo: '',
    },
    participantBrief: {
      title: '',
      shortDescription: '',
      participantRole: '',
      situationDescription: '',
      conversationGoal: '',
      allowedInformation: '',
      estimatedMinutes: 8,
      technicalInstructions: 'מומלץ להיכנס ממקום שקט. בשלב ההדגמה אין צורך לאפשר גישה למיקרופון.',
      consentText: 'קראתי את התדריך ואני מוכן/ה להתחיל את הסימולציה.',
      showFeedback: true,
      allowRetry: true,
    },
    participantFields: participantFieldDefaults.map((field) => ({ ...field })),
    character: {
      name: '',
      role: '',
      relationToParticipant: '',
      personalityTraits: [],
      initialEmotionalState: '',
      interests: '',
      motivations: '',
      objections: '',
      sensitivities: '',
      freelySharedInfo: '',
      conditionalInfo: '',
      speakingStyle: '',
      avoidedBehaviors: '',
      voiceGender: 'female',
    },
    behavior: {
      difficulty: 'בינוני',
      resistance: 'בינונית',
      canCalmDown: true,
      openingTriggers: '',
      escalationTriggers: '',
      successConditions: '',
      failureConditions: '',
      openingLine: '',
      endingConditions: '',
    },
    learningObjectives: [],
    analysisCriteria: [...ANALYSIS_CRITERIA_IDS],
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    attemptCount: 0,
  }
}
