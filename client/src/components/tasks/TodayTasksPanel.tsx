import { Link } from 'react-router-dom'
import type { Task, TaskLog } from '../../types/task'
import { isTaskDueOnDate, getTaskStatusForDate } from '../../utils/taskUtils'
import { Badge } from '../ui/Badge'
import { TaskStatusBadge } from './TaskStatusBadge'
import { Card } from '../ui/Card'

type Props = {
  tasks: Task[]
  logs: TaskLog[]
  refDate: string
}

export function TodayTasksPanel({ tasks, logs, refDate }: Props) {
  const due = tasks.filter((t) => t.active && isTaskDueOnDate(t, refDate))
  const now = new Date()
  return (
    <Card className="border-emerald-500/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">Heute fällig</h3>
        <Badge tone="cyan">{due.length} Aufgaben</Badge>
      </div>
      <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {due.length === 0 ? (
          <li className="text-xs text-[var(--text-faint)]">Keine Aufgaben für heute.</li>
        ) : (
          due.map((t) => {
            const st = getTaskStatusForDate(t, logs, refDate, now)
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-black/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-main)]">{t.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {t.startTime} – {t.endTime}
                  </p>
                </div>
                <div className="shrink-0">{st ? <TaskStatusBadge status={st} /> : null}</div>
              </li>
            )
          })
        )}
      </ul>
      <Link
        to="/tasks"
        className="mt-3 inline-block text-xs font-medium text-cyan-300/90 underline-offset-2 hover:underline"
      >
        Alle Aufgaben
      </Link>
    </Card>
  )
}
