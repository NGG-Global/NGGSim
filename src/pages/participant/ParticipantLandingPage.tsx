import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ParticipantBriefPanel } from '../../components/ParticipantBriefPanel'
import { PublicUnavailableState } from '../../components/PublicUnavailableState'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/FormControls'
import { getParticipantSimulationByToken, startParticipantSession } from '../../services/participantSimulationService'

export function ParticipantLandingPage() {
  const { publicToken = '' } = useParams()
  const navigate = useNavigate()
  const result = useMemo(() => getParticipantSimulationByToken(publicToken), [publicToken])
  const [details, setDetails] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')

  if (result.state === 'unavailable') return <PublicUnavailableState reason={result.reason} />
  const simulation = result.simulation
  const fields = simulation.participantFields

  const start = () => {
    const missingField = fields.find((field) => field.required && !details[field.type]?.trim())
    if (missingField) {
      setError(`יש למלא את השדה „${missingField.label}”.`)
      return
    }
    if (!consent) {
      setError('יש לאשר שקראת את התדריך לפני ההתחלה.')
      return
    }
    try {
      const session = startParticipantSession(publicToken, details)
      navigate(`/simulation/${publicToken}/session?session=${session.id}`)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'לא הצלחנו להתחיל את הסימולציה.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-[#dce5e1] bg-white p-5 shadow-card sm:p-8 lg:p-10">
      <ParticipantBriefPanel simulation={simulation} />

      {fields.length > 0 && (
        <section className="mt-8 border-t border-[#e4e9e7] pt-7">
          <h2 className="text-xl font-bold">כמה פרטים לפני שמתחילים</h2>
          <p className="mt-2 text-sm leading-6 text-[#627872]">הפרטים נשמרים רק בדפדפן המקומי של סביבת ההדגמה.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <TextField
                key={field.id}
                type={field.type === 'email' ? 'email' : 'text'}
                label={field.label}
                required={field.required}
                value={details[field.type] ?? ''}
                onChange={(event) => setDetails((current) => ({ ...current, [field.type]: event.target.value }))}
                autoComplete={field.type === 'fullName' ? 'name' : field.type === 'email' ? 'email' : 'off'}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-7">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dce5e1] bg-[#f7f9f8] p-4">
          <input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setError('') }} className="mt-1 h-5 w-5 rounded border-[#949494] text-forest focus:ring-[#ec2a8c]" />
          <span className="leading-7 text-ink">{simulation.participantBrief.consentText}</span>
        </label>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p>}
        <Button className="mt-5 w-full sm:w-auto" icon={<ArrowLeft className="h-5 w-5" />} onClick={start}>התחלת הסימולציה</Button>
        <p className="mt-4 flex items-center gap-2 text-xs text-[#6c807b]"><LockKeyhole className="h-4 w-4" aria-hidden="true" /> אין במסך זה גישה להגדרות המנחה או לתוצאות של אחרים.</p>
      </section>
    </div>
  )
}
