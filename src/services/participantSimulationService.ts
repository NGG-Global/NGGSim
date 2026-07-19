import type { PublicSimulationResult, SimulationRepository, SimulationSession } from '../types/simulation'
export { toParticipantSimulationView } from './participantSimulationMapper'

export function getParticipantSimulationByToken(
  repository: SimulationRepository,
  publicToken: string,
): Promise<PublicSimulationResult> {
  return repository.lookupPublicToken(publicToken)
}

export function startParticipantSession(
  repository: SimulationRepository,
  publicToken: string,
  details: Record<string, string>,
  idempotencyKey?: string,
): Promise<SimulationSession> {
  return repository.createSession(publicToken, details, idempotencyKey)
}
