import type { ParticipantSimulationView, Simulation } from '../types/simulation'

/**
 * מיפוי allowlist בלבד. אין להוסיף לכאן מידע פנימי של מנחה, דמות או הערכה.
 */
export function toParticipantSimulationView(simulation: Simulation): ParticipantSimulationView {
  const organizationLabel = simulation.organization.showOrganizationToParticipant
    ? simulation.organization.programName || simulation.organization.clientName || undefined
    : undefined

  return {
    publicToken: simulation.publicToken ?? '',
    title: simulation.title,
    organizationLabel,
    participantBrief: { ...simulation.participantBrief },
    participantFields: simulation.participantFields
      .filter((field) => field.enabled)
      .map((field) => ({ ...field })),
    character: {
      name: simulation.character.name,
      role: simulation.character.role,
    },
    scenarioSummary: simulation.participantBrief.situationDescription,
    // Client branding is intentionally shown to the participant.
    accentColor: simulation.organization.accentColor || undefined,
    logo: simulation.organization.logo || undefined,
  }
}
