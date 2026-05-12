import { Badge } from '../ui/Badge'
import type { TaskStatus } from '../../types/task'
import { TASK_STATUS_LABELS, taskStatusTone } from './taskLabels'

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={taskStatusTone(status)}>{TASK_STATUS_LABELS[status]}</Badge>
}
