import type { Task, TaskLog, TaskRecurrence } from '../../types/task'
import { getTaskStatusForDate } from '../../utils/taskUtils'

export type TaskStatusFilter =
  | 'all'
  | 'aktiv'
  | 'deaktiviert'
  | 'offen'
  | 'erledigt'
  | 'überfällig'
  | 'in_kontrolle'
  | 'kontrolliert'
  | 'mangel'

export type TaskRecurrenceTab = 'all' | TaskRecurrence

export type TaskListFilters = {
  search: string
  workAreaId: string
  status: TaskStatusFilter
  recurrence: TaskRecurrenceTab
  assignee: string
}

export function applyTaskFilters(
  tasks: Task[],
  logs: TaskLog[],
  f: TaskListFilters,
  date: string,
  now: Date = new Date(),
): Task[] {
  const q = f.search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (f.recurrence !== 'all' && task.recurrenceType !== f.recurrence) return false
    if (f.workAreaId && task.workAreaId !== f.workAreaId) return false
    if (q) {
      const blob = `${task.title} ${task.description} ${task.note ?? ''}`.toLowerCase()
      if (!blob.includes(q)) return false
    }
    if (f.assignee !== 'all') {
      if (task.assignedType === 'employee') {
        if (task.assignedEmployeeId !== f.assignee) return false
      } else {
        return false
      }
    }
    if (f.status === 'aktiv' && !task.active) return false
    if (f.status === 'deaktiviert' && task.active) return false
    if (
      f.status !== 'all' &&
      f.status !== 'aktiv' &&
      f.status !== 'deaktiviert'
    ) {
      const st = getTaskStatusForDate(task, logs, date, now)
      if (st !== f.status) return false
    }
    return true
  })
}
