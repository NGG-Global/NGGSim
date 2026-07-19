import { Outlet } from 'react-router-dom'

export function ParticipantLayout() {
  return (
    <div className="min-h-screen bg-[radial-gradient(900px_460px_at_84%_-10%,#fdeef6_0%,rgba(253,238,246,0)_65%)] bg-[#f4f4f6] text-ink">
      <a href="#participant-content" className="skip-link">דילוג לתוכן המרכזי</a>
      <header className="px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-2 text-sm font-black text-ink">
          <img src="/assets/ngg-mark.png" alt="" className="h-7 w-auto" /> שיח
        </div>
      </header>
      <main id="participant-content" className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 sm:pb-20">
        <Outlet />
      </main>
      <footer className="px-4 pb-8 text-center text-xs text-[#7f7e7f]">סביבת תרגול מקומית · אין שימוש במיקרופון אמיתי</footer>
    </div>
  )
}
