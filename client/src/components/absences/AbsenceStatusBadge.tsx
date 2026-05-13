import type { AbsenceStatus } from '../../types/absence'
import { Badge } from '../ui/Badge'
import { ABSENCE_STATUS_LABELS, absenceStatusBadgeTone } from './absenceLabels'

type Props = {
  status: AbsenceStatus
  className?: string
}

export function AbsenceStatusBadge({ status, className = '' }: Props) {
  return (
    <Badge tone={absenceStatusBadgeTone(status)} className={className}>
      {ABSENCE_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
