import { Badge } from '../ui/Badge'
import type { TaskRecurrence } from '../../types/task'
import { TASK_RECURRENCE_LABELS } from './taskLabels'

export function TaskRecurrenceBadge({ recurrence }: { recurrence: TaskRecurrence }) {
  return (
    <Badge tone="default" className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
      {TASK_RECURRENCE_LABELS[recurrence]}
    </Badge>
  )
}
