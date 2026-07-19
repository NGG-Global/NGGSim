import { LayoutDashboard, Plus, Sparkles } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#f4f4f6] text-ink">
      <a href="#main-content" className="skip-link">דילוג לתוכן המרכזי</a>
      <header className="sticky top-0 z-30 border-b border-[#e5e4e7] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-10">
          <NavLink to="/admin" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f7b3d6]">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white"><img src="/assets/ngg-mark.png" alt="" className="h-9 w-auto" /></span>
            <span>
              <span className="block text-xl font-black tracking-tight">שיח</span>
              <span className="block text-xs font-bold text-[#7f7e7f]">מרחב סימולציות ניהוליות</span>
            </span>
          </NavLink>
          <span className="hidden items-center gap-2 rounded-full border border-[#f7b3d6] bg-sage px-3 py-1.5 text-xs font-bold text-[#b01a65] sm:flex">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> סביבת הדגמה מקומית
          </span>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[230px_1fr]">
        <aside className="border-b border-[#e5e4e7] bg-white px-4 py-3 lg:min-h-[calc(100vh-73px)] lg:border-b-0 lg:border-l lg:px-5 lg:py-7">
          <nav aria-label="ניווט מנחים" className="flex gap-2 lg:flex-col">
            <NavLink to="/admin/simulations" className={({ isActive }) => `admin-nav-link ${isActive ? 'admin-nav-link-active' : ''}`}>
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> הסימולציות שלי
            </NavLink>
            <NavLink to="/admin/simulations/new" className={({ isActive }) => `admin-nav-link ${isActive ? 'admin-nav-link-active' : ''}`}>
              <Plus className="h-4 w-4" aria-hidden="true" /> סימולציה חדשה
            </NavLink>
          </nav>
          <div className="mt-10 hidden rounded-lg border border-[#e5e4e7] border-t-4 border-t-forest bg-white p-4 shadow-sm lg:block">
            <p className="text-xs font-bold text-[#d11e78]">שלב MVP מקומי</p>
            <p className="mt-2 text-sm leading-6 text-[#5a5a5c]">השיחה, הציונים והתמלול עדיין מדומים. כל הנתונים נשמרים בדפדפן הזה.</p>
          </div>
        </aside>
        <main id="main-content" className="min-w-0 p-4 sm:p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
