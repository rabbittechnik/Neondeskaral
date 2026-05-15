import { AlertTriangle } from 'lucide-react'
import type { ScheduleConflict } from '../../data/mockSchedule'
import { Card } from '../ui/Card'

type Props = {
  conflicts: ScheduleConflict[]
  /** API-Fehler beim Laden der Schichtkonflikte (keine Dummy-Daten). */
  loadError?: string | null
}

export function ScheduleConflictCard({ conflicts, loadError }: Props) {
  return (
    <Card padding="md" className="border-orange-500/25">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
        <AlertTriangle className="h-4 w-4 text-orange-400" aria-hidden />
        Warnungen / Konflikte
      </h3>
      {loadError ? (
        <p className="mt-3 text-xs text-rose-200/95">{loadError}</p>
      ) : null}
      {!loadError && conflicts.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">Keine Konflikte</p>
      ) : null}
      {conflicts.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {conflicts.map((c) => (
            <li
              key={c.id}
              className="rounded-[var(--radius-sm)] border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-xs"
            >
              <p className="schedule-conflict-title font-medium text-orange-100">{c.message}</p>
              <p className="mt-0.5 text-[var(--text-muted)]">{c.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
