import { AlertTriangle } from 'lucide-react'
import type { ScheduleConflict } from '../../data/mockSchedule'
import { Card } from '../ui/Card'

type Props = {
  conflicts: ScheduleConflict[]
}

export function ScheduleConflictCard({ conflicts }: Props) {
  return (
    <Card padding="md" className="border-orange-500/25">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
        <AlertTriangle className="h-4 w-4 text-orange-400" aria-hidden />
        Warnungen / Konflikte
      </h3>
      <ul className="mt-3 space-y-2">
        {conflicts.map((c) => (
          <li
            key={c.id}
            className="rounded-[var(--radius-sm)] border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-xs"
          >
            <p className="font-medium text-orange-100">{c.message}</p>
            <p className="mt-0.5 text-[var(--text-muted)]">{c.detail}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
