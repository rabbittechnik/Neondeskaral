import { useMemo } from 'react'
import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { toISODate } from '../../data/mockSchedule'
import type { ScheduleEmployeeRow } from '../../types/employee'
import { weekDayDates } from './scheduleWeekUtils'
import { DayScheduleRow } from './DayScheduleRow'

type Props = {
  weekMonday: Date
  /** Für Namen, Rolle, Farbe (vollständige Liste empfohlen) */
  employees: ScheduleEmployeeRow[]
  /** Nur anzeigbare Blöcke: keine „Frei“, nur echte Dienste + offene Schichten */
  blocks: ResolvedShiftBlock[]
  onShiftSelect?: (block: ResolvedShiftBlock) => void
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function groupBlocksByDay(blocks: ResolvedShiftBlock[]) {
  const map = new Map<number, ResolvedShiftBlock[]>()
  for (let i = 0; i < 7; i++) map.set(i, [])
  for (const b of blocks) {
    const list = map.get(b.dayIndex)
    if (list) list.push(b)
  }
  return map
}

export function WeeklyScheduleGrid({ weekMonday, employees, blocks, onShiftSelect }: Props) {
  const days = weekDayDates(weekMonday)
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const byDay = useMemo(() => groupBlocksByDay(blocks), [blocks])
  const today = startOfLocalDay(new Date())

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-[var(--text-main)]">
        Schichtplan – Diese Woche
      </h2>
      <div className="space-y-2.5">
        {days.map((dayDate, dayIndex) => (
          <DayScheduleRow
            key={toISODate(dayDate)}
            dayDate={dayDate}
            dayIndex={dayIndex}
            isWeekend={dayIndex >= 5}
            isToday={isSameCalendarDay(startOfLocalDay(dayDate), today)}
            blocks={byDay.get(dayIndex) ?? []}
            employeeById={employeeById}
            onShiftSelect={onShiftSelect}
          />
        ))}
      </div>
    </div>
  )
}
