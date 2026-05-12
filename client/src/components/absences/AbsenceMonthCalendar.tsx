import { useMemo } from 'react'
import type { Absence } from '../../types/absence'
import type { Employee } from '../../types/employee'
import { addDays, startOfWeekMonday } from '../schedule/scheduleWeekUtils'
import { toISODate } from '../../data/mockSchedule'
import { getAbsencesForDate } from '../../utils/absenceQueries'
import { formatHolidayBadge } from '../../utils/holidayUtils'
import type { GermanState } from '../../data/germanHolidays'
import { AbsenceCalendarEntry } from './AbsenceCalendarEntry'

const MONTH_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

const WEEKDAY_DE_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

type Props = {
  anchorMonth: Date
  absences: Absence[]
  employeesById: Map<string, Employee>
  federalState: GermanState
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function isToday(d: Date): boolean {
  const t = startOfDay(new Date())
  const x = startOfDay(d)
  return t.getTime() === x.getTime()
}

export function AbsenceMonthCalendar({ anchorMonth, absences, employeesById, federalState }: Props) {
  const y = anchorMonth.getFullYear()
  const m = anchorMonth.getMonth()
  const cells = useMemo(() => {
    const firstOfMonth = new Date(y, m, 1)
    const gridStart = startOfWeekMonday(firstOfMonth)
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [y, m])

  const title = `${MONTH_DE[m]} ${y}`

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <p className="mb-3 text-center text-sm font-semibold text-[var(--text-main)]">{title}</p>
        <div className="grid grid-cols-7 gap-px rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--border-subtle)]">
          {WEEKDAY_DE_SHORT.map((w) => (
            <div
              key={w}
              className="bg-[var(--bg-elevated)] px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
            >
              {w}
            </div>
          ))}
          {cells.map((d) => {
            const iso = toISODate(d)
            const inMonth = isSameMonth(d, anchorMonth)
            const weekend = d.getDay() === 0 || d.getDay() === 6
            const today = isToday(d)
            const dayAbs = getAbsencesForDate(absences, iso)
            const hb = formatHolidayBadge(iso, federalState, { variant: 'compact' })
            const holidayStrong = hb.severity === 'strong'
            const holidaySoft = hb.severity === 'soft'

            return (
              <div
                key={iso}
                className={`min-h-[100px] border border-transparent bg-[var(--bg-card)] p-1 sm:min-h-[110px] ${
                  !inMonth ? 'opacity-40' : ''
                } ${weekend && inMonth ? 'bg-violet-950/15' : ''} ${
                  today ? 'ring-2 ring-cyan-400/50 ring-inset' : ''
                } ${holidayStrong ? 'bg-[var(--holiday-red-soft)] ring-1 ring-[var(--holiday-red-border)]' : ''} ${
                  holidaySoft && !holidayStrong ? 'bg-[var(--holiday-other-soft)]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${inMonth ? 'text-[var(--text-main)]' : 'text-[var(--text-faint)]'}`}
                  >
                    {d.getDate()}.
                  </span>
                </div>
                {hb.severity !== 'none' ? (
                  <p
                    className={`mt-0.5 truncate text-[8px] font-medium leading-tight ${
                      holidayStrong ? 'text-[var(--holiday-red)]' : 'text-[var(--holiday-other)]'
                    }`}
                    title={hb.subLabel ? `${hb.label} · ${hb.subLabel}` : hb.label}
                  >
                    {hb.label}
                    {hb.subLabel ? ` · ${hb.subLabel}` : ''}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-col gap-0.5">
                  {dayAbs.slice(0, 3).map((a) => (
                    <AbsenceCalendarEntry
                      key={a.id}
                      absence={a}
                      employee={employeesById.get(a.employeeId)}
                      compact
                    />
                  ))}
                  {dayAbs.length > 3 ? (
                    <span className="text-[8px] text-[var(--text-faint)]">+{dayAbs.length - 3}</span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
