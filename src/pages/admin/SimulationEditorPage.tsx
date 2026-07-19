import { ArrowLeft, ArrowRight, Eye, Save, Send, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { RepositoryErrorState, RepositoryLoadingState } from '../../components/RepositoryStates'
import { Toast } from '../../components/ui/Toast'
import { SimulationFormSteps } from '../../features/simulations/SimulationFormSteps'
import { WizardStepNav, wizardSteps } from '../../features/simulations/WizardStepNav'
import { useRepositoryQuery } from '../../hooks/useRepositoryQuery'
import { useSimulationRepository } from '../../repositories/SimulationRepositoryProvider'
import type { Simulation } from '../../types/simulation'

type SaveState = 'saved' | 'saving' | 'unsaved'

export function SimulationEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const repository = useSimulationRepository()
  const query = useRepositoryQuery(() => repository.getById(id), [repository, id])
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [step, setStep] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const ready = useRef(false)
  const changeRevision = useRef(0)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (query.data !== undefined) {
      setSimulation(query.data)
      setSaveState('saved')
      ready.current = true
    }
  }, [query.data])

  useEffect(() => {
    if (!simulation || !ready.current || saveState !== 'unsaved' || publishing) return
    const capturedRevision = changeRevision.current
    const snapshot = simulation
    const timeout = window.setTimeout(async () => {
      try {
        setSaveState('saving')
        const saved = await repository.update(snapshot.id, snapshot)
        if (changeRevision.current === capturedRevision) {
          setSimulation(saved)
          setSaveState('saved')
        } else {
          setSaveState('unsaved')
        }
      } catch (error) {
        setSaveState('unsaved')
        setToast({ message: error instanceof Error ? error.message : 'לא הצלחנו לשמור את הטיוטה.', tone: 'error' })
      }
    }, 650)
    return () => window.clearTimeout(timeout)
  }, [publishing, repository, simulation, saveState])

  if (query.isLoading && query.data === undefined) return <RepositoryLoadingState label="טוענים את הסימולציה…" />
  if (query.error) return <RepositoryErrorState error={query.error} onRetry={query.reload} />

  if (!simulation) {
    return (
      <div className="rounded-3xl border border-[#dce5e1] bg-white p-10 text-center">
        <h1 className="text-2xl font-bold">הסימולציה לא נמצאה</h1>
        <p className="mt-2 text-[#5f7670]">ייתכן שהיא נמחקה או שהכתובת אינה תקינה.</p>
        <Button className="mt-6" onClick={() => navigate('/admin/simulations')}>חזרה לסימולציות</Button>
      </div>
    )
  }

  const change = (patch: Partial<Simulation>) => {
    changeRevision.current += 1
    setSimulation((current) => current ? { ...current, ...patch } : current)
    setSaveState('unsaved')
  }

  const saveNow = async (): Promise<Simulation | null> => {
    setSaveState('saving')
    try {
      const saved = await repository.update(simulation.id, simulation)
      setSimulation(saved)
      setSaveState('saved')
      setToast({ message: repository.provider === 'local' ? 'הטיוטה נשמרה בדפדפן.' : 'הטיוטה נשמרה בסביבת העבודה.', tone: 'success' })
      return saved
    } catch (error) {
      setSaveState('unsaved')
      setToast({ message: error instanceof Error ? error.message : 'לא הצלחנו לשמור את הטיוטה.', tone: 'error' })
      return null
    }
  }

  const openPreview = async (mode: 'facilitator' | 'participant') => {
    try {
      const saved = await saveNow()
      if (saved) navigate(`/admin/simulations/${simulation.id}/preview?mode=${mode}`)
    } catch { /* saveNow handles user-facing errors. */ }
  }

  const publish = async () => {
    setPublishing(true)
    try {
      await repository.update(simulation.id, simulation)
      const published = await repository.publish(simulation.id)
      setSimulation(published)
      setSaveState('saved')
      navigate(`/admin/simulations/${simulation.id}/share`)
    } catch (error) {
      setSaveState('unsaved')
      setToast({ message: error instanceof Error ? error.message : 'לא הצלחנו לפרסם את הסימולציה.', tone: 'error' })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="eyebrow">עריכת סימולציה</p>
          <h1 className="page-title">{simulation.title || 'סימולציה חדשה'}</h1>
          <p className="mt-2 text-sm text-[#627872]" aria-live="polite">
            {saveState === 'saving' ? 'שומר טיוטה…' : saveState === 'unsaved' ? 'יש שינויים שטרם נשמרו' : 'כל השינויים נשמרו'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={saveState === 'saving' || publishing} variant="secondary" icon={<Save className="h-4 w-4" />} onClick={() => { void saveNow() }}>שמירה כטיוטה</Button>
          {simulation.status === 'published' && <Button variant="secondary" icon={<Share2 className="h-4 w-4" />} onClick={() => navigate(`/admin/simulations/${simulation.id}/share`)}>מסך שיתוף</Button>}
        </div>
      </div>

      <WizardStepNav currentStep={step} onSelect={setStep} />

      <div className="rounded-3xl border border-[#dce5e1] bg-white p-5 shadow-card sm:p-7 lg:p-9">
        <SimulationFormSteps step={step} simulation={simulation} onChange={change} />
      </div>

      <div className="flex flex-col-reverse justify-between gap-3 rounded-2xl border border-[#dce5e1] bg-white p-4 sm:flex-row sm:items-center">
        <Button variant="secondary" icon={<ArrowRight className="h-4 w-4" />} disabled={step === 0} onClick={() => { setStep((value) => Math.max(0, value - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>השלב הקודם</Button>
        <div className="flex flex-wrap justify-center gap-2">
          {step === wizardSteps.length - 1 && (
            <>
              <Button variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => openPreview('facilitator')}>תצוגת מנחה</Button>
              <Button variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => openPreview('participant')}>תצוגת משתתף</Button>
              <Button disabled={publishing || saveState === 'saving'} icon={<Send className="h-4 w-4" />} onClick={publish}>{publishing ? 'מפרסמים…' : 'פרסום הסימולציה'}</Button>
            </>
          )}
        </div>
        <Button icon={<ArrowLeft className="h-4 w-4" />} disabled={step === wizardSteps.length - 1} onClick={() => { setStep((value) => Math.min(wizardSteps.length - 1, value + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>השלב הבא</Button>
      </div>
    </div>
  )
}
