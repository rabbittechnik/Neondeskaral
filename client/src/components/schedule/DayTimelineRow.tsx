import { useMemo } from 'react'
import { CalendarRange, UserX } from 'lucide-react'
import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { toISODate } from '../../data/mockSchedule'
import type { GermanState } from '../../data/germanHolidays'
import type { ScheduleEmployeeRow } from '../../types/employee'
import { formatHolidayBadge } from '../../utils/holidayUtils'
import { formatDayMonthDot, WEEKDAY_LABELS_LONG } from './scheduleWeekUtils'
import { DEFAULT_EMPLOYEE_SHIFT_ACCENT } from './scheduleDayUtils'
import {
  buildTimelineTicks,
  groupShiftsIntoRows,
  sumShiftHoursForDay,
  timeToMinutes,
} from '../../utils/scheduleTimeline'
import { TimelineHeader } from './TimelineHeader'
import { OpenShiftBlock } from './OpenShiftBlock'
import { TimelineShiftBlock } from './TimelineShiftBlock'
import type { ScheduleTimelineVariant } from './timelineLayout'
import { getTimelineLayout } from './timelineLayout'
import { useAbsences } from '../../context/absences-context'
import { useEmployees } from '../../context/employees-context'
import { getAbsencesForDate } from '../../utils/absenceQueries'
import { ABSENCE_TYPE_LABELS } from '../absences/absenceLabels'

type Props = {
  dayDate: Date
  dayIndex: number
  isWeekend: boolean
  isToday: boolean
  blocks: ResolvedShiftBlock[]
  employeeById: Map<string, ScheduleEmployeeRow>
  dayStart: string
  dayEnd: string
  variant?: ScheduleTimelineVariant
  /** Bundesland der Station (z. B. BW) für Feiertagslogik */
  stationFederalState: GermanState
  onShiftSelect?: (block: ResolvedShiftBlock) => void
}

export function DayTimelineRow({
  dayDate,
  dayIndex,
  isWeekend,
  isToday,
  blocks,
  employeeById,
  dayStart,
  dayEnd,
  variant = 'full',
  stationFederalState,
  onShiftSelect,
}: Props) {
  const layout = getTimelineLayout(variant)
  const weekday = WEEKDAY_LABELS_LONG[dayIndex] ?? ''
  const dateIso = useMemo(() => toISODate(dayDate), [dayDate])
  const { absences } = useAbsences()
  const { employees } = useEmployees()
  const approvedDayAbsences = useMemo(
    () => getAbsencesForDate(absences, dateIso, { statuses: ['genehmigt'] }),
    [absences, dateIso],
  )
  const vacationAbsences = useMemo(
    () => approvedDayAbsences.filter((a) => a.type === 'urlaub'),
    [approvedDayAbsences],
  )
  const absenceStripH = 17
  const absenceStripGap = 4

  const absenceSummaryLine = useMemo(() => {
    if (approvedDayAbsences.length === 0) return ''
    const parts = approvedDayAbsences.map((a) => {
      const name = employees.find((e) => e.id === a.employeeId)?.displayName ?? a.employeeId
      return `${name} (${ABSENCE_TYPE_LABELS[a.type]})`
    })
    return parts.join(' · ')
  }, [approvedDayAbsences, employees])

  const holidayBadge = useMemo(
    () => formatHolidayBadge(dateIso, stationFederalState, { variant }),
    [dateIso, stationFederalState, variant],
  )

  const ticks = useMemo(
    () => buildTimelineTicks(dayStart, dayEnd, layout.tickStepMinutes),
    [dayStart, dayEnd, layout.tickStepMinutes],
  )
  const ds = timeToMinutes(dayStart)
  const de = timeToMinutes(dayEnd)
  const span = Math.max(1, de - ds)

  const rowItems = useMemo(
    () => groupShiftsIntoRows(blocks, dayStart, dayEnd),
    [blocks, dayStart, dayEnd],
  )

  const maxRowIndex = layout.maxVisibleShiftRowIndex
  const visibleRowItems = useMemo(
    () => rowItems.filter((i) => i.row <= maxRowIndex),
    [rowItems, maxRowIndex],
  )
  const hiddenShiftCount = rowItems.length - visibleRowItems.length

  const maxVisibleRow = useMemo(() => {
    if (visibleRowItems.length === 0) return -1
    return Math.max(...visibleRowItems.map((r) => r.row))
  }, [visibleRowItems])

  const headerOffsetPx = layout.trackPadTop

  const shiftAreaHeight =
    visibleRowItems.length === 0
      ? Math.max(40, layout.blockHeight + 8)
      : headerOffsetPx + (maxVisibleRow + 1) * (layout.blockHeight + layout.rowGap)

  const absenceTracksH =
    vacationAbsences.length > 0
      ? vacationAbsences.length * (absenceStripH + absenceStripGap) + 6
      : 0

  const trackBodyHeightPx = shiftAreaHeight + absenceTracksH

  const moreRowHeight = hiddenShiftCount > 0 ? 22 : 0
  const trackHeightPx = trackBodyHeightPx + moreRowHeight

  const summaryHours = sumShiftHoursForDay(blocks)
  const summaryStr = summaryHours.toFixed(2).replace('.', ',')

  const hStrong = holidayBadge.severity === 'strong'
  const hSoft = holidayBadge.severity === 'soft'

  const outerSurface =
    hStrong || hSoft
      ? hStrong
        ? 'holiday-day--strong'
        : 'holiday-day--soft'
      : isWeekend
        ? 'bg-violet-950/25 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.12)]'
        : 'bg-[var(--bg-card)]'

  const leftRail =
    hStrong ? 'holiday-left-rail--strong' : hSoft ? 'holiday-left-rail--soft' : ''

  const trackHoliday =
    hStrong ? 'holiday-timeline-track--strong' : hSoft ? 'holiday-timeline-track--soft' : ''

  const badgeLine =
    holidayBadge.severity !== 'none' && holidayBadge.subLabel
      ? `${holidayBadge.label} · ${holidayBadge.subLabel}`
      : holidayBadge.severity !== 'none'
        ? holidayBadge.label
        : ''

  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--border-subtle)] ${outerSurface}`}
    >
      <div
        className={`flex flex-col lg:flex-row lg:items-stretch ${layout.dayOuterPadding} ${layout.dayInnerGap}`}
      >
        <div
          className={`flex shrink-0 flex-col gap-0.5 rounded-l-[calc(var(--radius-md)-2px)] pl-2 lg:pl-3 ${layout.leftColClass} ${leftRail}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-[var(--text-main)] ${layout.dayLabelClass}`}>
              {weekday} {formatDayMonthDot(dayDate)}
            </h3>
            {isToday ? (
              <span className="rounded-full border border-cyan-400/45 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200 sm:text-[10px]">
                Heute
              </span>
            ) : null}
            {holidayBadge.severity !== 'none' ? (
              <CalendarRange
                className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${hStrong ? 'text-[var(--holiday-red)]' : 'text-[var(--holiday-other)]'}`}
                aria-hidden
              />
            ) : null}
          </div>

          {badgeLine ? (
            <div
              className={`mt-1 w-fit max-w-full rounded-md px-2 py-1 text-left ${holidayBadge.colorClass} ${variant === 'compact' ? 'text-[10px] leading-snug' : 'text-[11px] leading-snug'}`}
            >
              <span className="font-semibold">{badgeLine}</span>
              {holidayBadge.note ? (
                <p className="mt-1 border-t border-white/10 pt-1 text-[9px] font-normal text-[var(--text-muted)]">
                  {holidayBadge.note}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className={`text-[var(--text-muted)] ${layout.summaryClass}`}>
            {blocks.length} Schicht{blocks.length === 1 ? '' : 'en'} · {summaryStr} Std.
          </p>
          {absenceSummaryLine ? (
            <p
              className={`mt-1 flex items-start gap-1.5 text-[var(--text-faint)] ${variant === 'compact' ? 'text-[9px] leading-snug' : 'text-[10px] leading-snug'}`}
            >
              <UserX className="mt-0.5 h-3 w-3 shrink-0 text-violet-300/80" aria-hidden />
              <span>
                <span className="font-medium text-violet-200/90">Abwesend: </span>
                <span className="text-[var(--text-muted)]">{absenceSummaryLine}</span>
              </span>
            </p>
          ) : null}
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <div className={`relative w-full ${layout.scrollMinWidthClass}`}>
            <TimelineHeader variant={variant} dayStart={dayStart} dayEnd={dayEnd} />
            <div
              className={`relative rounded-b-lg border border-t-0 border-white/10 bg-black/25 ${trackHoliday}`}
              style={{ minHeight: trackHeightPx }}
            >
              {ticks.map((m) => {
                const left = ((m - ds) / span) * 100
                return (
                  <div
                    key={`grid-${m}`}
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 top-0 z-0 w-px bg-white/[0.06]"
                    style={{ left: `${left}%` }}
                  />
                )
              })}

              {visibleRowItems.length === 0 ? (
                <div
                  className="flex items-center justify-center text-[var(--text-faint)]"
                  style={{
                    minHeight: shiftAreaHeight,
                    fontSize: variant === 'compact' ? '11px' : '12px',
                  }}
                >
                  Keine geplanten Schichten
                </div>
              ) : (
                visibleRowItems.map((item) =>
                  item.block.open ? (
                    <OpenShiftBlock
                      key={item.block.id}
                      item={item}
                      headerOffsetPx={headerOffsetPx}
                      layout={layout}
                      onSelect={onShiftSelect}
                    />
                  ) : (
                    <TimelineShiftBlock
                      key={item.block.id}
                      item={item}
                      headerOffsetPx={headerOffsetPx}
                      layout={layout}
                      employeeName={
                        item.block.employeeId
                          ? (employeeById.get(item.block.employeeId)?.name ?? 'Mitarbeiter')
                          : 'Mitarbeiter'
                      }
                      accentColor={(() => {
                        const row = item.block.employeeId
                          ? employeeById.get(item.block.employeeId)
                          : undefined
                        return (
                          (item.block.color?.trim() ? item.block.color : null) ??
                          row?.color ??
                          DEFAULT_EMPLOYEE_SHIFT_ACCENT
                        )
                      })()}
                      onSelect={onShiftSelect}
                    />
                  ),
                )
              )}

              {vacationAbsences.map((a, i) => {
                const name =
                  employees.find((e) => e.id === a.employeeId)?.displayName ?? a.employeeId
                const top = shiftAreaHeight + 4 + i * (absenceStripH + absenceStripGap)
                return (
                  <div
                    key={`vac-${a.id}`}
                    className="pointer-events-none absolute left-1 right-1 z-[1] overflow-hidden rounded-md border border-zinc-400/25 bg-zinc-600/40 px-2 py-0.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    style={{ top, height: absenceStripH }}
                    title={`Urlaub · ${name}`}
                  >
                    <span className="text-[10px] font-semibold text-zinc-100">Urlaub</span>
                    <span className="text-[10px] text-zinc-200/90"> · {name}</span>
                  </div>
                )
              })}

              {hiddenShiftCount > 0 ? (
                <div
                  className="absolute left-0 right-0 border-t border-white/5 bg-black/20 px-2 py-1 text-center text-[10px] text-[var(--text-faint)]"
                  style={{ top: shiftAreaHeight + absenceTracksH }}
                >
                  + {hiddenShiftCount} weitere
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
