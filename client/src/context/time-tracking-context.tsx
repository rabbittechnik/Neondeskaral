import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import type { CashRegisterCardEvent, ShiftCloseChecklist, TimeEntry } from '../types/timeTracking'
import { STATION } from '../data/station'
import {
  cloneSeedChecklists,
  cloneSeedTimeEntries,
  createCardEventId,
  createTimeEntryId,
} from '../data/mockTimeTracking'
import { closeTimeEntryWithChecklist as applyClose } from '../utils/timeTrackingUtils'

type TrackingState = {
  timeEntries: TimeEntry[]
  checklists: ShiftCloseChecklist[]
}

type Action =
  | { type: 'start'; entry: TimeEntry }
  | { type: 'complete'; timeEntryId: string; checklist: ShiftCloseChecklist; endAt: string }

const TERMINAL_USER = 'Terminal'

function reducer(state: TrackingState, action: Action): TrackingState {
  switch (action.type) {
    case 'start':
      return { ...state, timeEntries: [...state.timeEntries, action.entry] }
    case 'complete': {
      const { entries, checklists } = applyClose(
        state.timeEntries,
        state.checklists,
        action.timeEntryId,
        action.checklist,
        action.endAt,
        TERMINAL_USER,
      )
      return { timeEntries: entries, checklists }
    }
    default:
      return state
  }
}

const initialTracking: TrackingState = {
  timeEntries: cloneSeedTimeEntries(),
  checklists: cloneSeedChecklists(),
}

type TimeTrackingContextValue = {
  timeEntries: TimeEntry[]
  checklists: ShiftCloseChecklist[]
  cardEvents: CashRegisterCardEvent[]
  startShiftForEmployee: (employeeId: string, startNote?: string) => TimeEntry
  completeShiftWithChecklist: (timeEntryId: string, checklist: ShiftCloseChecklist) => void
  logCardEvent: (ev: Omit<CashRegisterCardEvent, 'id' | 'scannedAt'> & { scannedAt?: string }) => void
}

const TimeTrackingContext = createContext<TimeTrackingContextValue | null>(null)

export function TimeTrackingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialTracking)
  const [cardEvents, setCardEvents] = useState<CashRegisterCardEvent[]>([])

  const logCardEvent = useCallback((ev: Omit<CashRegisterCardEvent, 'id' | 'scannedAt'> & { scannedAt?: string }) => {
    const row: CashRegisterCardEvent = {
      ...ev,
      id: createCardEventId(),
      scannedAt: ev.scannedAt ?? new Date().toISOString(),
    }
    setCardEvents((prev) => [row, ...prev].slice(0, 200))
  }, [])

  const startShiftForEmployee = useCallback((employeeId: string, startNote?: string) => {
    const now = new Date().toISOString()
    const entry: TimeEntry = {
      id: createTimeEntryId(),
      employeeId,
      stationId: STATION.id,
      startAt: now,
      breakMinutes: 0,
      status: 'running',
      source: 'cash_register_card_terminal',
      startedBy: TERMINAL_USER,
      startNote,
      createdAt: now,
      updatedAt: now,
    }
    dispatch({ type: 'start', entry })
    return entry
  }, [])

  const completeShiftWithChecklist = useCallback((timeEntryId: string, checklist: ShiftCloseChecklist) => {
    dispatch({
      type: 'complete',
      timeEntryId,
      checklist,
      endAt: new Date().toISOString(),
    })
  }, [])

  const value = useMemo(
    () => ({
      timeEntries: state.timeEntries,
      checklists: state.checklists,
      cardEvents,
      startShiftForEmployee,
      completeShiftWithChecklist,
      logCardEvent,
    }),
    [state.timeEntries, state.checklists, cardEvents, startShiftForEmployee, completeShiftWithChecklist, logCardEvent],
  )

  return <TimeTrackingContext.Provider value={value}>{children}</TimeTrackingContext.Provider>
}

export function useTimeTracking(): TimeTrackingContextValue {
  const ctx = useContext(TimeTrackingContext)
  if (!ctx) throw new Error('useTimeTracking must be used within TimeTrackingProvider')
  return ctx
}

export { createChecklistId } from '../data/mockTimeTracking'
