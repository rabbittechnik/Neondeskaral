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
import { API_BASE, apiGet, apiSend } from '../services/api'
import { useStation } from './station-context'
import { notifyRunningEntriesRefresh } from '../utils/runningEntriesSync'

type TimeTrackingContextValue = {
  timeEntries: TimeEntry[]
  checklists: ShiftCloseChecklist[]
  loading: boolean
  error: string | null
  cardEvents: CashRegisterCardEvent[]
  refetch: () => Promise<void>
  refetchCardEvents: () => Promise<void>
  startShiftForEmployee: (
    cardNumber: string,
    options?: { force?: boolean; startNote?: string },
  ) => Promise<TimeEntry>
  completeShiftWithChecklist: (timeEntryId: string, checklist: ShiftCloseChecklist) => Promise<void>
  /** Nach Terminal-Aktionen Kartenprotokoll aus der API aktualisieren (serverseitig gespeichert). */
  logCardEvent: (ev: Omit<CashRegisterCardEvent, 'id' | 'scannedAt'> & { scannedAt?: string }) => void
}

const TimeTrackingContext = createContext<TimeTrackingContextValue | null>(null)

function mapCardEventRow(r: Record<string, unknown>): CashRegisterCardEvent {
  return {
    id: String(r.id),
    cardNumber: String(r.cardNumber ?? ''),
    employeeId: r.employeeId ? String(r.employeeId) : undefined,
    stationId: String(r.stationId ?? ''),
    actionType: r.actionType === 'check_out' ? 'check_out' : 'check_in',
    scannedAt: String(r.scannedAt ?? ''),
    result: (String(r.result ?? 'success') || 'success') as CashRegisterCardEvent['result'],
    message: String(r.message ?? ''),
  }
}

export function TimeTrackingProvider({ children }: { children: ReactNode }) {
  const { stationId } = useStation()
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cardEvents, setCardEvents] = useState<CashRegisterCardEvent[]>([])

  const refetchCardEvents = useCallback(async () => {
    if (!stationId) {
      setCardEvents([])
      return
    }
    const from = new Date()
    from.setDate(from.getDate() - 14)
    const to = new Date()
    to.setDate(to.getDate() + 1)
    const res = await apiGet<Record<string, unknown>[]>('/time-entries/card-events', {
      stationId,
      from: from.toISOString(),
      to: to.toISOString(),
    })
    if (res.ok && Array.isArray(res.data)) setCardEvents(res.data.map(mapCardEventRow))
    else setCardEvents([])
  }, [stationId])

  const refetch = useCallback(async () => {
    if (!stationId) {
      setTimeEntries([])
      setCardEvents([])
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
    await refetchCardEvents()
    setLoading(false)
  }, [stationId, refetchCardEvents])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const logCardEvent = useCallback(
    (_ev: Omit<CashRegisterCardEvent, 'id' | 'scannedAt'> & { scannedAt?: string }) => {
      void refetchCardEvents()
    },
    [refetchCardEvents],
  )

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
        result?: string
        warnings?: unknown
        requiresWarningAcknowledgement?: boolean
      }
      if (!json.ok) {
        if (json.result === 'shift_warnings_pending') {
          const err = new Error(json.error ?? 'Hinweis aus deiner letzten Schicht: Bitte zuerst bestätigen.')
          ;(err as Error & { code: string; warnings?: unknown }).code = 'shift_warnings_pending'
          ;(err as Error & { code: string; warnings?: unknown }).warnings = json.warnings
          throw err
        }
        throw new Error(json.error ?? 'Check-in fehlgeschlagen')
      }
      const entry = json.data?.timeEntry ?? json.timeEntry
      if (!entry) throw new Error('Keine Zeiterfassung in der Antwort')
      await refetch()
      await refetchCardEvents()
      notifyRunningEntriesRefresh()
      return entry
    },
    [refetch, refetchCardEvents, stationId],
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
      await refetchCardEvents()
      notifyRunningEntriesRefresh()
    },
    [refetch, refetchCardEvents],
  )

  const value = useMemo(
    () => ({
      timeEntries,
      checklists: [] as ShiftCloseChecklist[],
      loading,
      error,
      cardEvents,
      refetch,
      refetchCardEvents,
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
      refetchCardEvents,
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
