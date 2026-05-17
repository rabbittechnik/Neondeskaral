import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ScheduleShift } from '../data/mockSchedule'
import { toISODate } from '../data/mockSchedule'
import { addDays, calendarMonthRangeForDate, startOfWeekMonday } from '../components/schedule/scheduleWeekUtils'
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

/** Ersetzt nur den abgefragten Datumsbereich, Rest des Caches bleibt (gleiche Station). */
function mergeShiftsForDateRange(
  prev: ScheduleShift[],
  incoming: ScheduleShift[],
  fromIso: string,
  toIso: string,
): ScheduleShift[] {
  const kept = prev.filter((s) => s.date < fromIso || s.date > toIso)
  return mergeById(kept, incoming)
}

export function ScheduleShiftsProvider({ children }: { children: ReactNode }) {
  const { stationId } = useStation()
  const stationIdRef = useRef(stationId)
  stationIdRef.current = stationId

  const [shifts, setShifts] = useState<ScheduleShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setShifts([])
    setError(null)
    setLoading(true)
  }, [stationId])

  const refetchRange = useCallback(
    async (fromIso: string, toIso: string) => {
      const sid = stationId
      if (!sid) return
      setError(null)
      const res = await apiGet<ScheduleShift[]>('/shifts', {
        stationId: sid,
        from: fromIso,
        to: toIso,
      })
      if (stationIdRef.current !== sid) return
      if (!res.ok || !Array.isArray(res.data)) {
        setError(res.ok === false ? res.error : 'Schichten konnten nicht geladen werden.')
        return
      }
      setShifts((prev) => mergeShiftsForDateRange(prev, res.data as ScheduleShift[], fromIso, toIso))
    },
    [stationId],
  )

  useEffect(() => {
    const boot = async () => {
      if (!stationId) {
        setLoading(false)
        return
      }
      setLoading(true)
      const base = startOfWeekMonday(new Date())
      const from = toISODate(addDays(base, -7))
      const to = toISODate(addDays(base, 27))
      await refetchRange(from, to)
      if (stationIdRef.current === stationId) setLoading(false)
    }
    void boot()
  }, [stationId, refetchRange])

  const ensureWeekSeeded = useCallback(
    (weekMonday: Date) => {
      const { fromYmd, toYmd } = calendarMonthRangeForDate(weekMonday)
      void refetchRange(fromYmd, toYmd)
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

/** Teilupdate: aktuelle Schicht laden, mit Patch mergen, PUT. */
export async function persistShiftPatch(
  id: string,
  patch: Partial<ScheduleShift> & { updatedBy?: string },
): Promise<ScheduleShift | undefined> {
  const exists = await apiGet<ScheduleShift>(`/shifts/${encodeURIComponent(id)}`)
  if (!exists.ok || !exists.data) return undefined
  const merged = { ...exists.data, ...patch }
  const res = await apiSend<ScheduleShift>('PUT', `/shifts/${encodeURIComponent(id)}`, merged)
  return res.ok && res.data ? (res.data as ScheduleShift) : undefined
}

export async function persistShiftDelete(id: string): Promise<boolean> {
  const res = await apiSend('DELETE', `/shifts/${encodeURIComponent(id)}`)
  return res.ok
}

export type BulkCreateShiftsResult = {
  created: ScheduleShift[]
  skipped: { date: string; reason: string }[]
  errors: { date: string; message: string }[]
}

/** Mehrere Schichten (gleiche Zeiten/Typ) — werden als Entwurf angelegt. */
export async function persistShiftsBulk(
  body: {
    dates: string[]
    employeeId?: string
    workAreaId: string
    startTime: string
    endTime: string
    breakMinutes: number
    shiftType: string
    note?: string
    conflict?: boolean
  },
  stationId: string,
): Promise<BulkCreateShiftsResult | undefined> {
  const res = await apiSend<BulkCreateShiftsResult>('POST', '/shifts/bulk', body, { stationId })
  return res.ok && res.data ? (res.data as BulkCreateShiftsResult) : undefined
}
