import { Link } from 'react-router-dom'
import { Pencil, QrCode, User, UserCheck, UserX } from 'lucide-react'
import type { Employee } from '../../types/employee'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { EmployeeStatusBadge } from './EmployeeStatusBadge'
import { EmploymentTypeBadge } from './EmploymentTypeBadge'
import { WorkAreaBadges } from './WorkAreaBadges'
import { formatEuroDe, formatHoursDe } from './employeeFormat'

type Props = {
  employee: Employee
  onEdit: () => void
  onDeactivate: () => void
  onReactivate?: () => void
}

export function EmployeeCard({ employee, onEdit, onDeactivate, onReactivate }: Props) {
  const inactive = employee.status === 'inaktiv'

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-[var(--radius-md)] border bg-[var(--bg-card)]/95 shadow-[var(--shadow-card)] transition hover:border-cyan-400/35 hover:shadow-[0_0_28px_rgba(34,211,238,0.12)]
        ${inactive ? 'border-white/10 opacity-80' : 'border-[var(--border-subtle)]'}
      `}
    >
      <div
        className="h-1 w-full shrink-0"
        style={{
          background: `linear-gradient(90deg, ${employee.color}, ${employee.color}99)`,
          boxShadow: `0 0 14px ${employee.color}44`,
        }}
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex gap-3">
          <div
            className="shrink-0 rounded-full p-[2px]"
            style={{
              background: employee.color,
              boxShadow: `0 0 12px ${employee.color}55`,
            }}
          >
            <Avatar
              name={employee.displayName}
              src={employee.avatar}
              size="md"
              className="ring-2 ring-[var(--bg-card)]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-[var(--text-main)]">
              {employee.displayName}
            </h3>
            <p className="truncate text-sm text-[var(--text-muted)]">{employee.role}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EmploymentTypeBadge type={employee.employmentType} />
              <EmployeeStatusBadge variant="hr" status={employee.status} />
              {employee.planHint ? (
                <span className="text-[9px] uppercase text-[var(--text-faint)]">
                  Plan: {employee.planHint}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
          <dt className="text-[var(--text-faint)]">Woche</dt>
          <dd className="text-right font-medium tabular-nums text-cyan-200/90">
            {formatHoursDe(employee.weeklyHours)}
          </dd>
          <dt className="text-[var(--text-faint)]">Monat</dt>
          <dd className="text-right font-medium tabular-nums text-[var(--text-main)]">
            {formatHoursDe(employee.monthlyHours)}
          </dd>
          <dt className="text-[var(--text-faint)]">Stundenlohn</dt>
          <dd className="text-right font-medium tabular-nums">{formatEuroDe(employee.hourlyWage)}</dd>
          <dt className="text-[var(--text-faint)]">Resturlaub</dt>
          <dd className="text-right font-medium tabular-nums">
            {employee.remainingVacationDays} Tage
          </dd>
        </dl>

        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Arbeitsbereiche
          </p>
          <WorkAreaBadges workAreaIds={employee.workAreaIds} />
        </div>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
          <Link
            to={`/employees/${employee.id}`}
            state={{ initialTab: 'employeeApp' }}
            className="inline-flex min-w-[2.5rem] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-2 py-2 text-xs font-medium text-cyan-200 transition hover:border-cyan-400/50"
            title="QR-Code / Mitarbeiter-App"
          >
            <QrCode className="h-4 w-4" aria-hidden />
            <span className="sr-only">QR-Code</span>
          </Link>
          <Link
            to={`/employees/${employee.id}`}
            className="inline-flex flex-1 min-w-[5rem] items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-2 py-2 text-xs font-medium text-[var(--text-main)] transition hover:border-[var(--accent-cyan)]/50"
          >
            <User className="h-3.5 w-3.5" aria-hidden />
            Profil
          </Link>
          <Button
            variant="outline"
            className="flex-1 min-w-[5rem] px-2 py-2 text-xs"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Bearbeiten
          </Button>
          {inactive && onReactivate ? (
            <Button
              variant="primary"
              className="flex-1 min-w-[5rem] px-2 py-2 text-xs"
              onClick={onReactivate}
            >
              <UserCheck className="h-3.5 w-3.5" aria-hidden />
              Aktivieren
            </Button>
          ) : !inactive ? (
            <Button
              variant="danger"
              className="flex-1 min-w-[5rem] px-2 py-2 text-xs"
              onClick={onDeactivate}
            >
              <UserX className="h-3.5 w-3.5" aria-hidden />
              Deaktivieren
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
