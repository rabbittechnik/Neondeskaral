import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { WorkArea } from '../data/mockSchedule'
import type { WorkAreaDefinition } from '../types/employee'
import { apiGet } from '../services/api'
import { useStation } from './station-context'
import { workAreasScheduleCompat } from '../data/mockEmployees'

type WorkAreasContextValue = {
  /** Schichtplan-kompatibel: id, shortCode, label */
  workAreas: WorkArea[]
  definitions: WorkAreaDefinition[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const WorkAreasContext = createContext<WorkAreasContextValue | null>(null)

function toCompat(defs: WorkAreaDefinition[]): WorkArea[] {
  return defs.map((w) => ({ id: w.id, shortCode: w.shortCode, label: w.name }))
}

export function WorkAreasProvider({ children }: { children: ReactNode }) {
  const { stationId } = useStation()
  const [definitions, setDefinitions] = useState<WorkAreaDefinition[]>(() =>
    workAreasScheduleCompat.map((w) => ({
      id: w.id,
      name: w.label,
      shortCode: w.shortCode,
      color: '#94a3b8',
    })),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!stationId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const res = await apiGet<WorkAreaDefinition[]>('/work-areas', { stationId })
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      setDefinitions(res.data)
    } else if (!res.ok) {
      setError(res.error || 'Arbeitsbereiche konnten nicht geladen werden.')
    }
    setLoading(false)
  }, [stationId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const workAreas = useMemo(() => toCompat(definitions), [definitions])

  const value = useMemo(
    () => ({
      workAreas,
      definitions,
      loading,
      error,
      refetch,
    }),
    [workAreas, definitions, loading, error, refetch],
  )

  return <WorkAreasContext.Provider value={value}>{children}</WorkAreasContext.Provider>
}

export function useWorkAreas(): WorkAreasContextValue {
  const ctx = useContext(WorkAreasContext)
  if (!ctx) throw new Error('useWorkAreas must be used within WorkAreasProvider')
  return ctx
}
