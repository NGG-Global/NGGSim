export const DEFAULT_ADMIN_PATH = '/admin'

export function sanitizeAdminReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/admin') || value.startsWith('//')) return DEFAULT_ADMIN_PATH

  try {
    const baseUrl = new URL('https://local.invalid')
    const candidate = new URL(value, baseUrl)
    if (candidate.origin !== baseUrl.origin || !candidate.pathname.startsWith('/admin')) {
      return DEFAULT_ADMIN_PATH
    }
    return `${candidate.pathname}${candidate.search}${candidate.hash}`
  } catch {
    return DEFAULT_ADMIN_PATH
  }
}

export function createLoginPath(returnTo: string): string {
  const search = new URLSearchParams({ returnTo: sanitizeAdminReturnTo(returnTo) })
  return `/login?${search.toString()}`
}

export function createAuthCallbackUrl(origin: string, returnTo: string): string {
  const callbackUrl = new URL('/auth/callback', origin)
  callbackUrl.searchParams.set('returnTo', sanitizeAdminReturnTo(returnTo))
  return callbackUrl.toString()
}
