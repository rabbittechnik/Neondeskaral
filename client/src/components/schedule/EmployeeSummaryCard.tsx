import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ScheduleEmployeeRow } from '../../types/employee'
import { EmployeeStatusBadge } from '../employees/EmployeeStatusBadge'
import { Avatar } from '../ui/Avatar'

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
  onPointerDownCapture?: (e: ReactPointerEvent<HTMLButtonElement>) => void
}

export function EmployeeSummaryCard({
  employee,
  weeklyHours,
  selected,
  onClick,
  compact,
  onPointerDownCapture,
}: Props) {
  const wClass = compact ? 'w-[min(160px,calc(100vw-3rem))]' : 'w-[200px]'
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDownCapture={onPointerDownCapture}
      className={`group relative flex ${wClass} shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-sm)] border text-left transition
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
          boxShadow: selected
            ? `0 0 14px ${employee.color}88`
            : '0 0 8px transparent',
        }}
        aria-hidden
      />

      <div className="flex gap-2.5 p-2.5 pt-2">
        <div
          className="relative shrink-0 rounded-full p-[2px] transition group-hover:shadow-[0_0_12px_rgba(0,0,0,0.35)]"
          style={{
            background: employee.color,
            boxShadow: selected ? `0 0 14px ${employee.color}77` : undefined,
          }}
        >
          <Avatar
            name={employee.name}
            src={employee.avatar}
            size="sm"
            className="ring-2 ring-[var(--bg-card)]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-[var(--text-main)]">
            {employee.name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">{employee.role}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums">
            <span className="text-[10px] font-medium text-cyan-200/90">
              W: {formatHoursDe(weeklyHours)}
            </span>
            <span className="text-[10px] text-[var(--text-faint)]">
              M: {formatHoursDe(employee.monthlyHours)}
            </span>
          </div>
          <div className="mt-1.5">
            <EmployeeStatusBadge variant="presence" presence={employee.schedulePresence} />
          </div>
        </div>
      </div>
    </button>
  )
}
