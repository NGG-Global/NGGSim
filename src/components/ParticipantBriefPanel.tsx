import { BriefcaseBusiness, Clock3, Headphones, Target } from 'lucide-react'
import type { ParticipantSimulationView } from '../types/simulation'

export function ParticipantBriefPanel({ simulation, compact = false }: { simulation: ParticipantSimulationView; compact?: boolean }) {
  const brief = simulation.participantBrief
  return (
    <div className={`space-y-6 ${compact ? 'text-sm' : ''}`}>
      <div>
        {simulation.organizationLabel && (
          <p className="mb-2 text-sm font-bold text-[#55736b]">{simulation.organizationLabel}</p>
        )}
        <h1 className={`${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'} text-balance font-bold tracking-tight text-ink`}>{brief.title || simulation.title}</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#49625d]">{brief.shortDescription || 'התדריך יוצג כאן לאחר השלמתו.'}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <BriefItem icon={<BriefcaseBusiness />} label="התפקיד שלך" value={brief.participantRole || 'טרם הוגדר'} />
        <BriefItem icon={<Target />} label="מטרת השיחה" value={brief.conversationGoal || 'טרם הוגדרה'} />
        <BriefItem icon={<Clock3 />} label="משך משוער" value={`${brief.estimatedMinutes || 0} דקות`} />
      </div>

      <section className="rounded-2xl border border-[#dbe5e1] bg-white p-5">
        <h2 className="text-lg font-bold text-ink">הסיטואציה</h2>
        <p className="mt-2 whitespace-pre-wrap leading-7 text-[#49625d]">{brief.situationDescription || 'תיאור הסיטואציה יוצג כאן.'}</p>
        {brief.allowedInformation && (
          <>
            <h3 className="mt-5 font-bold text-ink">מה ידוע לך</h3>
            <p className="mt-2 whitespace-pre-wrap leading-7 text-[#49625d]">{brief.allowedInformation}</p>
          </>
        )}
      </section>

      <section className="flex gap-3 rounded-2xl bg-[#edf4f1] p-4 text-[#34544d]">
        <Headphones className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-bold">לפני שמתחילים</h2>
          <p className="mt-1 whitespace-pre-wrap leading-6">{brief.technicalInstructions}</p>
        </div>
      </section>
    </div>
  )
}

function BriefItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#dbe5e1] bg-white p-4">
      <span className="block h-5 w-5 text-coral [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">{icon}</span>
      <span className="mt-3 block text-xs font-bold text-[#6b817c]">{label}</span>
      <span className="mt-1 block font-bold leading-6 text-ink">{value}</span>
    </div>
  )
}
