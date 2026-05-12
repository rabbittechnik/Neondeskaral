import type { Absence } from '../../types/absence'
import type { Employee } from '../../types/employee'
import { AbsenceTypeBadge } from './AbsenceTypeBadge'
import { AbsenceStatusBadge } from './AbsenceStatusBadge'
import { ABSENCE_TYPE_LABELS } from './absenceLabels'

type Props = {
  absence: Absence
  employee?: Employee
  compact?: boolean
}

export function AbsenceCalendarEntry({ absence, employee, compact }: Props) {
  const name = employee?.displayName ?? 'Mitarbeiter'
  const typeLabel = ABSENCE_TYPE_LABELS[absence.type]
  const range =
    absence.startDate === absence.endDate
      ? absence.startDate
      : `${absence.startDate} – ${absence.endDate}`

  if (compact) {
    return (
      <div className="truncate rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[9px] leading-tight text-[var(--text-main)]">
        <span className="font-medium">{name}</span>
        <span className="text-[var(--text-faint)]"> · </span>
        <span>{typeLabel}</span>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/35 px-1.5 py-1 text-[10px] leading-snug shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <span className="min-w-0 truncate font-semibold text-[var(--text-main)]">{name}</span>
        <AbsenceTypeBadge type={absence.type} compact />
      </div>
      <p className="mt-0.5 truncate text-[9px] text-[var(--text-muted)]">{range}</p>
      <div className="mt-1">
        <AbsenceStatusBadge status={absence.status} className="text-[9px] px-1.5 py-0" />
      </div>
    </div>
  )
}
