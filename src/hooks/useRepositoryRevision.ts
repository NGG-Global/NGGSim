import { useEffect, useState } from 'react'
import { STORAGE_CHANGED_EVENT } from '../repositories/localSimulationRepository'

export function useRepositoryRevision(): number {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener(STORAGE_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(STORAGE_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return revision
}
