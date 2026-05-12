import type { Task, TaskLog } from '../../types/task'
import type { Employee } from '../../types/employee'
import { getWorkAreaById } from '../../data/mockEmployees'
import { formatTaskAssigned, getTaskStatusForDate, recurrenceSummary, shiftHintLabel } from '../../utils/taskUtils'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { TaskIcon } from './TaskIcon'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskActionButtons } from './TaskActionButtons'

type Props = {
  task: Task
  logs: TaskLog[]
  employees: Employee[]
  refDate: string
  now?: Date
  onView: (t: Task) => void
  onEdit: (t: Task) => void
  onToggleActive: (t: Task) => void
  onDelete: (t: Task) => void
  onConfirm: (t: Task) => void
  onControl: (t: Task) => void
}

export function TaskCard({
  task,
  logs,
  employees,
  refDate,
  now = new Date(),
  onView,
  onEdit,
  onToggleActive,
  onDelete,
  onConfirm,
  onControl,
}: Props) {
  const st = getTaskStatusForDate(task, logs, refDate, now)
  const area = getWorkAreaById(task.workAreaId)
  const hint = shiftHintLabel(task.shiftHint)
  return (
    <Card
      padding="md"
      className="border-cyan-500/15 transition hover:border-cyan-400/35 hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 p-2 text-cyan-200">
          <TaskIcon name={task.icon} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--text-main)]">{task.title}</p>
          <p className="mt-1 line-clamp-3 text-xs text-[var(--text-faint)]">{task.description}</p>
          {hint ? <p className="mt-1 text-[10px] text-violet-300/90">{hint}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="cyan" className="border border-cyan-400/30">
              {area?.name ?? task.workAreaId}
            </Badge>
            <TaskPriorityBadge priority={task.priority} />
            {task.mandatory ? <Badge tone="amber">Pflicht</Badge> : null}
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {task.startTime} – {task.endTime} · {recurrenceSummary(task)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Zuständig: {formatTaskAssigned(task, employees)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!task.active ? (
              <Badge tone="default">Deaktiviert</Badge>
            ) : st ? (
              <TaskStatusBadge status={st} />
            ) : (
              <span className="text-xs text-[var(--text-faint)]">Heute nicht fällig</span>
            )}
          </div>
          <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
            <TaskActionButtons
              task={task}
              status={st}
              onView={() => onView(task)}
              onEdit={() => onEdit(task)}
              onToggleActive={() => onToggleActive(task)}
              onDelete={() => onDelete(task)}
              onConfirm={() => onConfirm(task)}
              onControl={() => onControl(task)}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
