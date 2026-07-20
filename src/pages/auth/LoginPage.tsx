import { ArrowLeft, KeyRound, LogIn } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLoadingScreen } from '../../auth/AuthLoadingScreen'
import { useAuth } from '../../auth/AuthProvider'
import { sanitizeAdminReturnTo } from '../../auth/redirects'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/FormControls'

export function LoginPage() {
  const { status, notice, error: authError, isConfigured, configurationMessage, signInWithPassword, clearMessages } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = useMemo(() => sanitizeAdminReturnTo(searchParams.get('returnTo')), [searchParams])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') navigate(returnTo, { replace: true })
  }, [navigate, returnTo, status])

  if (status === 'checking' || status === 'authenticated') {
    return <AuthLoadingScreen message={status === 'authenticated' ? 'מעבירים אותך למרחב המנחים…' : undefined} />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    clearMessages()

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setFormError('יש להזין כתובת אימייל.')
      return
    }
    if (!password) {
      setFormError('יש להזין סיסמה.')
      return
    }

    setIsSubmitting(true)
    try {
      await signInWithPassword(normalizedEmail, password)
      // On success the auth state change marks the session authenticated and the
      // effect above redirects to the requested admin route.
    } catch (signInError) {
      setFormError(signInError instanceof Error ? signInError.message : 'לא הצלחנו להשלים את ההתחברות.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const visibleError = formError ?? authError

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(800px_420px_at_80%_-10%,#fdeef6_0%,rgba(253,238,246,0)_68%)] bg-[#f4f4f6] p-4 sm:p-6" dir="rtl">
      <section className="w-full max-w-md rounded-xl border border-[#e5e4e7] bg-white p-6 shadow-card sm:p-8" aria-labelledby="login-title">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#e5e4e7] bg-white">
            <img src="/assets/ngg-mark.png" alt="" className="h-9 w-auto" />
          </span>
          <div>
            <p className="text-xl font-black tracking-tight">שיח</p>
            <p className="text-xs font-bold text-[#7f7e7f]">כניסת מנחים מאובטחת</p>
          </div>
        </div>

        <div className="mt-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#fdeef6] text-[#b01a65]">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 id="login-title" className="mt-4 text-3xl font-black tracking-tight text-ink">כניסה למרחב המנחים</h1>
          <p className="mt-3 leading-7 text-[#5a5a5c]">הזינו את כתובת האימייל והסיסמה שהוקצו לכם לפיילוט.</p>
        </div>

        {!isConfigured && (
          <div role="alert" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            <p className="font-bold">נדרשת הגדרת Supabase</p>
            <p>{configurationMessage}</p>
          </div>
        )}

        {notice && <p role="status" className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">{notice}</p>}
        {visibleError && <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{visibleError}</p>}

        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <TextField
            id="facilitator-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            label="כתובת אימייל"
            placeholder="name@organization.co.il"
            required
            value={email}
            disabled={!isConfigured || isSubmitting}
            onChange={(event) => { setEmail(event.target.value); setFormError(null) }}
          />
          <TextField
            id="facilitator-password"
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            label="סיסמה"
            placeholder="••••••••"
            required
            value={password}
            disabled={!isConfigured || isSubmitting}
            onChange={(event) => { setPassword(event.target.value); setFormError(null) }}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={!isConfigured || isSubmitting}
            icon={isSubmitting ? undefined : <LogIn className="h-5 w-5" aria-hidden="true" />}
          >
            {isSubmitting ? 'מתחברים…' : 'כניסה'}
          </Button>
        </form>

        <p className="mt-6 flex items-start gap-2 border-t border-[#e5e4e7] pt-5 text-xs leading-5 text-[#7f7e7f]">
          <ArrowLeft className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          לאחר ההתחברות נחזיר אותך אוטומטית למסך המנחים שביקשת לפתוח.
        </p>
      </section>
    </main>
  )
}
