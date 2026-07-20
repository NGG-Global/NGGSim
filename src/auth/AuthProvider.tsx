import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabaseClient, supabaseConfiguration } from '../services/supabaseClient'
import { getFriendlyAuthError } from './authErrors'

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous'

export type AuthClient = Pick<SupabaseClient, 'auth'>

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  notice: string | null
  error: string | null
  isConfigured: boolean
  configurationMessage: string
  signInWithPassword: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearMessages: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  client?: AuthClient | null
}

export function AuthProvider({ children, client }: AuthProviderProps) {
  const resolvedClient = client === undefined ? supabaseClient : client
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [session, setSession] = useState<Session | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hadSession = useRef(false)
  const explicitLogout = useRef(false)

  useEffect(() => {
    if (!resolvedClient) {
      setSession(null)
      setStatus('anonymous')
      return
    }

    let active = true
    const applySession = (nextSession: Session | null) => {
      if (!active) return
      const facilitatorSession = nextSession && !nextSession.user.is_anonymous ? nextSession : null
      setSession(facilitatorSession)
      setStatus(facilitatorSession ? 'authenticated' : 'anonymous')
      if (facilitatorSession) {
        hadSession.current = true
        setNotice(null)
        setError(null)
      }
    }

    const {
      data: { subscription },
    } = resolvedClient.auth.onAuthStateChange((event, nextSession) => {
      // INITIAL_SESSION may originate in browser storage. Keep the route in its
      // loading state until getClaims validates it below.
      if (event === 'INITIAL_SESSION') return

      if (nextSession) {
        applySession(nextSession)
        return
      }

      if (event === 'SIGNED_OUT') {
        applySession(null)
        setNotice(
          explicitLogout.current
            ? 'התנתקת בהצלחה.'
            : hadSession.current
              ? 'פג תוקף ההתחברות. כדי להמשיך יש להתחבר מחדש.'
              : null,
        )
        explicitLogout.current = false
        hadSession.current = false
      }
    })

    void (async () => {
      const { data, error: sessionError } = await resolvedClient.auth.getSession()
      if (!active) return
      if (sessionError || !data.session) {
        setSession(null)
        setStatus('anonymous')
        if (sessionError) setError(getFriendlyAuthError(sessionError))
        return
      }

      if (data.session.user.is_anonymous) {
        applySession(null)
        return
      }

      const { data: claimsData, error: claimsError } = await resolvedClient.auth.getClaims(data.session.access_token)
      if (!active) return
      if (claimsError || !claimsData || claimsData.claims.sub !== data.session.user.id) {
        setSession(null)
        setStatus('anonymous')
        setNotice('פג תוקף ההתחברות. כדי להמשיך יש להתחבר מחדש.')
        return
      }

      applySession(data.session)
    })()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [resolvedClient])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    user: session?.user ?? null,
    notice,
    error,
    isConfigured: resolvedClient !== null,
    configurationMessage: supabaseConfiguration.message,
    signInWithPassword: async (email, password) => {
      setError(null)
      setNotice(null)
      if (!resolvedClient) throw new Error(supabaseConfiguration.message)

      const { error: signInError } = await resolvedClient.auth.signInWithPassword({ email, password })
      if (signInError) {
        const friendlyError = getFriendlyAuthError(signInError)
        setError(friendlyError)
        throw new Error(friendlyError)
      }
    },
    logout: async () => {
      setError(null)
      setNotice(null)
      if (!resolvedClient) {
        setSession(null)
        setStatus('anonymous')
        return
      }

      explicitLogout.current = true
      const { error: logoutError } = await resolvedClient.auth.signOut({ scope: 'local' })
      if (logoutError) {
        explicitLogout.current = false
        const friendlyError = getFriendlyAuthError(logoutError)
        setError(friendlyError)
        throw new Error(friendlyError)
      }

      setSession(null)
      setStatus('anonymous')
      setNotice('התנתקת בהצלחה.')
      hadSession.current = false
    },
    clearMessages: () => {
      setNotice(null)
      setError(null)
    },
  }), [error, notice, resolvedClient, session, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth חייב להיקרא בתוך AuthProvider.')
  return context
}
