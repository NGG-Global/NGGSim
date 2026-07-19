import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { getRedirectAuthError } from '../../auth/authErrors'
import { createLoginPath, sanitizeAdminReturnTo } from '../../auth/redirects'

export function AuthCallbackPage() {
  const { status, error: authError } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = useMemo(() => sanitizeAdminReturnTo(searchParams.get('returnTo')), [searchParams])
  const redirectError = useMemo(
    () => getRedirectAuthError(location.search, location.hash),
    [location.hash, location.search],
  )

  useEffect(() => {
    if (!redirectError && status === 'authenticated') navigate(returnTo, { replace: true })
  }, [navigate, redirectError, returnTo, status])

  if (!redirectError && (status === 'checking' || status === 'authenticated')) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f4f6] p-6" dir="rtl">
        <div role="status" className="rounded-xl border border-[#e5e4e7] bg-white px-8 py-7 text-center shadow-card">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-forest" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold">מאמתים את קישור ההתחברות…</h1>
          <p className="mt-2 text-sm text-[#5a5a5c]">מיד נעביר אותך למרחב המנחים.</p>
        </div>
      </main>
    )
  }

  const visibleError = redirectError ?? authError ?? 'קישור ההתחברות אינו תקין או שפג תוקפו.'
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f4f6] p-6" dir="rtl">
      <div className="max-w-md rounded-xl border border-[#e5e4e7] bg-white p-8 text-center shadow-card">
        <CircleAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">לא הצלחנו להשלים את ההתחברות</h1>
        <p role="alert" className="mt-3 leading-7 text-[#5a5a5c]">{visibleError}</p>
        <Link to={createLoginPath(returnTo)} className="button-link-primary mt-6">בקשת קישור חדש</Link>
      </div>
    </main>
  )
}
