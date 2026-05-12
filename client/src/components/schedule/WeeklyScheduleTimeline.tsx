import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { toISODate } from '../../data/mockSchedule'
import type { ScheduleEmployeeRow } from '../../types/employee'
import { weekDayDates } from './scheduleWeekUtils'
import { DayTimelineRow } from './DayTimelineRow'
import { ScheduleTimelineLegend } from './ScheduleTimelineLegend'
import {
  DEFAULT_TIMELINE_DAY_END,
  DEFAULT_TIMELINE_DAY_START,
} from '../../utils/scheduleTimeline'
import type { GermanState } from '../../data/germanHolidays'
import { STATION_FEDERAL_STATE } from '../../data/station'
import type { ScheduleTimelineVariant } from './timelineLayout'
import type { WeekTimelineEditBridge } from './scheduleTimelineEditTypes'

type Props = {
  weekMonday: Date
  employees: ScheduleEmployeeRow[]
  blocks: ResolvedShiftBlock[]
  onShiftSelect?: (block: ResolvedShiftBlock) => void
  timelineDayStart?: string
  timelineDayEnd?: string
  /** Bundesland der Station für Feiertagsanzeige (Default: Station aus Dummy-Daten) */
  stationFederalState?: GermanState
  variant?: ScheduleTimelineVariant
  /** Vollansicht: Überschrift „Schichtplan – Diese Woche“ oberhalb */
  showTitle?: boolean
  showLegend?: boolean
  /** Kompakt: Link zur Schichtplan-Seite */
  showFooterLink?: boolean
  /** Drag & Drop / Resize (Schichtplan + Dashboard, wenn shiftEdit gesetzt) */
  shiftEdit?: WeekTimelineEditBridge
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

export function WeeklyScheduleTimeline({
  weekMonday,
  employees,
  blocks,
  onShiftSelect,
  timelineDayStart = DEFAULT_TIMELINE_DAY_START,
  timelineDayEnd = DEFAULT_TIMELINE_DAY_END,
  variant = 'full',
  showTitle,
  showLegend,
  showFooterLink,
  stationFederalState = STATION_FEDERAL_STATE,
  shiftEdit,
}: Props) {
  const days = weekDayDates(weekMonday)
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const byDay = useMemo(() => groupBlocksByDay(blocks), [blocks])
  const today = startOfLocalDay(new Date())

  const resolvedShowTitle = showTitle ?? variant === 'full'
  const resolvedShowLegend = showLegend ?? variant === 'full'
  const resolvedFooter = showFooterLink ?? variant === 'compact'

  return (
    <div className={variant === 'full' ? 'space-y-3' : 'space-y-2'}>
      {resolvedShowTitle ? (
        <h2 className="text-sm font-semibold tracking-tight text-[var(--text-main)]">
          Schichtplan – Diese Woche
        </h2>
      ) : null}
      {resolvedShowLegend ? <ScheduleTimelineLegend variant={variant} /> : null}
      <div className={variant === 'full' ? 'space-y-2.5' : 'space-y-2'}>
        {days.map((dayDate, dayIndex) => (
          <DayTimelineRow
            key={toISODate(dayDate)}
            dayDate={dayDate}
            dayIndex={dayIndex}
            isWeekend={dayIndex >= 5}
            isToday={isSameCalendarDay(startOfLocalDay(dayDate), today)}
            blocks={byDay.get(dayIndex) ?? []}
            employeeById={employeeById}
            dayStart={timelineDayStart}
            dayEnd={timelineDayEnd}
            variant={variant}
            stationFederalState={stationFederalState}
            onShiftSelect={onShiftSelect}
            shiftEdit={shiftEdit}
          />
        ))}
      </div>
      {resolvedFooter ? (
        <div className="flex justify-end border-t border-white/10 pt-3">
          <Link
            to="/schedule"
            className="text-sm font-medium text-cyan-300/95 underline-offset-4 transition hover:text-cyan-200 hover:underline"
          >
            Vollständigen Schichtplan öffnen →
          </Link>
        </div>
      ) : null}
    </div>
  )
}
