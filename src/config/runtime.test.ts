// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { assertRuntimeConfiguration, resolveAppEnvironment, RuntimeConfigurationError } from './runtime'

describe('runtime configuration guard', () => {
  it('defaults to the development environment for missing or unknown values', () => {
    expect(resolveAppEnvironment(undefined)).toBe('development')
    expect(resolveAppEnvironment('')).toBe('development')
    expect(resolveAppEnvironment('anything-else')).toBe('development')
    expect(resolveAppEnvironment('STAGING')).toBe('staging')
    expect(resolveAppEnvironment('production')).toBe('production')
  })

  it('allows the local provider in development', () => {
    expect(assertRuntimeConfiguration({ VITE_APP_ENV: 'development', VITE_DATA_PROVIDER: 'local' }))
      .toEqual({ appEnvironment: 'development', dataProvider: 'local' })
  })

  it('allows Supabase in staging and production', () => {
    expect(assertRuntimeConfiguration({ VITE_APP_ENV: 'staging', VITE_DATA_PROVIDER: 'supabase' }))
      .toEqual({ appEnvironment: 'staging', dataProvider: 'supabase' })
    expect(assertRuntimeConfiguration({ VITE_APP_ENV: 'production', VITE_DATA_PROVIDER: 'supabase' }))
      .toEqual({ appEnvironment: 'production', dataProvider: 'supabase' })
  })

  it('refuses to boot staging or production on the local provider', () => {
    for (const appEnv of ['staging', 'production'] as const) {
      expect(() => assertRuntimeConfiguration({ VITE_APP_ENV: appEnv, VITE_DATA_PROVIDER: 'local' }))
        .toThrow(RuntimeConfigurationError)
    }
  })

  it('treats an unspecified provider as local and still blocks non-development environments', () => {
    expect(() => assertRuntimeConfiguration({ VITE_APP_ENV: 'production' }))
      .toThrow(RuntimeConfigurationError)
  })
})
