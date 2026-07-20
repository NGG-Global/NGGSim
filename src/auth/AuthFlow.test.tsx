// @vitest-environment jsdom
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { DEMO_PUBLISHED_TOKEN } from '../data/demoData'
import { LocalSimulationRepository, resetDemoStorage } from '../repositories/localSimulationRepository'
import { SimulationRepositoryProvider } from '../repositories/SimulationRepositoryProvider'
import { AuthProvider, type AuthClient } from './AuthProvider'
import { sanitizeAdminReturnTo } from './redirects'

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

const mountedRoots: Root[] = []
const testRepository = new LocalSimulationRepository()

interface FakeAuthClient {
  client: AuthClient
  getSession: ReturnType<typeof vi.fn>
  getClaims: ReturnType<typeof vi.fn>
  signInWithPassword: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  emit: (event: AuthChangeEvent, session: Session | null) => void
}

function createSession(): Session {
  const user = {
    id: 'facilitator-test-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'facilitator@example.test',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: '2026-07-19T08:00:00.000Z',
  } as User

  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  }
}

function createFakeAuthClient(initialSession: Session | null, holdInitialCheck = false, holdClaimsCheck = false): FakeAuthClient {
  let session = initialSession
  const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>()
  const getSession = vi.fn(() => holdInitialCheck
    ? new Promise<never>(() => undefined)
    : Promise.resolve({ data: { session }, error: null }))
  const getClaims = vi.fn(() => holdClaimsCheck
    ? new Promise<never>(() => undefined)
    : Promise.resolve({ data: { claims: { sub: session?.user.id } }, error: null }))
  const signInWithPassword = vi.fn(async () => {
    session = createSession()
    listeners.forEach((listener) => listener('SIGNED_IN', session))
    return { data: { session, user: session.user }, error: null }
  })
  const signOut = vi.fn(async () => {
    session = null
    listeners.forEach((listener) => listener('SIGNED_OUT', null))
    return { error: null }
  })

  const client = {
    auth: {
      getSession,
      getClaims,
      signInWithPassword,
      signOut,
      onAuthStateChange: vi.fn((listener: (event: AuthChangeEvent, session: Session | null) => void) => {
        listeners.add(listener)
        return {
          data: {
            subscription: {
              id: 'test-subscription',
              callback: listener,
              unsubscribe: () => listeners.delete(listener),
            },
          },
        }
      }),
    },
  } as unknown as AuthClient

  return {
    client,
    getSession,
    getClaims,
    signInWithPassword,
    signOut,
    emit: (event, nextSession) => {
      session = nextSession
      listeners.forEach((listener) => listener(event, nextSession))
    },
  }
}

async function renderPath(path: string, client: AuthClient) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider client={client}>
          <SimulationRepositoryProvider repository={testRepository}>
            <App />
          </SimulationRepositoryProvider>
        </AuthProvider>
      </MemoryRouter>,
    )
  })

  return { container, root }
}

async function waitForText(container: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (container.textContent?.includes(text)) return
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
  }
  throw new Error(`לא נמצא הטקסט בבדיקה: ${text}`)
}

beforeEach(() => {
  window.localStorage.clear()
  resetDemoStorage()
})

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop()
    if (root) await act(async () => root.unmount())
  }
  document.body.innerHTML = ''
})

describe('Supabase facilitator auth flow', () => {
  it('redirects an unauthenticated user to the Hebrew login page', async () => {
    const fake = createFakeAuthClient(null)
    const { container } = await renderPath('/admin/simulations/new', fake.client)

    await waitForText(container, 'כניסה למרחב המנחים')
    expect(container.textContent).not.toContain('יצירת סימולציה חדשה')
  })

  it('allows an authenticated user to enter admin', async () => {
    const fake = createFakeAuthClient(createSession())
    const { container } = await renderPath('/admin', fake.client)

    await waitForText(container, 'סימולציות ניהוליות')
    expect(container.textContent).toContain('facilitator@example.test')
  })

  it('does not reveal admin while a persisted session is still being validated', async () => {
    const fake = createFakeAuthClient(createSession(), false, true)
    const { container } = await renderPath('/admin', fake.client)

    expect(container.textContent).toContain('בודקים את מצב ההתחברות')
    expect(container.textContent).not.toContain('סימולציות ניהוליות')
  })

  it('blocks admin again after logout', async () => {
    const fake = createFakeAuthClient(createSession())
    const { container } = await renderPath('/admin', fake.client)
    await waitForText(container, 'סימולציות ניהוליות')

    const logoutButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('התנתקות'))
    expect(logoutButton).toBeDefined()

    await act(async () => logoutButton?.click())
    await waitForText(container, 'כניסה למרחב המנחים')
    expect(fake.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(container.textContent).not.toContain('סימולציות ניהוליות')
  })

  it('shows a friendly message when an existing session expires', async () => {
    const fake = createFakeAuthClient(createSession())
    const { container } = await renderPath('/admin', fake.client)
    await waitForText(container, 'סימולציות ניהוליות')

    await act(async () => fake.emit('SIGNED_OUT', null))
    await waitForText(container, 'פג תוקף ההתחברות')
    expect(container.textContent).toContain('להתחבר מחדש')
  })

  it('keeps the participant link public while auth is still being checked', async () => {
    const fake = createFakeAuthClient(null, true)
    const { container } = await renderPath(`/simulation/${DEMO_PUBLISHED_TOKEN}`, fake.client)

    await waitForText(container, 'שיחת משוב ממוקדת עם נועם')
    expect(container.textContent).not.toContain('כניסה למרחב המנחים')
  })

  it('restores a valid persisted session after a browser refresh', async () => {
    const fake = createFakeAuthClient(createSession())
    const firstRender = await renderPath('/admin', fake.client)
    await waitForText(firstRender.container, 'סימולציות ניהוליות')

    await act(async () => firstRender.root.unmount())
    mountedRoots.splice(mountedRoots.indexOf(firstRender.root), 1)
    firstRender.container.remove()

    const secondRender = await renderPath('/admin', fake.client)
    await waitForText(secondRender.container, 'סימולציות ניהוליות')
    expect(fake.getSession).toHaveBeenCalledTimes(2)
    expect(fake.getClaims).toHaveBeenCalledTimes(2)
  })

  it('signs in with email and password and enters the requested admin route', async () => {
    const fake = createFakeAuthClient(null)
    const { container } = await renderPath('/login?returnTo=%2Fadmin', fake.client)
    await waitForText(container, 'כניסה למרחב המנחים')

    const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]')
    const passwordInput = container.querySelector<HTMLInputElement>('input[type="password"]')
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    expect(emailInput).not.toBeNull()
    expect(passwordInput).not.toBeNull()
    expect(inputSetter).toBeDefined()

    await act(async () => {
      inputSetter?.call(emailInput, 'facilitator@example.test')
      emailInput?.dispatchEvent(new Event('input', { bubbles: true }))
      inputSetter?.call(passwordInput, 'pilot-password')
      passwordInput?.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const form = container.querySelector('form')
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    await waitForText(container, 'סימולציות ניהוליות')
    expect(fake.signInWithPassword).toHaveBeenCalledWith({
      email: 'facilitator@example.test',
      password: 'pilot-password',
    })
  })

  it('rejects external return URLs', () => {
    expect(sanitizeAdminReturnTo('https://evil.example/admin')).toBe('/admin')
    expect(sanitizeAdminReturnTo('//evil.example/admin')).toBe('/admin')
    expect(sanitizeAdminReturnTo('/simulation/public-token')).toBe('/admin')
  })
})
