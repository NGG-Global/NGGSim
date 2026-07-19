import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { simulationRepository } from '../../repositories/localSimulationRepository'

export function NewSimulationPage() {
  const navigate = useNavigate()
  const created = useRef(false)

  useEffect(() => {
    if (created.current) return
    created.current = true
    const simulation = simulationRepository.create()
    navigate(`/admin/simulations/${simulation.id}/edit`, { replace: true })
  }, [navigate])

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-[#5a726c]" role="status">
      <LoaderCircle className="ml-2 h-5 w-5 animate-spin" aria-hidden="true" /> מכינים טיוטה חדשה…
    </div>
  )
}
