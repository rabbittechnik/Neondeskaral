import type { EmploymentType } from '../../types/employee'
import { EMPLOYMENT_LABELS } from './employeeLabels'

export function EmploymentTypeBadge({
  type,
  className = '',
}: {
  type: EmploymentType
  className?: string
}) {
  return (
    <span
      className={`inline-flex rounded-md border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100/90 ${className}`}
    >
      {EMPLOYMENT_LABELS[type]}
    </span>
  )
}
