import { Link } from 'react-router-dom'
import { Pencil, Trash2, User, UserCheck, UserX } from 'lucide-react'
import type { Employee } from '../../types/employee'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { Avatar } from '../ui/Avatar'
import { EmployeeStatusBadge } from './EmployeeStatusBadge'
import { EmploymentTypeBadge } from './EmploymentTypeBadge'
import { WorkAreaBadges } from './WorkAreaBadges'
import { formatEuroDe, formatHoursDe } from './employeeFormat'
import { formatShiftPrefList, formatWeekdayPrefList } from './planning/planningPreferenceLabels'

type Props = {
  employees: Employee[]
  onEdit: (e: Employee) => void
  onDeactivate: (e: Employee) => void
  onReactivate: (e: Employee) => void
  onRestore?: (e: Employee) => void
  onRequestDelete?: (e: Employee) => void
}

export function EmployeeTable({
  employees,
  onEdit,
  onDeactivate,
  onReactivate,
  onRestore,
  onRequestDelete,
}: Props) {
  const { hasPermission } = useStation()
  const { user } = useAuth()
  const canHardDelete =
    Boolean(user?.globalAdmin) ||
    hasPermission('employees.manageSensitive') ||
    hasPermission('employees.delete')
  const canSensitive =
    hasPermission('employees.viewSensitive') ||
    hasPermission('payroll.view') ||
    hasPermission('employees.manageSensitive')

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <th className="px-3 py-3 font-medium">Mitarbeiter</th>
            <th className="px-3 py-3 font-medium">Rolle</th>
            <th className="px-3 py-3 font-medium">Art</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium tabular-nums">Woche</th>
            <th className="px-3 py-3 font-medium tabular-nums">Monat</th>
            <th className="px-3 py-3 font-medium tabular-nums">Lohn</th>
            <th className="px-3 py-3 font-medium tabular-nums">Resturlaub</th>
            <th className="px-3 py-3 font-medium">Wünsche</th>
            <th className="px-3 py-3 font-medium">Bereiche</th>
            <th className="px-3 py-3 font-medium text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => {
            const inactive = e.status === 'inaktiv'
            const removed = e.status === 'geloescht'
            return (
              <tr
                key={e.id}
                className={`border-b border-[var(--border-subtle)] transition hover:bg-white/[0.03] ${
                  inactive || removed ? 'opacity-75' : ''
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="rounded-full p-px"
                      style={{
                        background: e.color,
                        boxShadow: `0 0 8px ${e.color}44`,
                      }}
                    >
                      <Avatar
                        name={e.displayName}
                        src={e.avatar}
                        size="sm"
                        className="ring-2 ring-[var(--bg-card)]"
                      />
                    </div>
                    <span className="font-medium text-[var(--text-main)]">{e.displayName}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[var(--text-muted)]">{e.role}</td>
                <td className="px-3 py-2.5">
                  <EmploymentTypeBadge type={e.employmentType} />
                </td>
                <td className="px-3 py-2.5">
                  <EmployeeStatusBadge variant="hr" status={e.status} />
                </td>
                <td className="px-3 py-2.5 tabular-nums text-cyan-200/85">
                  {formatHoursDe(e.weeklyHours)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-[var(--text-main)]">
                  {formatHoursDe(e.monthlyHours)}
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  {canSensitive && e.hourlyWage != null ? formatEuroDe(e.hourlyWage) : '—'}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{e.remainingVacationDays} T</td>
                <td className="max-w-[200px] px-3 py-2.5 align-top text-[10px] leading-snug text-[var(--text-muted)]">
                  {!(e.preferredShiftTypes?.length || e.preferredWorkDays?.length) ? (
                    <span className="italic text-[var(--text-faint)]">Keine Wünsche</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {e.preferredShiftTypes?.length ? (
                        <span className="text-emerald-200/85">{formatShiftPrefList(e.preferredShiftTypes)}</span>
                      ) : null}
                      {e.preferredWorkDays?.length ? (
                        <span className="text-cyan-200/85">{formatWeekdayPrefList(e.preferredWorkDays)}</span>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <WorkAreaBadges workAreaIds={e.workAreaIds} max={4} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Link
                      to={`/employees/${e.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] text-[var(--text-muted)] hover:border-cyan-400/40 hover:text-[var(--text-main)]"
                      title="Profil"
                    >
                      <User className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      title="Bearbeiten"
                      onClick={() => onEdit(e)}
                      disabled={removed}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] text-[var(--text-muted)] hover:border-cyan-400/40 hover:text-[var(--text-main)] disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {removed && onRestore ? (
                      <button
                        type="button"
                        title="Wiederherstellen"
                        onClick={() => onRestore(e)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/10"
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                    ) : inactive ? (
                      <button
                        type="button"
                        title="Aktivieren"
                        onClick={() => onReactivate(e)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/10"
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Deaktivieren"
                        onClick={() => onDeactivate(e)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-red-400/35 text-red-300 hover:bg-red-500/10"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                    {canHardDelete && onRequestDelete && !removed ? (
                      <button
                        type="button"
                        title="Mitarbeiter löschen"
                        onClick={() => onRequestDelete(e)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-rose-400/35 text-rose-200 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {employees.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          Keine Mitarbeiter für die aktuelle Filterung.
        </p>
      ) : null}
    </div>
  )
}
