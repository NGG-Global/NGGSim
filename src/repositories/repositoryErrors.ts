export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code: 'configuration' | 'authentication' | 'forbidden' | 'not_found' | 'conflict' | 'network' | 'unknown',
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}

interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string
}

export function toRepositoryError(error: unknown, fallback = 'לא הצלחנו להשלים את הפעולה. נסו שוב.'): RepositoryError {
  if (error instanceof RepositoryError) return error
  const candidate = error as SupabaseLikeError | null
  const code = candidate?.code ?? ''
  const message = candidate?.message?.toLowerCase() ?? ''

  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return new RepositoryError('אין הרשאה לבצע את הפעולה בסביבת העבודה הזו.', 'forbidden', error)
  }
  if (code === '23505') {
    return new RepositoryError('הנתון כבר קיים. רעננו את המסך ונסו שוב.', 'conflict', error)
  }
  if (code === 'PGRST116' || code === 'PGRST204') {
    return new RepositoryError('הפריט המבוקש לא נמצא.', 'not_found', error)
  }
  if (message.includes('jwt') || message.includes('not authenticated') || message.includes('auth session missing')) {
    return new RepositoryError('ההתחברות פגה. התחברו מחדש ונסו שוב.', 'authentication', error)
  }
  if (message.includes('failed to fetch') || message.includes('network') || error instanceof TypeError) {
    return new RepositoryError('לא הצלחנו להתחבר לשרת. בדקו את החיבור ונסו שוב.', 'network', error)
  }
  return new RepositoryError(fallback, 'unknown', error)
}

