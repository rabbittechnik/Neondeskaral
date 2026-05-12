import { Badge } from '../ui/Badge'
import type { TaskPriority } from '../../types/task'
import { TASK_PRIORITY_LABELS, taskPriorityTone } from './taskLabels'

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={taskPriorityTone(priority)}>{TASK_PRIORITY_LABELS[priority]}</Badge>
}
