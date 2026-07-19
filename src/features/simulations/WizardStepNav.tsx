import { Check } from 'lucide-react'

export const wizardSteps = [
  'פרטים כלליים',
  'הסיטואציה',
  'דמות ה־AI',
  'התנהגות',
  'תדריך',
  'פרטי משתתף',
  'מטרות ומדדים',
  'סיכום ופרסום',
]

export function WizardStepNav({ currentStep, onSelect }: { currentStep: number; onSelect: (step: number) => void }) {
  return (
    <nav aria-label="שלבי יצירת הסימולציה" className="overflow-x-auto pb-2">
      <ol className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-8">
        {wizardSteps.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-current={currentStep === index ? 'step' : undefined}
              className={`group flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-right text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f7b3d6] lg:flex-col lg:items-start ${
                currentStep === index
                  ? 'border-forest bg-forest text-white'
                  : index < currentStep
                    ? 'border-[#b8d2ca] bg-[#edf5f1] text-forest'
                    : 'border-[#dbe4e0] bg-white text-[#627771] hover:border-[#ec2a8c]'
              }`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${currentStep === index ? 'bg-white/15' : 'bg-white'}`}>
                {index < currentStep ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span className="whitespace-nowrap lg:whitespace-normal">{label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
