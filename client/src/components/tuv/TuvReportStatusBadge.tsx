import type { TuvReportStatus } from '../../types/tuvReport'
import { statusBadgeClass, statusLabelDe } from './tuvReportUtils'

export function TuvReportStatusBadge({ status }: { status: TuvReportStatus | string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}
    >
      {statusLabelDe(status)}
    </span>
  )
}
