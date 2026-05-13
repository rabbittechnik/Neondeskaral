import type { AbsenceType } from '../../types/absence'
import { ABSENCE_TYPE_LABELS, absenceTypeBadgeClass } from './absenceLabels'

type Props = {
  type: AbsenceType | string
  className?: string
  compact?: boolean
}

function coerceAbsenceType(raw: string): AbsenceType {
  const s = String(raw).trim().toLowerCase()
  const map: Record<string, AbsenceType> = {
    paid_vacation: 'paid_vacation',
    unpaid_vacation: 'unpaid_vacation',
    urlaub: 'paid_vacation',
    vacation: 'paid_vacation',
    unbezahlt: 'unpaid_vacation',
    unpaid: 'unpaid_vacation',
    frei: 'day_off',
    day_off: 'day_off',
    krankheit: 'sick',
    sick: 'sick',
    sonderurlaub: 'special_leave',
    special_leave: 'special_leave',
    kind_krank: 'child_sick',
    child_sick: 'child_sick',
    sonstiges: 'other',
    other: 'other',
    berufsschule: 'school',
    school: 'school',
  }
  return map[s] ?? 'other'
}

export function AbsenceTypeBadge({ type, className = '', compact }: Props) {
  const t = coerceAbsenceType(type as string)
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${absenceTypeBadgeClass(t)} ${compact ? 'text-[9px]' : ''} ${className}`}
    >
      {ABSENCE_TYPE_LABELS[t]}
    </span>
  )
}
