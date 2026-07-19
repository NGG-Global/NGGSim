import type {
  Participant,
  ShareLink,
  Simulation,
  SimulationReport,
  SimulationRepository,
  SimulationSession,
} from '../types/simulation'

/**
 * גבול ההחלפה בין אחסון מקומי לבין backend עתידי.
 * מימוש Supabase עתידי יממש את אותו חוזה שה־localStorage מממש כיום.
 */
export type SimulationPersistencePort = SimulationRepository

/** מיפוי רעיוני בלבד לטבלאות העתידיות; אין כאן חיבור רשת. */
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
