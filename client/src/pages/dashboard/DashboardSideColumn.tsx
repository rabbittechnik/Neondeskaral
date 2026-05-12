import { AlertTriangle } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { birthdays, pendingAbsences, unfilledWarnings } from './dashboardData'

export function PendingAbsencesCard() {
  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--text-main)]">
        Offene Abwesenheitsanträge
      </h3>
      <ul className="mt-3 space-y-2">
        {pendingAbsences.map((a) => (
          <li
            key={`${a.name}-${a.range}`}
            className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/35 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--text-main)]">{a.name}</span>
              <Badge tone={a.type === 'Krank' ? 'danger' : 'cyan'}>{a.type}</Badge>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{a.range}</p>
          </li>
        ))}
      </ul>
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
      <h3 className="text-base font-semibold text-[var(--text-main)]">
        Kommende Geburtstage
      </h3>
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
          <p className="text-4xl font-semibold tracking-tight text-[var(--text-main)]">
            18°
          </p>
          <p className="text-sm text-[var(--text-muted)]">Bewölkt</p>
        </div>
        <div className="text-right text-xs text-[var(--text-faint)]">
          Aktualisiert 14:02
        </div>
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
