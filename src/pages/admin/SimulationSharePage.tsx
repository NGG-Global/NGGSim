import { Check, Copy, Download, ExternalLink, Link2, Link2Off, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Toast } from '../../components/ui/Toast'
import { useRepositoryRevision } from '../../hooks/useRepositoryRevision'
import { simulationRepository } from '../../repositories/localSimulationRepository'

export function SimulationSharePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const revision = useRepositoryRevision()
  const simulation = useMemo(() => simulationRepository.getById(id), [id, revision])
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)

  if (!simulation) return <div className="rounded-3xl bg-white p-10 text-center"><h1 className="text-2xl font-bold">הסימולציה לא נמצאה</h1><Button className="mt-5" onClick={() => navigate('/admin/simulations')}>חזרה</Button></div>

  if (!simulation.publicToken || !simulation.shareLink) {
    return (
      <div className="rounded-3xl border border-[#dce5e1] bg-white p-8 text-center">
        <Link2 className="mx-auto h-10 w-10 text-[#78908a]" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">עדיין אין קישור ציבורי</h1>
        <p className="mt-2 text-[#60756f]">השלימו את התדריך ופרסמו את הסימולציה כדי ליצור קישור ו־QR.</p>
        <Button className="mt-6" onClick={() => navigate(`/admin/simulations/${id}/edit`)}>חזרה לעריכה</Button>
      </div>
    )
  }

  const publicUrl = `${window.location.origin}/simulation/${simulation.publicToken}`
  const invitation = `שלום, בקישור הבא תוכלו לבצע את הסימולציה „${simulation.title}”. מומלץ להיכנס ממקום שקט.\n${publicUrl}`

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setToast({ message: successMessage, tone: 'success' })
    } catch {
      setToast({ message: 'לא הצלחנו להעתיק אוטומטית. אפשר לסמן ולהעתיק את הטקסט ידנית.', tone: 'error' })
    }
  }

  const downloadQr = () => {
    const canvas = document.getElementById('simulation-qr') as HTMLCanvasElement | null
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-${simulation.title || 'simulation'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setToast({ message: 'קוד ה־QR הורד כתמונה.', tone: 'success' })
  }

  const unpublish = () => {
    if (!window.confirm('לבטל את הפרסום? הקישור הציבורי יפסיק לעבוד מיד.')) return
    simulationRepository.unpublish(simulation.id)
    setToast({ message: 'הפרסום בוטל. הקישור הציבורי אינו פעיל עוד.', tone: 'success' })
  }

  const regenerate = () => {
    if (!window.confirm('ליצור קישור חדש? הקישור הקודם יפסיק לעבוד.')) return
    simulationRepository.regeneratePublicToken(simulation.id)
    setToast({ message: 'נוצר קישור חדש והקישור הקודם בוטל.', tone: 'success' })
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
      <div>
        <p className="eyebrow">פרסום ושיתוף</p>
        <div className="flex flex-wrap items-center gap-3"><h1 className="page-title">{simulation.title}</h1><StatusBadge status={simulation.status} /></div>
        <p className="mt-2 text-[#60756f]">העתיקו את הקישור, הורידו QR או פתחו את חוויית המשתתף לבדיקה.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_380px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-[#dce5e1] bg-white p-6">
            <h2 className="text-lg font-bold">כתובת הסימולציה</h2>
            <p className="mt-1 text-sm text-[#657a74]">הקישור פעיל רק כל עוד היישום המקומי פועל במחשב הזה.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input readOnly value={publicUrl} dir="ltr" aria-label="כתובת הסימולציה הציבורית" className="text-input min-w-0 flex-1 text-left" onFocus={(event) => event.target.select()} />
              <Button icon={<Copy className="h-4 w-4" />} onClick={() => copyText(publicUrl, 'הקישור הועתק.')}>העתקת קישור</Button>
            </div>
            {simulation.status !== 'published' && (
              <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900"><Link2Off className="h-4 w-4" aria-hidden="true" /> הקישור אינו פעיל כעת משום שהפרסום בוטל.</div>
            )}
          </section>

          <section className="rounded-3xl border border-[#dce5e1] bg-white p-6">
            <h2 className="text-lg font-bold">הודעה מוכנה לשליחה</h2>
            <textarea readOnly value={invitation} rows={5} aria-label="טקסט הזמנה מוכן להעתקה" className="text-input mt-4 w-full resize-none" onFocus={(event) => event.target.select()} />
            <Button variant="secondary" className="mt-3" icon={<Copy className="h-4 w-4" />} onClick={() => copyText(invitation, 'ההודעה הועתקה.')}>העתקת ההודעה</Button>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button disabled={simulation.status !== 'published'} icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}>פתיחת קישור המשתתף</Button>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={regenerate}>יצירת קישור חדש</Button>
            <Button variant="danger" icon={<Link2Off className="h-4 w-4" />} disabled={simulation.status !== 'published'} onClick={unpublish}>ביטול פרסום</Button>
            <Button variant="ghost" onClick={() => navigate(`/admin/simulations/${id}/edit`)}>חזרה לעריכה</Button>
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-[#dce5e1] bg-white p-6 text-center">
          <div className="mx-auto inline-block rounded-2xl border border-[#e1e8e5] bg-white p-4">
            <QRCodeCanvas id="simulation-qr" value={publicUrl} size={240} level="M" marginSize={1} title={`קוד QR לסימולציה ${simulation.title}`} />
          </div>
          <h2 className="mt-5 text-lg font-bold">סריקה מהירה</h2>
          <p className="mt-2 text-sm leading-6 text-[#647a74]">ה־QR מכיל את אותה כתובת שמוצגת כטקסט. בסביבה המקומית יש לסרוק ממכשיר שיכול להגיע למחשב.</p>
          <Button variant="secondary" className="mt-4 w-full" icon={<Download className="h-4 w-4" />} onClick={downloadQr}>הורדת QR כתמונה</Button>
          {simulation.status === 'published' && <p className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-emerald-800"><Check className="h-4 w-4" aria-hidden="true" /> הקישור פעיל</p>}
        </aside>
      </div>
    </div>
  )
}
