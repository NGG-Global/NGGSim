import { simulationRepository } from '../repositories/localSimulationRepository'
import type { ParticipantSimulationView, PublicSimulationResult, Simulation, SimulationSession } from '../types/simulation'

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
  }
}

export function getParticipantSimulationByToken(publicToken: string): PublicSimulationResult {
  const lookup = simulationRepository.lookupPublicToken(publicToken)
  if (!lookup.simulation) {
    return { state: 'unavailable', reason: lookup.reason ?? 'not_found' }
  }
  return { state: 'available', simulation: toParticipantSimulationView(lookup.simulation) }
}

export function startParticipantSession(publicToken: string, details: Record<string, string>): SimulationSession {
  const lookup = simulationRepository.lookupPublicToken(publicToken)
  if (!lookup.simulation) throw new Error('לא ניתן להתחיל את הסימולציה מהקישור הזה.')
  return simulationRepository.createSession(lookup.simulation.id, publicToken, details)
}
