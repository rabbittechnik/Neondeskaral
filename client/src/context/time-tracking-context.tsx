import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CashRegisterCardEvent, ShiftCloseChecklist, TimeEntry } from '../types/timeTracking'
import { STATION } from '../data/station'
import { createCardEventId } from '../data/mockTimeTracking'
import { apiGet, apiSend } from '../services/api'

type TimeTrackingContextValue = {
  timeEntries: TimeEntry[]
  checklists: ShiftCloseChecklist[]
  loading: boolean
  error: string | null
  cardEvents: CashRegisterCardEvent[]
  refetch: () => Promise<void>
  startShiftForEmployee: (employeeId: string, startNote?: string) => Promise<TimeEntry>
  completeShiftWithChecklist: (timeEntryId: string, checklist: ShiftCloseChecklist) => Promise<void>
  logCardEvent: (ev: Omit<CashRegisterCardEvent, 'id' | 'scannedAt'> & { scannedAt?: string }) => void
}

const TimeTrackingContext = createContext<TimeTrackingContextValue | null>(null)

const TERMINAL_USER = 'Terminal'

export function TimeTrackingProvider({ children }: { children: ReactNode }) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cardEvents, setCardEvents] = useState<CashRegisterCardEvent[]>([])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await apiGet<TimeEntry[]>('/time-entries', {
      stationId: STATION.id,
      from: '2025-01-01T00:00:00.000Z',
      to: '2028-12-31T23:59:59.999Z',
    })
    if (res.ok && Array.isArray(res.data)) setTimeEntries(res.data)
    else {
      setTimeEntries([])
      if (!res.ok) setError(res.error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const logCardEvent = useCallback((ev: Omit<CashRegisterCardEvent, 'id' | 'scannedAt'> & { scannedAt?: string }) => {
    const row: CashRegisterCardEvent = {
      ...ev,
      id: createCardEventId(),
      scannedAt: ev.scannedAt ?? new Date().toISOString(),
    }
    setCardEvents((prev) => [row, ...prev].slice(0, 200))
  }, [])

  const startShiftForEmployee = useCallback(
    async (employeeId: string, startNote?: string) => {
      const now = new Date().toISOString()
      const res = await apiSend<TimeEntry>('POST', '/time-entries/manual', {
        employeeId,
        startAt: now,
        status: 'running',
        source: 'tablet',
        startedBy: TERMINAL_USER,
        startNote,
      })
      if (!res.ok || !res.data) throw new Error(res.ok === false ? res.error : 'Check-in fehlgeschlagen')
      await refetch()
      return res.data as TimeEntry
    },
    [refetch],
  )

  const completeShiftWithChecklist = useCallback(
    async (timeEntryId: string, checklist: ShiftCloseChecklist) => {
      const body = {
        timeEntryId,
        checklist: {
          fridgeFronted: checklist.fridgeFronted,
          drinksFilled: checklist.drinksFilled,
          cigarettesFilled: checklist.cigarettesFilled,
          shelvesFilled: checklist.shelvesFilled,
          trashEmptied: checklist.trashEmptied,
          counterClean: checklist.counterClean,
          coffeeAreaClean: checklist.coffeeAreaClean,
          outsideChecked: checklist.outsideChecked,
          incidentsNoted: checklist.incidentsNoted,
          handoverPossible: checklist.handoverPossible,
          closingReady: checklist.closingReady,
          everythingOk: checklist.everythingOk,
          incidentNote: checklist.incidentNote,
        },
      }
      const res = await apiSend<TimeEntry>('POST', '/terminal/check-out-complete', body)
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const value = useMemo(
    () => ({
      timeEntries,
      checklists: [] as ShiftCloseChecklist[],
      loading,
      error,
      cardEvents,
      refetch,
      startShiftForEmployee,
      completeShiftWithChecklist,
      logCardEvent,
    }),
    [
      timeEntries,
      loading,
      error,
      cardEvents,
      refetch,
      startShiftForEmployee,
      completeShiftWithChecklist,
      logCardEvent,
    ],
  )

  return <TimeTrackingContext.Provider value={value}>{children}</TimeTrackingContext.Provider>
}

export function useTimeTracking(): TimeTrackingContextValue {
  const ctx = useContext(TimeTrackingContext)
  if (!ctx) throw new Error('useTimeTracking must be used within TimeTrackingProvider')
  return ctx
}

export { createChecklistId } from '../data/mockTimeTracking'
