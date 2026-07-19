// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createSimulationRepository, inspectDataProvider } from './simulationRepositoryFactory'

describe('simulationRepositoryFactory', () => {
  it('uses local unless Supabase is selected explicitly', () => {
    expect(inspectDataProvider({})).toBe('local')
    expect(inspectDataProvider({ VITE_DATA_PROVIDER: 'local' })).toBe('local')
    expect(inspectDataProvider({ VITE_DATA_PROVIDER: 'supabase' })).toBe('supabase')
  })

  it('fails closed instead of exposing demo data when Supabase configuration is missing', async () => {
    const repository = createSimulationRepository({ provider: 'supabase', client: null })
    expect(repository.provider).toBe('supabase')
    await expect(repository.list()).rejects.toEqual(expect.objectContaining({ code: 'configuration' }))
  })
})
