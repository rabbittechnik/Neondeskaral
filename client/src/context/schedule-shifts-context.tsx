import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ScheduleShift } from '../data/mockSchedule'
import { dayIndexInWeek, seedScheduleWeek, toISODate } from '../data/mockSchedule'
import { startOfWeekMonday } from '../components/schedule/scheduleWeekUtils'

/** StrictMode-sicher: verhindert doppeltes Seeding derselben Woche. */
const seededWeekKeysGlobal = new Set<string>()

type ScheduleShiftsContextValue = {
  shifts: ScheduleShift[]
  setShifts: React.Dispatch<React.SetStateAction<ScheduleShift[]>>
  ensureWeekSeeded: (weekMonday: Date) => void
}

const ScheduleShiftsContext = createContext<ScheduleShiftsContextValue | null>(null)

export function ScheduleShiftsProvider({ children }: { children: ReactNode }) {
  const [shifts, setShifts] = useState<ScheduleShift[]>(() => {
    const mon = startOfWeekMonday(new Date())
    const k = toISODate(mon)
    seededWeekKeysGlobal.add(k)
    return seedScheduleWeek(mon)
  })

  const ensureWeekSeeded = useCallback((weekMonday: Date) => {
    const key = toISODate(weekMonday)
    if (seededWeekKeysGlobal.has(key)) return
    seededWeekKeysGlobal.add(key)
    setShifts((prev) => {
      const has = prev.some((s) => dayIndexInWeek(s.date, weekMonday) !== null)
      if (has) return prev
      return [...prev, ...seedScheduleWeek(weekMonday)]
    })
  }, [])

  const value = useMemo(
    () => ({ shifts, setShifts, ensureWeekSeeded }),
    [shifts, ensureWeekSeeded],
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
