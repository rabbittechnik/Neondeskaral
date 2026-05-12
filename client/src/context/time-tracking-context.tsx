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
import { DEFAULT_TABLET_STATION_ID } from '../data/station'
import { createCardEventId } from '../data/mockTimeTracking'
import { API_BASE, apiGet, apiSend } from '../services/api'
import { useStation } from './station-context'

type TimeTrackingContextValue = {
  timeEntries: TimeEntry[]
  checklists: ShiftCloseChecklist[]
  loading: boolean
  error: string | null
  cardEvents: CashRegisterCardEvent[]
  refetch: () => Promise<void>
  startShiftForEmployee: (
    cardNumber: string,
    options?: { force?: boolean; startNote?: string },
  ) => Promise<TimeEntry>
  completeShiftWithChecklist: (timeEntryId: string, checklist: ShiftCloseChecklist) => Promise<void>
  logCardEvent: (ev: Omit<CashRegisterCardEvent, 'id' | 'scannedAt'> & { scannedAt?: string }) => void
}

const TimeTrackingContext = createContext<TimeTrackingContextValue | null>(null)

export function TimeTrackingProvider({ children }: { children: ReactNode }) {
  const { stationId } = useStation()
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cardEvents, setCardEvents] = useState<CashRegisterCardEvent[]>([])

  const refetch = useCallback(async () => {
    if (!stationId) {
      setTimeEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const res = await apiGet<TimeEntry[]>('/time-entries', {
      stationId,
      from: '2025-01-01T00:00:00.000Z',
      to: '2028-12-31T23:59:59.999Z',
    })
    if (res.ok && Array.isArray(res.data)) setTimeEntries(res.data)
    else {
      setTimeEntries([])
      if (!res.ok) setError(res.error)
    }
    setLoading(false)
  }, [stationId])

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
    async (cardNumber: string, options?: { force?: boolean; startNote?: string }) => {
      const card = cardNumber.trim()
      if (!card) throw new Error('Kartennummer fehlt')
      const sid = stationId ?? DEFAULT_TABLET_STATION_ID
      const res = await fetch(`${API_BASE}/terminal/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: card,
          stationId: sid,
          force: Boolean(options?.force),
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        data?: { timeEntry?: TimeEntry }
        error?: string
        timeEntry?: TimeEntry
      }
      if (!json.ok) {
        throw new Error(json.error ?? 'Check-in fehlgeschlagen')
      }
      const entry = json.data?.timeEntry ?? json.timeEntry
      if (!entry) throw new Error('Keine Zeiterfassung in der Antwort')
      await refetch()
      return entry
    },
    [refetch, stationId],
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
