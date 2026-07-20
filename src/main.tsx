import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { assertRuntimeConfiguration, RuntimeConfigurationError } from './config/runtime'
import { SimulationRepositoryProvider } from './repositories/SimulationRepositoryProvider'
import './styles/index.css'

const rootElement = document.getElementById('root')!

function renderFatalConfigurationError(message: string): void {
  rootElement.setAttribute('dir', 'rtl')
  rootElement.setAttribute('lang', 'he')
  const notice = document.createElement('div')
  notice.setAttribute('role', 'alert')
  notice.style.cssText =
    'max-width:40rem;margin:15vh auto;padding:2rem;border-radius:1rem;border:1px solid #f0c2c2;background:#fdf3f3;color:#7a1f1f;font-family:system-ui,sans-serif;line-height:1.7;text-align:right'
  const heading = document.createElement('h1')
  heading.textContent = 'תצורת הסביבה אינה חוקית'
  heading.style.cssText = 'margin:0 0 0.75rem;font-size:1.25rem'
  const body = document.createElement('p')
  body.textContent = message
  body.style.cssText = 'margin:0'
  notice.append(heading, body)
  rootElement.replaceChildren(notice)
}

try {
  assertRuntimeConfiguration({
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_DATA_PROVIDER: import.meta.env.VITE_DATA_PROVIDER,
  })

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <SimulationRepositoryProvider>
              <App />
            </SimulationRepositoryProvider>
          </AuthProvider>
        </BrowserRouter>
      </AppErrorBoundary>
    </React.StrictMode>,
  )
} catch (error) {
  if (error instanceof RuntimeConfigurationError) {
    renderFatalConfigurationError(error.message)
  } else {
    throw error
  }
}
