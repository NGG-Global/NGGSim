import type { SupabaseClient } from '@supabase/supabase-js'
import type { SimulationRepository } from '../types/simulation'
import { supabaseClient, supabaseConfiguration } from '../services/supabaseClient'
import { LocalSimulationRepository } from './localSimulationRepository'
import { SupabaseSimulationRepository } from './supabaseSimulationRepository'

export type SimulationDataProvider = 'local' | 'supabase'

export interface DataProviderEnvironment {
  VITE_DATA_PROVIDER?: string
}

export function inspectDataProvider(environment: DataProviderEnvironment): SimulationDataProvider {
  return environment.VITE_DATA_PROVIDER?.trim().toLowerCase() === 'supabase' ? 'supabase' : 'local'
}

export function createSimulationRepository(options: {
  provider?: SimulationDataProvider
  client?: SupabaseClient | null
  baseUrl?: string
} = {}): SimulationRepository {
  const provider = options.provider ?? inspectDataProvider({ VITE_DATA_PROVIDER: import.meta.env.VITE_DATA_PROVIDER })
  if (provider === 'supabase') {
    return new SupabaseSimulationRepository(
      options.client === undefined ? supabaseClient : options.client,
      options.baseUrl,
    )
  }
  return new LocalSimulationRepository()
}

export const configuredDataProvider = inspectDataProvider({ VITE_DATA_PROVIDER: import.meta.env.VITE_DATA_PROVIDER })
export const simulationRepository = createSimulationRepository({
  provider: configuredDataProvider,
  client: supabaseConfiguration.isConfigured ? supabaseClient : null,
})
