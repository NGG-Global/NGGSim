import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { AuthLoadingScreen } from './AuthLoadingScreen'
import { createLoginPath } from './redirects'

export function ProtectedAdminRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <AuthLoadingScreen />
  if (status === 'authenticated') return <Outlet />

  const returnTo = `${location.pathname}${location.search}${location.hash}`
  return <Navigate to={createLoginPath(returnTo)} replace />
}
