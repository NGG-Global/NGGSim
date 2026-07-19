import { ArrowRight, Eye, FilePenLine, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ParticipantBriefPanel } from '../../components/ParticipantBriefPanel'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { toParticipantSimulationView } from '../../services/participantSimulationService'
import { simulationRepository } from '../../repositories/localSimulationRepository'

export function SimulationPreviewPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialMode = searchParams.get('mode') === 'participant' ? 'participant' : 'facilitator'
  const [mode, setMode] = useState<'facilitator' | 'participant'>(initialMode)
  const simulation = simulationRepository.getById(id)

  if (!simulation) return <MissingSimulation onBack={() => navigate('/admin/simulations')} />
  const participantView = toParticipantSimulationView(simulation)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">תצוגה מקדימה</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{simulation.title || 'סימולציה ללא שם'}</h1>
            <StatusBadge status={simulation.status} />
          </div>
          <p className="mt-2 text-sm text-[#60756f]">עברו בין התצוגה המלאה למנחה לבין המידע המדויק שמותר למשתתף לראות.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<FilePenLine className="h-4 w-4" />} onClick={() => navigate(`/admin/simulations/${id}/edit`)}>עריכה</Button>
          <Button variant="ghost" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/admin/simulations')}>חזרה</Button>
        </div>
      </div>

      <div className="inline-flex rounded-xl border border-[#cddbd7] bg-white p-1" role="tablist" aria-label="סוג תצוגה מקדימה">
        <button type="button" role="tab" aria-selected={mode === 'facilitator'} onClick={() => setMode('facilitator')} className={`preview-tab ${mode === 'facilitator' ? 'preview-tab-active' : ''}`}><ShieldCheck className="h-4 w-4" aria-hidden="true" /> תצוגת מנחה</button>
        <button type="button" role="tab" aria-selected={mode === 'participant'} onClick={() => setMode('participant')} className={`preview-tab ${mode === 'participant' ? 'preview-tab-active' : ''}`}><UserRound className="h-4 w-4" aria-hidden="true" /> תצוגת משתתף</button>
      </div>

      {mode === 'participant' ? (
        <section className="rounded-3xl border border-[#d9e4df] bg-[#f2f5f1] p-5 sm:p-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-[#dfece7] px-4 py-3 text-sm font-bold text-forest"><Eye className="h-4 w-4" aria-hidden="true" /> זהו כל המידע שיוצג למשתתף לפני השיחה</div>
            <ParticipantBriefPanel simulation={participantView} />
          </div>
        </section>
      ) : (
        <FacilitatorPreview simulation={simulation} />
      )}
    </div>
  )
}

function FacilitatorPreview({ simulation }: { simulation: NonNullable<ReturnType<typeof simulationRepository.getById>> }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <PreviewSection title="הקשר וסיטואציה">
        <Detail label="ארגון" value={simulation.organization.clientName} />
        <Detail label="תוכנית" value={simulation.organization.programName} />
        <Detail label="קהל יעד" value={simulation.organization.audience} />
        <Detail label="סוג שיחה" value={simulation.scenario.conversationType} />
        <Detail label="מה קרה לפני השיחה" value={simulation.scenario.priorEvents} />
        <Detail label="מידע ידוע למשתתף" value={simulation.scenario.participantKnownInfo} />
      </PreviewSection>
      <PreviewSection title="דמות ה־AI">
        <Detail label="שם ותפקיד" value={`${simulation.character.name} · ${simulation.character.role}`} />
        <Detail label="מאפיינים" value={simulation.character.personalityTraits.join(', ')} />
        <Detail label="מצב רגשי" value={simulation.character.initialEmotionalState} />
        <Detail label="התנגדויות" value={simulation.character.objections} />
        <Detail label="סגנון דיבור" value={simulation.character.speakingStyle} />
      </PreviewSection>
      <PreviewSection title="מידע פנימי ורגיש" tone="private">
        <Detail label="מידע שאסור להציג למשתתף" value={simulation.scenario.hiddenInfo} />
        <Detail label="מידע מותנה של הדמות" value={simulation.character.conditionalInfo} />
        <Detail label="הנחיית דמות עתידית" value={simulation.facilitatorConfiguration.futureAgentPrompt} />
        <Detail label="הערות מנחה" value={simulation.facilitatorConfiguration.internalNotes} />
      </PreviewSection>
      <PreviewSection title="התנהגות ותנאי הערכה" tone="private">
        <Detail label="מה יגרום לפתיחות" value={simulation.behavior.openingTriggers} />
        <Detail label="מה יגרום להסלמה" value={simulation.behavior.escalationTriggers} />
        <Detail label="תנאי הצלחה" value={simulation.behavior.successConditions} />
        <Detail label="תנאי כישלון" value={simulation.behavior.failureConditions} />
        <Detail label="סיום הסימולציה" value={simulation.behavior.endingConditions} />
      </PreviewSection>
      <section className="rounded-3xl border border-[#dce5e1] bg-white p-6 xl:col-span-2">
        <h2 className="text-lg font-bold text-ink">מטרות ומדדי למידה</h2>
        {simulation.learningObjectives.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {simulation.learningObjectives.map((objective) => (
              <div key={objective.id} className="rounded-2xl bg-[#f4f7f5] p-4">
                <p className="font-bold text-ink">{objective.name || 'מטרה ללא שם'} {objective.weight !== undefined && <span className="text-xs text-[#687d77]">({objective.weight}%)</span>}</p>
                <p className="mt-1 text-sm leading-6 text-[#5b726c]">{objective.description}</p>
                <p className="mt-3 text-sm"><strong>מדד:</strong> {objective.metric.successMeasure || 'טרם הוגדר'}</p>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-[#687d77]">לא הוגדרו מטרות למידה.</p>}
      </section>
    </div>
  )
}

function PreviewSection({ title, tone, children }: { title: string; tone?: 'private'; children: React.ReactNode }) {
  return (
    <section className={`rounded-3xl border p-6 ${tone === 'private' ? 'border-amber-200 bg-amber-50/70' : 'border-[#dce5e1] bg-white'}`}>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {tone === 'private' && <p className="mt-1 text-xs font-bold text-amber-800">פנימי למנחה בלבד</p>}
      <dl className="mt-5 space-y-4">{children}</dl>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold text-[#697d78]">{label}</dt><dd className="mt-1 whitespace-pre-wrap leading-7 text-ink">{value || 'לא הוגדר'}</dd></div>
}

function MissingSimulation({ onBack }: { onBack: () => void }) {
  return <div className="rounded-3xl bg-white p-10 text-center"><h1 className="text-2xl font-bold">הסימולציה לא נמצאה</h1><Button className="mt-5" onClick={onBack}>חזרה לסימולציות</Button></div>
}
