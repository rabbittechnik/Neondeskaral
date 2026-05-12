import type { Task, TaskStatus } from '../../types/task'
import type { Employee } from '../../types/employee'
import { getWorkAreaById } from '../../data/mockEmployees'
import { formatTaskAssigned, getTaskStatusForDate, recurrenceSummary } from '../../utils/taskUtils'
import { Badge } from '../ui/Badge'
import { TaskIcon } from './TaskIcon'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskActionButtons } from './TaskActionButtons'
import type { TaskLog } from '../../types/task'

type Props = {
  tasks: Task[]
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

function StatusCell({ status, active }: { status: TaskStatus | null; active: boolean }) {
  if (!active) return <Badge tone="default">Deaktiviert</Badge>
  if (!status) return <span className="text-xs text-[var(--text-faint)]">—</span>
  return <TaskStatusBadge status={status} />
}

export function TaskTable({
  tasks,
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
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/80 text-xs uppercase tracking-wide text-[var(--text-muted)]">
          <tr>
            <th className="px-3 py-3"> </th>
            <th className="px-3 py-3">Aufgabe</th>
            <th className="px-3 py-3">Bereich</th>
            <th className="px-3 py-3">Zuständig</th>
            <th className="px-3 py-3">Zeitfenster</th>
            <th className="px-3 py-3">Wiederholung</th>
            <th className="px-3 py-3">Bestätigen</th>
            <th className="px-3 py-3">Kontrolle</th>
            <th className="px-3 py-3">Pflicht</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const st = getTaskStatusForDate(task, logs, refDate, now)
            const area = getWorkAreaById(task.workAreaId)
            return (
              <tr
                key={task.id}
                className="group border-b border-[var(--border-subtle)]/50 transition hover:bg-cyan-500/[0.04] hover:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.12)]"
              >
                <td className="px-3 py-2 align-top text-cyan-200/90">
                  <TaskIcon name={task.icon} className="h-5 w-5" />
                </td>
                <td className="max-w-[240px] px-3 py-2 align-top">
                  <p className="font-medium text-[var(--text-main)]">{task.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-faint)]">{task.description}</p>
                  <div className="mt-1">
                    <TaskPriorityBadge priority={task.priority} />
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  <Badge tone="cyan" className="border border-cyan-400/30">
                    {area?.shortCode ?? task.workAreaId}
                  </Badge>
                  <span className="mt-1 block text-[10px] text-[var(--text-faint)]">{area?.name}</span>
                </td>
                <td className="px-3 py-2 align-top text-xs text-[var(--text-muted)]">{formatTaskAssigned(task, employees)}</td>
                <td className="px-3 py-2 align-top tabular-nums text-xs text-[var(--text-muted)]">
                  {task.startTime} – {task.endTime}
                </td>
                <td className="px-3 py-2 align-top text-xs text-[var(--text-muted)]">{recurrenceSummary(task)}</td>
                <td className="px-3 py-2 align-top text-xs">{task.confirmRequired ? 'Ja' : 'Nein'}</td>
                <td className="px-3 py-2 align-top text-xs">{task.controlRequired ? 'Ja' : 'Nein'}</td>
                <td className="px-3 py-2 align-top">
                  {task.mandatory ? (
                    <Badge tone="amber">Pflicht</Badge>
                  ) : (
                    <span className="text-xs text-[var(--text-faint)]">Nein</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <StatusCell status={st} active={task.active} />
                </td>
                <td className="px-3 py-2 align-top">
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
