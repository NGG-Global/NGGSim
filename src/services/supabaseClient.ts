import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_ENVIRONMENT_VARIABLES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
] as const

export type SupabaseEnvironmentVariable = (typeof SUPABASE_ENVIRONMENT_VARIABLES)[number]

export type SupabaseBrowserEnvironment = Partial<Record<SupabaseEnvironmentVariable, string | undefined>>

export interface SupabaseConfiguration {
  isConfigured: boolean
  missingVariables: SupabaseEnvironmentVariable[]
  url: string | null
  publishableKey: string | null
  message: string
}

function formatVariableList(variables: SupabaseEnvironmentVariable[]) {
  return variables.join(' ו־')
}

export function inspectSupabaseConfiguration(environment: SupabaseBrowserEnvironment): SupabaseConfiguration {
  const url = environment.VITE_SUPABASE_URL?.trim() || null
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || null
  const missingVariables = SUPABASE_ENVIRONMENT_VARIABLES.filter((variable) => !environment[variable]?.trim())

  if (missingVariables.length > 0) {
    return {
      isConfigured: false,
      missingVariables,
      url,
      publishableKey,
      message: `מצב המשתתף המקומי נשאר פעיל. כדי להפעיל כניסת מנחים יש להגדיר את ${formatVariableList(missingVariables)} בקובץ .env.local. משתני VITE הם ציבוריים; אין להוסיף אליהם מפתח secret או service-role.`,
    }
  }

  return {
    isConfigured: true,
    missingVariables: [],
    url,
    publishableKey,
    message: 'הגדרות Supabase הציבוריות זמינות.',
  }
}

const browserEnvironment: SupabaseBrowserEnvironment = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
}

export const supabaseConfiguration = inspectSupabaseConfiguration(browserEnvironment)

export const supabaseClient: SupabaseClient | null =
  supabaseConfiguration.isConfigured && supabaseConfiguration.url && supabaseConfiguration.publishableKey
    ? createClient(supabaseConfiguration.url, supabaseConfiguration.publishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null
