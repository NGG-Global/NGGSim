import { CircleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f2] p-4" dir="rtl">
      <div className="max-w-lg rounded-3xl border border-[#dce5e1] bg-white p-10 text-center shadow-card">
        <CircleAlert className="mx-auto h-10 w-10 text-[#6b817b]" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold text-ink">העמוד לא נמצא</h1>
        <p className="mt-3 leading-7 text-[#5d746e]">הכתובת שנפתחה אינה קיימת במערכת המקומית.</p>
        <Link to="/admin" className="button-link-primary mt-6">חזרה למרחב המנחים</Link>
      </div>
    </main>
  )
}
