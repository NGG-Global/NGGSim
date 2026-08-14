import { Eye, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { ParticipantBriefPanel } from '../../components/ParticipantBriefPanel'
import { SelectField, TextareaField, TextField, Toggle } from '../../components/ui/FormControls'
import { ANALYSIS_CRITERIA, ANALYSIS_CRITERIA_IDS } from '../../data/analysisCriteria'
import { toParticipantSimulationView } from '../../services/participantSimulationService'
import type { ParticipantField, Simulation } from '../../types/simulation'
import { readLogoDataUrl } from './branding'

interface Props {
  step: number
  simulation: Simulation
  onChange: (patch: Partial<Simulation>) => void
}

const conversationTypes = [
  'שיחת משוב',
  'שיחה עם עובד מתנגד',
  'טיפול בירידה בביצועים',
  'ניהול קונפליקט',
  'הצבת גבולות',
  'שיחת שינוי ארגוני',
  'שיחת פיתוח',
  'שיחת שירות',
  'אחר',
]

const personalityOptions = ['ענייני', 'חשדן', 'מתגונן', 'כועס', 'מתוסכל', 'פסיבי', 'ישיר', 'ציני', 'משתף פעולה', 'נמנע מעימות']

export function SimulationFormSteps({ step, simulation, onChange }: Props) {
  const [logoError, setLogoError] = useState('')
  const updateOrganization = (patch: Partial<Simulation['organization']>) => onChange({ organization: { ...simulation.organization, ...patch } })
  const updateScenario = (patch: Partial<Simulation['scenario']>) => onChange({ scenario: { ...simulation.scenario, ...patch } })
  const updateCharacter = (patch: Partial<Simulation['character']>) => onChange({ character: { ...simulation.character, ...patch } })
  const updateBehavior = (patch: Partial<Simulation['behavior']>) => onChange({ behavior: { ...simulation.behavior, ...patch } })
  const updateBrief = (patch: Partial<Simulation['participantBrief']>) => onChange({ participantBrief: { ...simulation.participantBrief, ...patch } })
  const updateFacilitator = (patch: Partial<Simulation['facilitatorConfiguration']>) => onChange({ facilitatorConfiguration: { ...simulation.facilitatorConfiguration, ...patch } })

  if (step === 0) {
    return (
      <StepSection number="א" title="פרטים כלליים" description="המידע שיעזור לך לזהות ולנהל את הסימולציה במרחב המנחים.">
        <div className="form-grid">
          <TextField label="שם הסימולציה" required value={simulation.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="לדוגמה: שיחת משוב עם עובד מתנגד" />
          <TextField label="שם הלקוח או הארגון" value={simulation.organization.clientName} onChange={(event) => updateOrganization({ clientName: event.target.value })} placeholder="שם הארגון" />
          <TextField label="שם התוכנית" value={simulation.organization.programName} onChange={(event) => updateOrganization({ programName: event.target.value })} placeholder="לדוגמה: מנהלים מצמיחים 2026" />
          <TextField label="קהל יעד" value={simulation.organization.audience} onChange={(event) => updateOrganization({ audience: event.target.value })} placeholder="לדוגמה: מנהלי צוותים חדשים" />
          <TextareaField className="md:col-span-2" label="תיאור קצר של ההקשר הארגוני" value={simulation.organization.context} onChange={(event) => updateOrganization({ context: event.target.value })} placeholder="מה חשוב לדעת על הארגון, התוכנית או הסיבה לתרגול?" />
        </div>
        <Toggle checked={simulation.organization.showOrganizationToParticipant} onChange={(checked) => updateOrganization({ showOrganizationToParticipant: checked })} label="הצגת שם התוכנית או הארגון למשתתף" description="כאשר האפשרות כבויה, המשתתף יראה רק את שם הסימולציה והתדריך." />

        <fieldset className="rounded-2xl border border-[#d8e2de] bg-[#fbfcfb] p-5">
          <legend className="px-2 text-sm font-bold text-forest">מיתוג ללקוח</legend>
          <p className="form-hint">הצבע והלוגו יופיעו בעמודי המשתתף בלבד, כדי להתאים את התרגול למותג הלקוח. אינם משפיעים על ממשק המנחים.</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <span className="form-label">צבע מותג</span>
              <div className="flex items-center gap-3">
                <input type="color" aria-label="צבע מותג" value={simulation.organization.accentColor || '#ec2a8c'} onChange={(event) => updateOrganization({ accentColor: event.target.value })} className="h-11 w-16 cursor-pointer rounded-lg border border-[#c7c6c7] bg-white p-1" />
                <span className="text-sm text-[#5a5a5c]">{simulation.organization.accentColor || 'ברירת מחדל של NGG'}</span>
                {simulation.organization.accentColor && (
                  <button type="button" onClick={() => updateOrganization({ accentColor: '' })} className="text-sm font-bold text-coral underline">איפוס</button>
                )}
              </div>
            </div>
            <div>
              <span className="form-label">לוגו הלקוח</span>
              {simulation.organization.logo ? (
                <div className="flex items-center gap-3">
                  <img src={simulation.organization.logo} alt="תצוגת לוגו" className="h-12 w-auto max-w-[140px] rounded border border-[#e5e4e7] bg-white object-contain p-1" />
                  <button type="button" onClick={() => { setLogoError(''); updateOrganization({ logo: '' }) }} className="text-sm font-bold text-coral underline">הסרה</button>
                </div>
              ) : (
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#c7c6c7] bg-white px-4 py-2.5 text-sm font-bold text-[#5a5a5c] transition hover:border-forest">
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    setLogoError('')
                    try { updateOrganization({ logo: await readLogoDataUrl(file) }) }
                    catch (uploadError) { setLogoError(uploadError instanceof Error ? uploadError.message : 'העלאת הלוגו נכשלה.') }
                  }} />
                  העלאת לוגו (PNG, JPG, WEBP או SVG)
                </label>
              )}
              {logoError && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{logoError}</p>}
            </div>
          </div>
        </fieldset>
      </StepSection>
    )
  }

  if (step === 1) {
    return (
      <StepSection number="ב" title="הסיטואציה" description="הגדירו את הרקע לשיחה ואת ההפרדה בין מידע גלוי למידע פנימי.">
        <div className="form-grid">
          <SelectField label="סוג השיחה" value={simulation.scenario.conversationType} onChange={(event) => updateScenario({ conversationType: event.target.value })}>
            {conversationTypes.map((type) => <option key={type}>{type}</option>)}
          </SelectField>
          <TextareaField label="תיאור הסיטואציה" required value={simulation.scenario.description} onChange={(event) => updateScenario({ description: event.target.value })} placeholder="מי נמצא בשיחה ומהו הנושא המרכזי?" />
          <TextareaField label="מה קרה לפני תחילת השיחה" value={simulation.scenario.priorEvents} onChange={(event) => updateScenario({ priorEvents: event.target.value })} />
          <TextareaField label="מידע שהמשתתף יודע בתחילת הסימולציה" value={simulation.scenario.participantKnownInfo} onChange={(event) => updateScenario({ participantKnownInfo: event.target.value })} />
          <TextareaField label="מידע שאסור להציג למשתתף" hint="מידע זה יישאר בממשק המנחים בלבד." value={simulation.scenario.hiddenInfo} onChange={(event) => updateScenario({ hiddenInfo: event.target.value })} />
        </div>
        <PrivateNotice />
      </StepSection>
    )
  }

  if (step === 2) {
    const toggleTrait = (trait: string) => {
      const selected = simulation.character.personalityTraits.includes(trait)
      updateCharacter({ personalityTraits: selected ? simulation.character.personalityTraits.filter((item) => item !== trait) : [...simulation.character.personalityTraits, trait] })
    }
    return (
      <StepSection number="ג" title="דמות ה־AI" description="בנו דמות עקבית ואמינה. מידע זה לא יוצג למשתתף.">
        <div className="form-grid">
          <TextField label="שם הדמות" required value={simulation.character.name} onChange={(event) => updateCharacter({ name: event.target.value })} />
          <TextField label="תפקיד הדמות" value={simulation.character.role} onChange={(event) => updateCharacter({ role: event.target.value })} />
          <TextField label="הקשר שלה למשתתף" value={simulation.character.relationToParticipant} onChange={(event) => updateCharacter({ relationToParticipant: event.target.value })} placeholder="לדוגמה: עובד ישיר בצוות" />
          <TextField label="מצב רגשי בתחילת השיחה" value={simulation.character.initialEmotionalState} onChange={(event) => updateCharacter({ initialEmotionalState: event.target.value })} />
          <SelectField label="קול הדמות" hint="קובע גם את הקול בשיחה וגם את המין הדקדוקי של הדמות: דמות בקול גברי מדברת על עצמה בלשון זכר, ודמות בקול נשי בלשון נקבה. יש לוודא שמשפט הפתיחה וסגנון הדיבור נכתבו באותו מין." value={simulation.character.voiceGender} onChange={(event) => updateCharacter({ voiceGender: event.target.value as Simulation['character']['voiceGender'] })}>
            <option value="female">קול נשי</option>
            <option value="male">קול גברי</option>
          </SelectField>
        </div>
        <fieldset>
          <legend className="form-label">מאפייני אישיות</legend>
          <p className="form-hint">אפשר לבחור כמה מאפיינים.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {personalityOptions.map((trait) => {
              const selected = simulation.character.personalityTraits.includes(trait)
              return (
                <button key={trait} type="button" aria-pressed={selected} onClick={() => toggleTrait(trait)} className={`rounded-full border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f7b3d6] ${selected ? 'border-forest bg-forest text-white' : 'border-[#cddbd7] bg-white text-[#506963] hover:border-[#ec2a8c]'}`}>
                  {trait}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div className="form-grid">
          <TextareaField label="אינטרסים" value={simulation.character.interests} onChange={(event) => updateCharacter({ interests: event.target.value })} />
          <TextareaField label="מניעים" value={simulation.character.motivations} onChange={(event) => updateCharacter({ motivations: event.target.value })} />
          <TextareaField label="התנגדויות מרכזיות" value={simulation.character.objections} onChange={(event) => updateCharacter({ objections: event.target.value })} />
          <TextareaField label="נקודות רגישות" value={simulation.character.sensitivities} onChange={(event) => updateCharacter({ sensitivities: event.target.value })} />
          <TextareaField label="מידע שהדמות מוכנה לחשוף" value={simulation.character.freelySharedInfo} onChange={(event) => updateCharacter({ freelySharedInfo: event.target.value })} />
          <TextareaField label="מידע שייחשף רק בתנאים מסוימים" value={simulation.character.conditionalInfo} onChange={(event) => updateCharacter({ conditionalInfo: event.target.value })} />
          <TextareaField label="סגנון דיבור" value={simulation.character.speakingStyle} onChange={(event) => updateCharacter({ speakingStyle: event.target.value })} />
          <TextareaField label="התנהגויות שיש להימנע מהן" value={simulation.character.avoidedBehaviors} onChange={(event) => updateCharacter({ avoidedBehaviors: event.target.value })} />
        </div>
        <PrivateNotice />
      </StepSection>
    )
  }

  if (step === 3) {
    return (
      <StepSection number="ד" title="התנהגות הסימולציה" description="קבעו איך הדמות מגיבה, מתי היא נפתחת ומה עשוי להסלים את השיחה.">
        <div className="form-grid">
          <SelectField label="רמת קושי" value={simulation.behavior.difficulty} onChange={(event) => updateBehavior({ difficulty: event.target.value as Simulation['behavior']['difficulty'] })}>
            <option>קל</option><option>בינוני</option><option>מאתגר</option>
          </SelectField>
          <SelectField label="מידת ההתנגדות" value={simulation.behavior.resistance} onChange={(event) => updateBehavior({ resistance: event.target.value as Simulation['behavior']['resistance'] })}>
            <option>נמוכה</option><option>בינונית</option><option>גבוהה</option>
          </SelectField>
          <TextField label="משפט פתיחה של הדמות" value={simulation.behavior.openingLine} onChange={(event) => updateBehavior({ openingLine: event.target.value })} />
          <TextareaField label="אילו פעולות יגרמו לדמות להיפתח" value={simulation.behavior.openingTriggers} onChange={(event) => updateBehavior({ openingTriggers: event.target.value })} />
          <TextareaField label="אילו פעולות יגרמו להסלמה" value={simulation.behavior.escalationTriggers} onChange={(event) => updateBehavior({ escalationTriggers: event.target.value })} />
          <TextareaField label="תנאים אפשריים להצלחה" value={simulation.behavior.successConditions} onChange={(event) => updateBehavior({ successConditions: event.target.value })} />
          <TextareaField label="תנאים אפשריים לכישלון" value={simulation.behavior.failureConditions} onChange={(event) => updateBehavior({ failureConditions: event.target.value })} />
          <TextareaField className="md:col-span-2" label="האופן שבו הסימולציה יכולה להסתיים" value={simulation.behavior.endingConditions} onChange={(event) => updateBehavior({ endingConditions: event.target.value })} />
        </div>
        <Toggle checked={simulation.behavior.canCalmDown} onChange={(checked) => updateBehavior({ canCalmDown: checked })} label="הדמות יכולה להירגע במהלך השיחה" description="כאשר האפשרות פעילה, הדמות עשויה להירגע במהלך השיחה אם המשתתף מגיב באמפתיה ובהקשבה." />
        <div className="form-grid">
          <TextareaField label="הנחיות פנימיות למנחה" value={simulation.facilitatorConfiguration.internalNotes} onChange={(event) => updateFacilitator({ internalNotes: event.target.value })} />
          <TextareaField label="הנחיות נוספות לדמות" hint="הנחיות אלה נשלחות למנוע השיחה ומשפיעות ישירות על התנהגות הדמות." value={simulation.facilitatorConfiguration.futureAgentPrompt} onChange={(event) => updateFacilitator({ futureAgentPrompt: event.target.value })} />
        </div>
      </StepSection>
    )
  }

  if (step === 4) {
    const participantView = toParticipantSimulationView(simulation)
    return (
      <StepSection number="ה" title="תדריך למשתתף" description="זהו המידע היחיד שיוצג לפני תחילת השיחה. התצוגה המקדימה מתעדכנת בזמן אמת.">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className="space-y-5">
            <TextField label="כותרת הסימולציה למשתתף" required value={simulation.participantBrief.title} onChange={(event) => updateBrief({ title: event.target.value })} />
            <TextareaField label="תיאור קצר" required value={simulation.participantBrief.shortDescription} onChange={(event) => updateBrief({ shortDescription: event.target.value })} />
            <TextField label="התפקיד שהמשתתף מגלם" required value={simulation.participantBrief.participantRole} onChange={(event) => updateBrief({ participantRole: event.target.value })} />
            <TextareaField label="תיאור הסיטואציה" value={simulation.participantBrief.situationDescription} onChange={(event) => updateBrief({ situationDescription: event.target.value })} />
            <TextareaField label="מטרת השיחה" required value={simulation.participantBrief.conversationGoal} onChange={(event) => updateBrief({ conversationGoal: event.target.value })} />
            <TextareaField label="מידע שהמשתתף רשאי לדעת" value={simulation.participantBrief.allowedInformation} onChange={(event) => updateBrief({ allowedInformation: event.target.value })} />
            <TextField type="number" min="1" max="60" label="משך משוער בדקות" value={simulation.participantBrief.estimatedMinutes} onChange={(event) => updateBrief({ estimatedMinutes: Number(event.target.value) })} />
            <TextareaField label="הנחיות טכניות" value={simulation.participantBrief.technicalInstructions} onChange={(event) => updateBrief({ technicalInstructions: event.target.value })} />
            <TextareaField label="טקסט אישור לפני התחלה" value={simulation.participantBrief.consentText} onChange={(event) => updateBrief({ consentText: event.target.value })} />
          </div>
          <aside aria-label="תצוגה מקדימה למשתתף" className="h-fit rounded-3xl border border-[#ceddd8] bg-[#f4f7f4] p-5 xl:sticky xl:top-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-forest"><Eye className="h-4 w-4" aria-hidden="true" /> כך ייראה התדריך למשתתף</div>
            <ParticipantBriefPanel simulation={participantView} compact />
          </aside>
        </div>
      </StepSection>
    )
  }

  if (step === 5) {
    const updateField = (id: string, patch: Partial<ParticipantField>) => {
      onChange({ participantFields: simulation.participantFields.map((field) => field.id === id ? { ...field, ...patch } : field) })
    }
    return (
      <StepSection number="ו" title="פרטי המשתתף" description="בחרו אילו פרטים יידרשו לפני הכניסה. בשלב זה הפרטים אינם מאומתים.">
        <div className="space-y-3">
          {simulation.participantFields.map((field) => (
            <div key={field.id} className="grid items-center gap-3 rounded-2xl border border-[#dce5e1] bg-white p-4 sm:grid-cols-[1fr_auto_auto]">
              <div>
                {field.type === 'custom' ? (
                  <TextField label="שם השדה המותאם" value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} />
                ) : (
                  <p className="font-bold text-ink">{field.label}</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-[#526b65]"><input type="checkbox" checked={field.enabled} onChange={(event) => updateField(field.id, { enabled: event.target.checked })} className="h-5 w-5 rounded text-forest focus:ring-[#ec2a8c]" /> הצגה</label>
              <label className={`flex items-center gap-2 text-sm font-bold ${field.enabled ? 'text-[#526b65]' : 'text-[#a0ada9]'}`}><input type="checkbox" checked={field.required} disabled={!field.enabled} onChange={(event) => updateField(field.id, { required: event.target.checked })} className="h-5 w-5 rounded text-forest focus:ring-[#ec2a8c]" /> חובה</label>
            </div>
          ))}
        </div>
        <Toggle checked={!simulation.participantFields.some((field) => field.enabled)} onChange={(checked) => checked && onChange({ participantFields: simulation.participantFields.map((field) => ({ ...field, enabled: false, required: false })) })} label="השתתפות אנונימית" description="כאשר האפשרות פעילה, לא יוצג למשתתף אף שדה זיהוי." />
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle checked={simulation.participantBrief.allowRetry} onChange={(checked) => updateBrief({ allowRetry: checked })} label="לאפשר ניסיון נוסף" description="במסך הסיום יוצג כפתור להתחלה מחדש." />
          <Toggle checked={simulation.participantBrief.showFeedback} onChange={(checked) => updateBrief({ showFeedback: checked })} label="הצגת משוב למשתתף" description="יוצג משוב כללי מדומה בלבד, ללא דוח פנימי." />
        </div>
      </StepSection>
    )
  }

  if (step === 6) {
    const selected = new Set(simulation.analysisCriteria)
    const toggleCriterion = (id: string, checked: boolean) => {
      const next = new Set(simulation.analysisCriteria)
      if (checked) next.add(id)
      else next.delete(id)
      // Store in the canonical criteria order so the report reads consistently.
      onChange({ analysisCriteria: ANALYSIS_CRITERIA_IDS.filter((value) => next.has(value)) })
    }

    return (
      <StepSection number="ז" title="מטרות למידה — קריטריונים להערכה" description="בחרו אילו קריטריונים ינותחו בסיום הסימולציה. במשוב יוצגו אך ורק הקריטריונים שנבחרו כאן.">
        <div className="space-y-3">
          {ANALYSIS_CRITERIA.map((criterion) => (
            <div key={criterion.id} className="rounded-2xl border border-[#d8e2de] bg-[#fbfcfb] p-4">
              <Toggle
                checked={selected.has(criterion.id)}
                onChange={(checked) => toggleCriterion(criterion.id, checked)}
                label={criterion.label}
                description={criterion.description}
              />
            </div>
          ))}
        </div>
        {simulation.analysisCriteria.length === 0 && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">יש לבחור לפחות קריטריון אחד כדי שיופק משוב בסיום הסימולציה.</p>
        )}
      </StepSection>
    )
  }

  return (
    <StepSection number="ח" title="סיכום ופרסום" description="עברו על עיקרי הסימולציה לפני שמירת הטיוטה או יצירת הקישור למשתתפים.">
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard label="סימולציה" value={simulation.title || 'טרם הוגדר שם'} detail={`${simulation.organization.clientName || 'ללא ארגון'} · ${simulation.scenario.conversationType}`} />
        <SummaryCard label="דמות" value={simulation.character.name || 'טרם הוגדרה דמות'} detail={`${simulation.character.role || 'ללא תפקיד'} · קושי ${simulation.behavior.difficulty}`} />
        <SummaryCard label="תדריך למשתתף" value={simulation.participantBrief.title || 'התדריך עדיין חסר'} detail={simulation.participantBrief.shortDescription || 'נדרש תיאור קצר לפני פרסום'} />
        <SummaryCard label="איסוף נתונים" value={`${simulation.participantFields.filter((field) => field.enabled).length} שדות משתתף`} detail={`${simulation.analysisCriteria.length} קריטריונים להערכה`} />
      </div>
      <div className="rounded-2xl border border-[#d8e4df] bg-[#edf5f1] p-5">
        <h3 className="flex items-center gap-2 font-bold text-forest"><ShieldCheck className="h-5 w-5" aria-hidden="true" /> הפרדת המידע נשמרת</h3>
        <p className="mt-2 leading-7 text-[#46645c]">הקישור הציבורי כולל רק את התדריך, שדות המשתתף, שם הדמות ותיאור קצר. מידע סודי, תנאי הצלחה, מדדים והנחיות הדמות נשארים בממשק המנחים.</p>
      </div>
      <p className="text-sm leading-6 text-[#667b75]">אפשר לחזור לכל שלב דרך סרגל השלבים למעלה. הכפתורים בתחתית העמוד מאפשרים שמירה, תצוגה מקדימה ופרסום.</p>
    </StepSection>
  )
}

function StepSection({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <header className="border-b border-[#e2e8e5] pb-5">
        <p className="eyebrow">שלב {number}</p>
        <h2 className="text-2xl font-bold tracking-tight text-ink">{title}</h2>
        <p className="mt-2 max-w-3xl leading-7 text-[#60756f]">{description}</p>
      </header>
      {children}
    </section>
  )
}

function PrivateNotice() {
  return (
    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="text-sm leading-6"><strong>מידע פנימי:</strong> השדות הרגישים בשלב זה נשמרים בנפרד ואינם נכללים בתצוגת המשתתף.</p>
    </div>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#dce5e1] bg-white p-5">
      <p className="text-xs font-bold text-[#667b75]">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#60756f]">{detail}</p>
    </div>
  )
}
