import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

export interface RepositoryQueryState<T> {
  data: T | undefined
  error: Error | null
  isLoading: boolean
  reload: () => void
}

export function useRepositoryQuery<T>(
  load: () => Promise<T>,
  dependencies: DependencyList,
): RepositoryQueryState<T> {
  const loadRef = useRef(load)
  loadRef.current = load
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const reload = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)
    loadRef.current()
      .then((value) => {
        if (active) setData(value)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason : new Error('לא הצלחנו לטעון את הנתונים.'))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
    // dependencies are supplied explicitly by the caller; loadRef avoids render loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision])

  return { data, error, isLoading, reload }
}

