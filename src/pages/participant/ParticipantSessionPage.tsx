import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { PublicUnavailableState } from '../../components/PublicUnavailableState'
import { RepositoryErrorState, RepositoryLoadingState } from '../../components/RepositoryStates'
import { getParticipantSimulationByToken } from '../../services/participantSimulationService'
import { useRepositoryQuery } from '../../hooks/useRepositoryQuery'
import { useSimulationRepository } from '../../repositories/SimulationRepositoryProvider'
import { LiveConversationPanel } from './LiveConversationPanel'
import { MockConversationPanel } from './MockConversationPanel'

export function ParticipantSessionPage() {
  const { publicToken = '' } = useParams()
  const [searchParams] = useSearchParams()
  const repository = useSimulationRepository()
  const sessionId = searchParams.get('session') ?? ''
  const query = useRepositoryQuery(async () => {
    const [publicResult, session] = await Promise.all([
      getParticipantSimulationByToken(repository, publicToken),
      repository.getSession(sessionId),
    ])
    return { publicResult, session }
  }, [repository, publicToken, sessionId])
  const publicResult = query.data?.publicResult
  const session = query.data?.session

  if (query.isLoading && !query.data) return <RepositoryLoadingState label="טוענים את הניסיון…" />
  if (query.error) return <RepositoryErrorState error={query.error} onRetry={query.reload} />
  if (!publicResult) return <PublicUnavailableState reason="not_found" />
  if (publicResult.state === 'unavailable') return <PublicUnavailableState reason={publicResult.reason} />
  if (!session || session.publicToken !== publicToken) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-[#dce5e1] bg-white p-10 text-center">
        <h1 className="text-2xl font-bold">לא נמצא ניסיון פעיל</h1>
        <p className="mt-3 leading-7 text-[#60756f]">אפשר לחזור לקישור שקיבלת ולהתחיל את הסימולציה מחדש.</p>
      </div>
    )
  }
  if (session.status === 'completed') {
    return <Navigate to={`/simulation/${publicToken}/complete?session=${session.id}`} replace />
  }

  const panelProps = { session, simulation: publicResult.simulation, publicToken }
  return repository.provider === 'supabase'
    ? <LiveConversationPanel {...panelProps} />
    : <MockConversationPanel {...panelProps} />
}
