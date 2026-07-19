import { describe, expect, it } from 'vitest'
import { inspectSupabaseConfiguration } from './supabaseClient'

describe('inspectSupabaseConfiguration', () => {
  it('keeps demo mode active and explains which public variables are missing', () => {
    const result = inspectSupabaseConfiguration({})

    expect(result.isConfigured).toBe(false)
    expect(result.missingVariables).toEqual([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ])
    expect(result.message).toContain('מצב המשתתף המקומי נשאר פעיל')
    expect(result.message).toContain('VITE_SUPABASE_URL')
    expect(result.message).toContain('VITE_SUPABASE_PUBLISHABLE_KEY')
  })

  it('reports only the variable whose value is empty', () => {
    const result = inspectSupabaseConfiguration({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: '   ',
    })

    expect(result.isConfigured).toBe(false)
    expect(result.missingVariables).toEqual(['VITE_SUPABASE_PUBLISHABLE_KEY'])
  })

  it('accepts and trims a complete public browser configuration', () => {
    const result = inspectSupabaseConfiguration({
      VITE_SUPABASE_URL: '  https://project.supabase.co  ',
      VITE_SUPABASE_PUBLISHABLE_KEY: '  sb_publishable_example  ',
    })

    expect(result).toMatchObject({
      isConfigured: true,
      missingVariables: [],
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_example',
    })
  })
})
