interface SupabaseAuthErrorLike {
  code?: string
  message?: string
  status?: number
}

export function getFriendlyAuthError(error: SupabaseAuthErrorLike | null | undefined): string {
  if (!error) return 'אירעה שגיאה לא צפויה בתהליך ההתחברות.'

  switch (error.code) {
    case 'over_email_send_rate_limit':
      return 'נשלחו יותר מדי קישורים בזמן קצר. המתינו כדקה ונסו שוב.'
    case 'otp_disabled':
      return 'התחברות בקישור חד־פעמי אינה מופעלת כרגע. יש לפנות למנהל המערכת.'
    case 'otp_expired':
      return 'קישור ההתחברות פג או שכבר נעשה בו שימוש. בקשו קישור חדש.'
    case 'email_not_confirmed':
      return 'יש לאמת את כתובת האימייל לפני ההתחברות. פנו למנהל המערכת.'
    case 'access_denied':
    case 'invalid_credentials':
      return 'האימייל או הסיסמה שגויים, או שהכתובת אינה מורשית למערכת.'
    default:
      if (error.status === 429) return 'נשלחו יותר מדי בקשות. המתינו מעט ונסו שוב.'
      if (error.message?.toLowerCase().includes('fetch')) {
        return 'לא הצלחנו להתחבר לשירות ההזדהות. בדקו את החיבור לרשת ונסו שוב.'
      }
      return 'לא הצלחנו להשלים את ההתחברות. נסו שוב או פנו למנהל המערכת.'
  }
}

export function getRedirectAuthError(search: string, hash: string): string | null {
  const queryParams = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const code = queryParams.get('error_code') ?? hashParams.get('error_code') ?? undefined
  const description = queryParams.get('error_description') ?? hashParams.get('error_description') ?? undefined
  const error = queryParams.get('error') ?? hashParams.get('error') ?? undefined

  if (!code && !description && !error) return null
  return getFriendlyAuthError({ code: code ?? error, message: description })
}
