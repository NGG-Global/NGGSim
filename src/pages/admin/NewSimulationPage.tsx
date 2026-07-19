import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RepositoryErrorState } from '../../components/RepositoryStates'
import { useSimulationRepository } from '../../repositories/SimulationRepositoryProvider'

export function NewSimulationPage() {
  const navigate = useNavigate()
  const repository = useSimulationRepository()
  const created = useRef(false)
  const [error, setError] = useState<Error | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (created.current) return
    created.current = true
    repository.create()
      .then((simulation) => navigate(`/admin/simulations/${simulation.id}/edit`, { replace: true }))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason : new Error('לא הצלחנו ליצור טיוטה חדשה.')))
  }, [navigate, repository, retry])

  if (error) {
    return <RepositoryErrorState error={error} onRetry={() => { created.current = false; setError(null); setRetry((value) => value + 1) }} />
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-[#5a726c]" role="status">
      <LoaderCircle className="ml-2 h-5 w-5 animate-spin" aria-hidden="true" /> מכינים טיוטה חדשה…
    </div>
  )
}
