import type {
  Participant,
  ShareLink,
  Simulation,
  SimulationReport,
  SimulationRepository,
  SimulationSession,
} from '../types/simulation'

/**
 * גבול ההחלפה בין אחסון demo מקומי לבין Supabase.
 * שני המימושים אסינכרוניים ומממשים את אותו חוזה.
 */
export type SimulationPersistencePort = SimulationRepository

/** שמות הישויות המתאימות לטבלאות Supabase; המיפוי בפועל מפורש בקובצי ה־mapper. */
export interface FutureSupabaseTables {
  facilitators: Array<{ id: string; email: string; createdAt: string }>
  simulations: Simulation[]
  simulation_share_links: ShareLink[]
  participants: Participant[]
  simulation_sessions: SimulationSession[]
  simulation_reports: SimulationReport[]
}

export const futureTableNames: Array<keyof FutureSupabaseTables> = [
  'facilitators',
  'simulations',
  'simulation_share_links',
  'participants',
  'simulation_sessions',
  'simulation_reports',
]
