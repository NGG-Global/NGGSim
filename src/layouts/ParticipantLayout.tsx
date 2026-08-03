import type { CSSProperties } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { brandingStyle } from '../features/simulations/branding'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { useSimulationRepository } from '../repositories/SimulationRepositoryProvider'
import { getParticipantSimulationByToken } from '../services/participantSimulationService'

export function ParticipantLayout() {
  const { publicToken = '' } = useParams()
  const repository = useSimulationRepository()
  // Fetch just to resolve client branding; the pages load their own view. Missing or
  // unavailable links simply fall back to the NGG defaults.
  const query = useRepositoryQuery(async () => {
    if (!publicToken) return null
    return getParticipantSimulationByToken(repository, publicToken)
  }, [repository, publicToken])
  const view = query.data && query.data.state === 'available' ? query.data.simulation : null

  const style: CSSProperties = {
    ...(brandingStyle(view?.accentColor) ?? {}),
    // Uses --c-sage so the soft tint follows the client colour; default equals #fdeef6.
    background: 'radial-gradient(900px 460px at 84% -10%, rgb(var(--c-sage)) 0%, rgb(var(--c-sage) / 0) 65%), #f4f4f6',
  }

  return (
    <div className="min-h-screen text-ink" style={style}>
      <a href="#participant-content" className="skip-link">דילוג לתוכן המרכזי</a>
      <header className="px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3 text-sm font-black text-ink">
          {view?.logo ? (
            <img src={view.logo} alt={view.organizationLabel || 'לוגו הלקוח'} className="h-10 w-auto max-w-[190px] object-contain" />
          ) : (
            <><img src="/assets/ngg-mark.png" alt="" className="h-7 w-auto" /> שיח</>
          )}
        </div>
      </header>
      <main id="participant-content" className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 sm:pb-20">
        <Outlet />
      </main>
      <footer className="px-4 pb-8 text-center text-xs text-[#7f7e7f]">סביבת תרגול · אין שימוש במיקרופון אמיתי בשלב ההדגמה</footer>
    </div>
  )
}
