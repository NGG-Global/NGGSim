import { createContext, useContext, type ReactNode } from 'react'
import type { SimulationRepository } from '../types/simulation'
import { simulationRepository } from './simulationRepositoryFactory'

const SimulationRepositoryContext = createContext<SimulationRepository | null>(null)

export function SimulationRepositoryProvider({
  children,
  repository = simulationRepository,
}: {
  children: ReactNode
  repository?: SimulationRepository
}) {
  return (
    <SimulationRepositoryContext.Provider value={repository}>
      {children}
    </SimulationRepositoryContext.Provider>
  )
}

export function useSimulationRepository(): SimulationRepository {
  const repository = useContext(SimulationRepositoryContext)
  if (!repository) throw new Error('SimulationRepositoryProvider is missing.')
  return repository
}

