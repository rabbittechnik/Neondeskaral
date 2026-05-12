import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ScheduleShift } from '../data/mockSchedule'
import { toISODate } from '../data/mockSchedule'
import { addDays, startOfWeekMonday } from '../components/schedule/scheduleWeekUtils'
import { apiGet, apiSend } from '../services/api'
import { useStation } from './station-context'

type ScheduleShiftsContextValue = {
  shifts: ScheduleShift[]
  loading: boolean
  error: string | null
  setShifts: React.Dispatch<React.SetStateAction<ScheduleShift[]>>
  ensureWeekSeeded: (weekMonday: Date) => void
  refetchRange: (fromIso: string, toIso: string) => Promise<void>
}

const ScheduleShiftsContext = createContext<ScheduleShiftsContextValue | null>(null)

function mergeById(prev: ScheduleShift[], incoming: ScheduleShift[]): ScheduleShift[] {
  const map = new Map(prev.map((s) => [s.id, s]))
  for (const s of incoming) {
    map.set(s.id, s)
  }
  return [...map.values()]
}

export function ScheduleShiftsProvider({ children }: { children: ReactNode }) {
  const { stationId } = useStation()
  const [shifts, setShifts] = useState<ScheduleShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetchRange = useCallback(
    async (fromIso: string, toIso: string) => {
      if (!stationId) return
      setError(null)
      const res = await apiGet<ScheduleShift[]>('/shifts', {
        stationId,
        from: fromIso,
        to: toIso,
      })
      if (!res.ok || !Array.isArray(res.data)) {
        setError(res.ok === false ? res.error : 'Schichten konnten nicht geladen werden.')
        return
      }
      setShifts((prev) => mergeById(prev, res.data as ScheduleShift[]))
    },
    [stationId],
  )

  useEffect(() => {
    const boot = async () => {
      setLoading(true)
      if (!stationId) {
        setShifts([])
        setLoading(false)
        return
      }
      const base = startOfWeekMonday(new Date())
      const from = toISODate(addDays(base, -14))
      const to = toISODate(addDays(base, 56))
      await refetchRange(from, to)
      setLoading(false)
    }
    void boot()
  }, [refetchRange, stationId])

  const ensureWeekSeeded = useCallback(
    (weekMonday: Date) => {
      const from = toISODate(weekMonday)
      const to = toISODate(addDays(weekMonday, 6))
      void refetchRange(from, to)
    },
    [refetchRange],
  )

  const value = useMemo(
    () => ({
      shifts,
      loading,
      error,
      setShifts,
      ensureWeekSeeded,
      refetchRange,
    }),
    [shifts, loading, error, ensureWeekSeeded, refetchRange],
  )

  return (
    <ScheduleShiftsContext.Provider value={value}>{children}</ScheduleShiftsContext.Provider>
  )
}

export function useScheduleShifts(): ScheduleShiftsContextValue {
  const ctx = useContext(ScheduleShiftsContext)
  if (!ctx) {
    throw new Error('useScheduleShifts must be used within ScheduleShiftsProvider')
  }
  return ctx
}

export async function persistShiftUpsert(
  shift: ScheduleShift,
  stationId: string,
): Promise<ScheduleShift | undefined> {
  const exists = await apiGet<ScheduleShift>(`/shifts/${encodeURIComponent(shift.id)}`)
  if (exists.ok && exists.data) {
    const res = await apiSend<ScheduleShift>('PUT', `/shifts/${encodeURIComponent(shift.id)}`, shift)
    return res.ok && res.data ? (res.data as ScheduleShift) : undefined
  }
  const res = await apiSend<ScheduleShift>('POST', '/shifts', shift, { stationId })
  return res.ok && res.data ? (res.data as ScheduleShift) : undefined
}

export async function persistShiftDelete(id: string): Promise<boolean> {
  const res = await apiSend('DELETE', `/shifts/${encodeURIComponent(id)}`)
  return res.ok
}
