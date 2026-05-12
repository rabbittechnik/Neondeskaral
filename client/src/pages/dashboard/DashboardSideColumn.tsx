import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { AbsenceStatusBadge } from '../../components/absences/AbsenceStatusBadge'
import { AbsenceTypeBadge } from '../../components/absences/AbsenceTypeBadge'
import { useAbsences } from '../../context/absences-context'
import { useEmployees } from '../../context/employees-context'
import { birthdays, unfilledWarnings } from './dashboardData'

function formatDeRange(start: string, end: string): string {
  const f = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }
  return start === end ? f(start) : `${f(start)} – ${f(end)}`
}

export function PendingAbsencesCard() {
  const { absences } = useAbsences()
  const { employees } = useEmployees()
  const pending = absences.filter((a) => a.status === 'beantragt')

  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--text-main)]">Offene Abwesenheitsanträge</h3>
      {pending.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-faint)]">Keine offenen Anträge.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pending.map((a) => {
            const emp = employees.find((e) => e.id === a.employeeId)
            return (
              <li
                key={a.id}
                className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/35 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--text-main)]">
                    {emp?.displayName ?? a.employeeId}
                  </span>
                  <AbsenceTypeBadge type={a.type} />
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDeRange(a.startDate, a.endDate)}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <AbsenceStatusBadge status={a.status} />
                  <Link
                    to="/absences?view=requests"
                    className="text-xs font-medium text-cyan-300/90 underline-offset-2 hover:text-cyan-200 hover:underline"
                  >
                    Antrag prüfen
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function UnfilledShiftsCard() {
  return (
    <Card>
      <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text-main)]">
        <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
        Unbesetzte Schichten / Warnungen
      </h3>
      <ul className="mt-3 space-y-2">
        {unfilledWarnings.map((w) => (
          <li
            key={`${w.day}-${w.slot}`}
            className="flex items-start justify-between gap-2 rounded-[var(--radius-sm)] border border-red-500/25 bg-red-500/5 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-main)]">{w.slot}</p>
              <p className="text-xs text-[var(--text-muted)]">{w.day}</p>
            </div>
            <Badge tone="danger">Unbesetzt</Badge>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function BirthdaysCard() {
  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--text-main)]">Kommende Geburtstage</h3>
      <ul className="mt-3 space-y-2">
        {birthdays.map((b) => (
          <li
            key={b.name}
            className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-[var(--text-main)]">{b.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{b.date}</p>
            </div>
            <span className="text-xs text-[var(--text-faint)]">{b.inDays}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function WeatherCard() {
  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--text-main)]">Wetter</h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Bodelshausen</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-semibold tracking-tight text-[var(--text-main)]">18°</p>
          <p className="text-sm text-[var(--text-muted)]">Bewölkt</p>
        </div>
        <div className="text-right text-xs text-[var(--text-faint)]">Aktualisiert 14:02</div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border-subtle)] pt-4 text-center text-[11px] text-[var(--text-muted)]">
        <div>
          <p className="font-medium text-[var(--text-main)]">Mi</p>
          <p>17°</p>
        </div>
        <div>
          <p className="font-medium text-[var(--text-main)]">Do</p>
          <p>21°</p>
        </div>
        <div>
          <p className="font-medium text-[var(--text-main)]">Fr</p>
          <p>19°</p>
        </div>
      </div>
    </Card>
  )
}
