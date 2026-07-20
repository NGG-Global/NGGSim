import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render-time crashes so the app shows a readable message instead of a
 * blank white screen. The message is surfaced on screen (RTL, Hebrew) to make
 * diagnosis possible on devices without dev tools.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep a console trace for environments that do have dev tools.
    console.error('Application error:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main dir="rtl" lang="he" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem', fontFamily: 'system-ui, sans-serif', background: '#f4f4f6',
      }}>
        <section role="alert" style={{
          maxWidth: '36rem', width: '100%', padding: '2rem', borderRadius: '1rem',
          border: '1px solid #f0c2c2', background: '#fdf3f3', color: '#7a1f1f', lineHeight: 1.7,
        }}>
          <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>אירעה שגיאה במסך</h1>
          <p style={{ margin: '0 0 1rem' }}>
            משהו נכשל בטעינת המסך. אפשר לרענן ולנסות שוב. אם הבעיה חוזרת, יש להעביר את פרטי השגיאה שלמטה.
          </p>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', direction: 'ltr', textAlign: 'left',
            background: '#fff', border: '1px solid #f0c2c2', borderRadius: '0.5rem',
            padding: '0.75rem', fontSize: '0.8rem', margin: '0 0 1rem',
          }}>{error.name}: {error.message}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{
            padding: '0.6rem 1.2rem', borderRadius: '0.5rem', border: 'none',
            background: '#7a1f1f', color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>רענון הדף</button>
        </section>
      </main>
    )
  }
}
