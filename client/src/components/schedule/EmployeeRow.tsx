import type { ReactNode } from 'react'
import type { Employee } from '../../data/mockSchedule'
import { Avatar } from '../ui/Avatar'

type Props = {
  employee: Employee
  weeklyHours: number
  children: ReactNode
}

export function EmployeeRow({ employee, weeklyHours, children }: Props) {
  return (
    <>
      <div className="relative sticky left-0 z-10 flex min-w-[200px] items-center gap-3 overflow-hidden border-b border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 pl-3">
        <div
          className="absolute left-0 top-0 h-full w-1 rounded-r"
          style={{ backgroundColor: employee.accentColor }}
          aria-hidden
        />
        <Avatar name={employee.name} size="sm" />
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-sm font-medium text-[var(--text-main)]">{employee.name}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">{employee.role}</p>
          <p className="mt-1 text-[10px] tabular-nums text-[var(--text-faint)]">
            {weeklyHours.toFixed(1)} WoStd.
          </p>
        </div>
      </div>
      {children}
    </>
  )
}
