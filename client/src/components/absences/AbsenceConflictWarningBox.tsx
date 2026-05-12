import { AlertTriangle } from 'lucide-react'
import type { AbsenceConflictWarning } from '../../utils/absenceConflicts'

type Props = {
  warnings: AbsenceConflictWarning[]
}

export function AbsenceConflictWarningBox({ warnings }: Props) {
  if (warnings.length === 0) return null
  return (
    <div className="rounded-[var(--radius-md)] border border-amber-400/40 bg-amber-500/10 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold text-amber-100">Hinweise / mögliche Konflikte</p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-amber-100/90">
            {warnings.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
          <p className="text-[10px] text-[var(--text-faint)]">
            Mit „Trotzdem speichern“ kannst du den Eintrag trotzdem übernehmen (keine harte Sperre).
          </p>
        </div>
      </div>
    </div>
  )
}
