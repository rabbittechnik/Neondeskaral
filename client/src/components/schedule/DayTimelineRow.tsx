import { useMemo, useRef } from 'react'
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
import type { ScheduleTimelineVariant, TimelineViewportDensity } from './timelineLayout'
import { getTimelineLayout } from './timelineLayout'
import { useAbsences } from '../../context/absences-context'
import { useEmployees } from '../../context/employees-context'
import { getAbsencesForDate } from '../../utils/absenceQueries'
import { ABSENCE_TYPE_LABELS, absenceTypeBadgeClass } from '../absences/absenceLabels'

import type { WeekTimelineEditBridge } from './scheduleTimelineEditTypes'

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
  viewportDensity?: TimelineViewportDensity
  /** Bundesland der Station (z. B. BW) für Feiertagslogik */
  stationFederalState: GermanState
  /** Anzeige im Tooltip offener / Soll-Lücken-Balken */
  stationName?: string
  onShiftSelect?: (block: ResolvedShiftBlock) => void
  shiftEdit?: WeekTimelineEditBridge
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
  viewportDensity = 'comfort',
  stationFederalState,
  stationName,
  onShiftSelect,
  shiftEdit,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const layout = useMemo(
    () => getTimelineLayout(variant, viewportDensity),
    [variant, viewportDensity],
  )
  const weekday = WEEKDAY_LABELS_LONG[dayIndex] ?? ''
  const dateIso = useMemo(() => toISODate(dayDate), [dayDate])
  const { absences } = useAbsences()
  const { employees } = useEmployees()
  const approvedDayAbsences = useMemo(
    () => getAbsencesForDate(absences, dateIso, { statuses: ['genehmigt'] }),
    [absences, dateIso],
  )
  const absenceCount = approvedDayAbsences.length

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

  const blocksForLayout = useMemo(() => {
    const m = shiftEdit?.previewByShiftId
    if (!m || m.size === 0) return blocks
    return blocks.map((b) => {
      const p = m.get(b.id)
      if (!p) return b
      return { ...b, start: p.start, end: p.end }
    })
  }, [blocks, shiftEdit?.previewByShiftId])

  const rowItems = useMemo(
    () => groupShiftsIntoRows(blocksForLayout, dayStart, dayEnd),
    [blocksForLayout, dayStart, dayEnd],
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
      ? Math.max(30, layout.blockHeight + 6)
      : headerOffsetPx + (maxVisibleRow + 1) * (layout.blockHeight + layout.rowGap)

  /** Nur Schichtbereich + ggf. „+ weitere“-Leiste; Abwesenheiten nur links — Zeilenhöhe über Grid items-stretch. */
  const moreRowHeight = hiddenShiftCount > 0 ? 22 : 0
  const trackBodyHeightPx = shiftAreaHeight + moreRowHeight

  const blocksForSummary = useMemo(
    () => blocksForLayout.filter((b) => !b.requirementGap),
    [blocksForLayout],
  )
  const summaryHours = sumShiftHoursForDay(blocksForSummary)
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
        className={`grid grid-cols-1 lg:grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)] ${layout.dayOuterPadding} ${layout.dayInnerGap} lg:items-stretch`}
      >
        <div
          className={`flex min-h-0 flex-col gap-0.5 self-stretch rounded-l-[calc(var(--radius-md)-2px)] pl-2 lg:pl-3 ${layout.leftColClass} min-w-0 w-full lg:!w-full ${leftRail}`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
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
              className={`mt-1 max-w-full min-w-0 rounded-md px-2 py-1 text-left ${holidayBadge.colorClass} ${variant === 'compact' ? 'text-[10px] leading-snug' : 'text-[11px] leading-snug'}`}
            >
              <span className="font-semibold">{badgeLine}</span>
              {holidayBadge.note ? (
                <p className="mt-1 border-t border-white/10 pt-1 text-[9px] font-normal text-[var(--text-muted)]">
                  {holidayBadge.note}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className={`min-w-0 text-[var(--text-muted)] ${layout.summaryClass}`}>
            {blocksForSummary.length} Schicht{blocksForSummary.length === 1 ? '' : 'en'} · {summaryStr} Std.
            {blocks.some((b) => b.requirementGap) ? (
              <span className="text-rose-200/85"> · Soll-Lücken markiert</span>
            ) : null}
          </p>
          {absenceCount > 0 ? (
            <div
              className={`mt-1 min-w-0 space-y-1 ${variant === 'compact' ? 'text-[9px]' : 'text-[10px]'}`}
            >
              <div className="flex min-w-0 items-center gap-1.5 text-violet-200/90">
                <UserX className="h-3 w-3 shrink-0 text-violet-300/80" aria-hidden />
                <span className={`font-semibold ${variant === 'compact' ? 'text-[9px]' : 'text-[10px]'}`}>
                  Abwesend
                </span>
              </div>
              <ul className="min-w-0 list-none space-y-1 p-0">
                {approvedDayAbsences.map((a) => {
                  const name =
                    employees.find((e) => e.id === a.employeeId)?.displayName ?? a.employeeId
                  return (
                    <li key={a.id} className="min-w-0">
                      <div
                        className={`rounded-md border px-2 py-1 leading-snug shadow-sm ${absenceTypeBadgeClass(a.type)}`}
                      >
                        <span className="min-w-0 break-words font-semibold">{name}</span>
                        <span className="opacity-70"> · </span>
                        <span className="min-w-0 break-words font-medium">
                          {ABSENCE_TYPE_LABELS[a.type]}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col self-stretch overflow-x-hidden lg:min-h-0">
          <div className={`relative flex h-full min-h-0 min-w-0 flex-col ${layout.scrollMinWidthClass}`}>
            <TimelineHeader
              variant={variant}
              dayStart={dayStart}
              dayEnd={dayEnd}
              layout={layout}
            />
            <div
              ref={trackRef}
              className={`relative flex min-h-0 flex-1 flex-col rounded-b-lg border border-t-0 border-white/10 bg-black/25 ${trackHoliday}`}
              style={{ minHeight: trackBodyHeightPx }}
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
                      stationName={stationName}
                      onSelect={onShiftSelect}
                      shiftEdit={shiftEdit}
                    />
                  ) : (
                    <TimelineShiftBlock
                      key={item.block.id}
                      item={item}
                      headerOffsetPx={headerOffsetPx}
                      layout={layout}
                      employeeName={
                        item.block.employeeId
                          ? (item.block.employeeDisplayName?.trim() ||
                              employeeById.get(item.block.employeeId)?.name ||
                              'Mitarbeiter')
                          : 'Mitarbeiter'
                      }
                      accentColor={(() => {
                        const row = item.block.employeeId
                          ? employeeById.get(item.block.employeeId)
                          : undefined
                        return (
                          (item.block.color?.trim() ? item.block.color : null) ??
                          (item.block.employeeColor?.trim() ? item.block.employeeColor : null) ??
                          row?.color ??
                          DEFAULT_EMPLOYEE_SHIFT_ACCENT
                        )
                      })()}
                      onSelect={onShiftSelect}
                      dayStart={dayStart}
                      dayEnd={dayEnd}
                      trackRef={trackRef}
                      shiftEdit={shiftEdit}
                    />
                  ),
                )
              )}

              {hiddenShiftCount > 0 ? (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[3] border-t border-white/5 bg-black/20 px-2 py-1 text-center text-[10px] text-[var(--text-faint)]">
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
