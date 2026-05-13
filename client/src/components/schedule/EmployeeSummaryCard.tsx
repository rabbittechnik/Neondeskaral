import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ScheduleEmployeeRow } from '../../types/employee'
import { EmployeeStatusBadge } from '../employees/EmployeeStatusBadge'
import { Avatar } from '../ui/Avatar'
import type { TimelineViewportDensity } from './timelineLayout'

function formatHoursDe(h: number): string {
  return `${h.toFixed(1).replace('.', ',')} Std.`
}

type Props = {
  employee: ScheduleEmployeeRow
  weeklyHours: number
  selected: boolean
  onClick: () => void
  /** Schmalere Karte (z. B. Dashboard) */
  compact?: boolean
  /** Karte nutzt volle Grid-Zelle statt fester Pixelbreite */
  fluid?: boolean
  viewportDensity?: TimelineViewportDensity
  onPointerDownCapture?: (e: ReactPointerEvent<HTMLButtonElement>) => void
}

export function EmployeeSummaryCard({
  employee,
  weeklyHours,
  selected,
  onClick,
  compact,
  fluid,
  viewportDensity = 'comfort',
  onPointerDownCapture,
}: Props) {
  const density = viewportDensity
  const narrow = density !== 'comfort'
  const cramped = density === 'cramped'

  const widthClass = fluid
    ? 'w-full min-w-0 max-w-full'
    : compact
      ? 'w-[min(160px,calc(100vw-3rem))]'
      : 'w-[200px]'

  const pad = cramped ? 'p-1.5 pt-1.5' : narrow ? 'p-2 pt-1.5' : 'p-2.5 pt-2'
  const gap = cramped ? 'gap-1.5' : 'gap-2.5'
  const nameCls = cramped
    ? 'truncate text-[11px] font-semibold leading-tight'
    : narrow
      ? 'truncate text-[12px] font-semibold leading-tight'
      : 'truncate text-[13px] font-semibold leading-tight'
  const roleCls = cramped ? 'mt-0.5 truncate text-[9px]' : 'mt-0.5 truncate text-[10px]'
  const statsCls = cramped
    ? 'mt-1 flex flex-col gap-0.5 tabular-nums'
    : 'mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums'
  const wLineCls = cramped
    ? 'text-[9px] font-medium text-cyan-200/90'
    : 'text-[10px] font-medium text-cyan-200/90'
  const mLineCls = cramped ? 'text-[9px] text-[var(--text-faint)]' : 'text-[10px] text-[var(--text-faint)]'
  const badgeWrapCls = cramped ? 'mt-1' : 'mt-1.5'

  return (
    <button
      type="button"
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
            className={`ring-2 ring-[var(--bg-card)] ${cramped ? '!h-7 !w-7 !text-[10px]' : ''}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-[var(--text-main)] ${nameCls}`}>{employee.name}</p>
          <p className={`text-[var(--text-muted)] ${roleCls}`}>{employee.role}</p>
          <div className={statsCls}>
            <span className={wLineCls}>W: {formatHoursDe(weeklyHours)}</span>
            <span className={mLineCls}>M: {formatHoursDe(employee.monthlyHours)}</span>
          </div>
          <div className={badgeWrapCls}>
            <EmployeeStatusBadge variant="presence" presence={employee.schedulePresence} />
          </div>
        </div>
      </div>
    </button>
  )
}
