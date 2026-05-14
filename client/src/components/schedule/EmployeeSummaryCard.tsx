import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ScheduleEmployeeRow } from '../../types/employee'
import type { EmployeePlannedHoursBreakdown } from '../../utils/employeePlannedHours'
import { EmployeeStatusBadge } from '../employees/EmployeeStatusBadge'
import { Avatar } from '../ui/Avatar'
import type { TimelineViewportDensity } from './timelineLayout'

function formatHoursDe(h: number): string {
  return `${h.toFixed(1).replace('.', ',')} Std.`
}

/** Kurzname bei wenig Platz (Tooltip = voller Name). */
function compactDisplayName(fullName: string): string {
  const t = fullName.trim()
  if (t.length <= 15) return t
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!
    const first = parts.slice(0, -1).join(' ')
    if (last.length <= 2) {
      const s = `${first} ${last}`
      return s.length <= 18 ? s : `${first.slice(0, 10)}…`
    }
    return `${first} ${last[0]!}.`
  }
  return `${t.slice(0, 12)}…`
}

type Props = {
  employee: ScheduleEmployeeRow
  weeklyHours: number
  /** Geplante Stunden im Kalendermonat (Schichtplan); ohne Angabe wird `employee.monthlyHours` (Profil) genutzt */
  monthPlannedHours?: number
  /** Aufschlüsselung Wochenstunden (Schichten / Urlaub / Gesamt), z. B. für Tooltip */
  weekHoursBreakdown?: EmployeePlannedHoursBreakdown
  /** Aufschlüsselung Monatsstunden (Schichten / Urlaub / Gesamt), z. B. für Tooltip */
  monthHoursBreakdown?: EmployeePlannedHoursBreakdown
  selected: boolean
  onClick: () => void
  /** Schmalere Karte (z. B. Dashboard) */
  compact?: boolean
  /** Karte nutzt volle Grid-Zelle statt fester Pixelbreite */
  fluid?: boolean
  viewportDensity?: TimelineViewportDensity
  /** Viele Mitarbeiter / enger Viewport: kleinere Typo, ggf. gekürzter Name */
  layoutTight?: boolean
  onPointerDownCapture?: (e: ReactPointerEvent<HTMLButtonElement>) => void
}

export function EmployeeSummaryCard({
  employee,
  weeklyHours,
  monthPlannedHours,
  weekHoursBreakdown,
  monthHoursBreakdown,
  selected,
  onClick,
  compact,
  fluid,
  viewportDensity = 'comfort',
  layoutTight = false,
  onPointerDownCapture,
}: Props) {
  const density = viewportDensity
  const narrow = density !== 'comfort'
  const cramped = density === 'cramped'
  const tight = layoutTight || narrow

  const widthClass = fluid
    ? 'w-full min-w-0 max-w-full'
    : compact
      ? 'w-[min(160px,calc(100vw-3rem))]'
      : 'w-[200px]'

  const pad = cramped ? 'p-1.5 pt-1.5' : tight ? 'p-1.5 sm:p-2 pt-1.5' : narrow ? 'p-2 pt-1.5' : 'p-2.5 pt-2'
  const gap = cramped ? 'gap-1.5' : tight ? 'gap-1.5 sm:gap-2' : 'gap-2.5'
  const nameCls = cramped
    ? 'truncate text-[10px] font-semibold leading-tight sm:text-[11px]'
    : tight
      ? 'truncate text-[11px] font-semibold leading-tight sm:text-[12px]'
      : narrow
        ? 'truncate text-[12px] font-semibold leading-tight'
        : 'truncate text-[13px] font-semibold leading-tight'
  const roleCls = cramped
    ? 'mt-0.5 truncate text-[8px] leading-snug sm:text-[9px]'
    : tight
      ? 'mt-0.5 truncate text-[9px] leading-snug sm:text-[10px]'
      : 'mt-0.5 truncate text-[10px]'
  const statsCls = cramped
    ? 'mt-1 flex flex-col gap-0.5 tabular-nums'
    : tight
      ? 'mt-1 flex flex-col gap-0.5 tabular-nums sm:flex-row sm:flex-wrap sm:gap-x-2'
      : 'mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums'
  const wLineCls = cramped
    ? 'text-[8px] font-medium text-cyan-200/90 sm:text-[9px]'
    : 'text-[9px] font-medium text-cyan-200/90 sm:text-[10px]'
  const mLineCls = cramped ? 'text-[8px] text-[var(--text-faint)] sm:text-[9px]' : 'text-[9px] text-[var(--text-faint)] sm:text-[10px]'
  const badgeWrapCls = cramped ? 'mt-1' : tight ? 'mt-1 sm:mt-1.5' : 'mt-1.5'

  const nameShown = tight ? compactDisplayName(employee.name) : employee.name
  const monthHoursShown = monthPlannedHours ?? employee.monthlyHours

  const formatBreakdownLines = (label: string, b: EmployeePlannedHoursBreakdown) =>
    [
      '',
      `${label}:`,
      `- Schichten: ${formatHoursDe(b.plannedShiftHours)}`,
      `- Bezahlter Urlaub: ${formatHoursDe(b.paidVacationHours)}`,
      `- Gesamt: ${formatHoursDe(b.totalHours)}`,
      b.shiftDaysWithPaidVacationConflict > 0
        ? `- Hinweis: ${b.shiftDaysWithPaidVacationConflict} Tag(e) mit Schicht und Urlaub (Urlaub zählt, Schicht nicht doppelt).`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

  const detailTooltip = [
    weekHoursBreakdown ? formatBreakdownLines('Wochenstunden', weekHoursBreakdown) : '',
    monthHoursBreakdown ? formatBreakdownLines('Monatsstunden', monthHoursBreakdown) : '',
  ]
    .filter(Boolean)
    .join('\n')

  const titleBase = `${employee.name}${employee.role ? ` · ${employee.role}` : ''}`
  const title = detailTooltip ? `${titleBase}${detailTooltip}` : titleBase

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onPointerDownCapture={onPointerDownCapture}
      className={`group relative flex ${fluid ? '' : 'shrink-0 snap-start'} ${widthClass} flex-col overflow-hidden rounded-[var(--radius-sm)] border text-left transition
        ${
          selected
            ? 'border-cyan-400/55 bg-[var(--bg-elevated)] shadow-[0_0_28px_rgba(34,211,238,0.22),0_0_1px_rgba(34,211,238,0.5)]'
            : 'border-[var(--border-subtle)] bg-[var(--bg-card)]/90 shadow-[var(--shadow-card)] hover:border-cyan-400/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)]'
        }
      `}
    >
      <div
        className="h-1 w-full shrink-0"
        style={{
          background: `linear-gradient(90deg, ${employee.color}, ${employee.color}99)`,
          boxShadow: selected ? `0 0 14px ${employee.color}88` : '0 0 8px transparent',
        }}
        aria-hidden
      />

      <div className={`flex ${gap} ${pad}`}>
        <div
          className={`relative shrink-0 rounded-full ${cramped ? 'p-px' : 'p-[2px]'} transition group-hover:shadow-[0_0_12px_rgba(0,0,0,0.35)]`}
          style={{
            background: employee.color,
            boxShadow: selected ? `0 0 14px ${employee.color}77` : undefined,
          }}
        >
          <Avatar
            name={employee.name}
            src={employee.avatar}
            size="sm"
            className={`ring-2 ring-[var(--bg-card)] ${cramped || tight ? '!h-7 !w-7 !text-[9px] sm:!h-8 sm:!w-8 sm:!text-[10px]' : ''}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-[var(--text-main)] ${nameCls}`}>{nameShown}</p>
          <p className={`text-[var(--text-muted)] ${roleCls}`} title={employee.role}>
            {employee.role}
          </p>
          <div className={statsCls}>
            <span className={wLineCls}>W: {formatHoursDe(weeklyHours)}</span>
            <span className={mLineCls}>M: {formatHoursDe(monthHoursShown)}</span>
          </div>
          <div className={badgeWrapCls}>
            <EmployeeStatusBadge variant="presence" presence={employee.schedulePresence} />
          </div>
        </div>
      </div>
    </button>
  )
}
