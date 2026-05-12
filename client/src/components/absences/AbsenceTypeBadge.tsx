import type { AbsenceType } from '../../types/absence'
import { ABSENCE_TYPE_LABELS, absenceTypeBadgeClass } from './absenceLabels'

type Props = {
  type: AbsenceType
  className?: string
  compact?: boolean
}

export function AbsenceTypeBadge({ type, className = '', compact }: Props) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${absenceTypeBadgeClass(type)} ${compact ? 'text-[9px]' : ''} ${className}`}
    >
      {ABSENCE_TYPE_LABELS[type]}
    </span>
  )
}
