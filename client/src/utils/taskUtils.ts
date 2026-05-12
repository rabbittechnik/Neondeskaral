import type { Task, TaskLog, TaskRecurrence, TaskShiftHint, TaskStatus } from '../types/task'
import type { Employee } from '../types/employee'

export function toISODateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes()
}

/** Liegt `date` im gültigen Start-/Enddatum der Aufgabe? */
export function isDateInTaskWindow(task: Task, date: string): boolean {
  if (date < task.startDate) return false
  if (task.endDate && date > task.endDate) return false
  return true
}

export function isTaskDueOnDate(task: Task, date: string): boolean {
  if (!task.active) return false
  if (!isDateInTaskWindow(task, date)) return false
  switch (task.recurrenceType) {
    case 'once':
      return task.startDate === date
    case 'daily':
      return true
    case 'weekly': {
      const wd = new Date(`${date}T12:00:00`).getDay()
      const set = task.weekdays?.length ? task.weekdays : [1, 2, 3, 4, 5, 6, 0]
      return set.includes(wd)
    }
    case 'monthly': {
      const dom = Number(date.slice(8, 10))
      return dom === (task.monthDay ?? 1)
    }
    default:
      return false
  }
}

export function isTaskDueToday(task: Task, date: string): boolean {
  return isTaskDueOnDate(task, date)
}

/** Logischer Status für einen Kalendertag (ohne deaktiviert: das kommt von `task.active`). */
export function getTaskStatusForDate(
  task: Task,
  logs: TaskLog[],
  date: string,
  now: Date = new Date(),
): TaskStatus | null {
  if (!task.active) return 'deaktiviert'
  if (!isTaskDueOnDate(task, date)) return null

  const log = logs.find((l) => l.taskId === task.id && l.date === date)
  if (log) {
    if (log.controlledAt) {
      if (log.controlResult === 'mangel' || log.controlResult === 'nacharbeiten') return 'mangel'
      return 'kontrolliert'
    }
    if (log.status === 'in_kontrolle') return 'in_kontrolle'
    if (log.status === 'erledigt' && task.controlRequired) return 'in_kontrolle'
    if (log.status === 'erledigt') return 'erledigt'
    return log.status
  }

  const todayIso = toISODateLocal(now)
  const endM = parseTimeToMinutes(task.endTime)
  if (date < todayIso) return 'überfällig'
  if (date > todayIso) return 'offen'
  if (minutesNow(now) > endM) return 'überfällig'
  return 'offen'
}

export function getOverdueTasks(tasks: Task[], logs: TaskLog[], date: string, now?: Date): Task[] {
  return tasks.filter((t) => {
    const st = getTaskStatusForDate(t, logs, date, now)
    return st === 'überfällig'
  })
}

export function getTasksByRecurrence(tasks: Task[], recurrence: TaskRecurrence): Task[] {
  return tasks.filter((t) => t.recurrenceType === recurrence)
}

export function getTasksForWorkArea(tasks: Task[], workAreaId: string): Task[] {
  if (!workAreaId) return tasks
  return tasks.filter((t) => t.workAreaId === workAreaId)
}

export function countOpenTasks(tasks: Task[], logs: TaskLog[], date: string, now?: Date): number {
  return tasks.filter((t) => {
    const st = getTaskStatusForDate(t, logs, date, now)
    return st === 'offen' || st === 'in_kontrolle'
  }).length
}

export function countOverdueTasks(tasks: Task[], logs: TaskLog[], date: string, now?: Date): number {
  return getOverdueTasks(tasks, logs, date, now).length
}

export function formatTaskAssigned(task: Task, employees: Employee[]): string {
  switch (task.assignedType) {
    case 'all':
      return 'Alle'
    case 'employee': {
      const e = employees.find((x) => x.id === task.assignedEmployeeId)
      return e?.displayName ?? '—'
    }
    case 'role':
      return task.assignedRole ? `Rolle: ${task.assignedRole}` : 'Rolle'
    case 'workArea':
      return 'Arbeitsbereich'
    default:
      return '—'
  }
}

export function shiftHintLabel(h?: TaskShiftHint | null): string | null {
  if (!h) return null
  if (h === 'frueh') return 'Fällig während Frühschicht'
  return 'Fällig während Spätschicht'
}

export function weekdayLabelsDe(task: Task): string {
  if (task.recurrenceType !== 'weekly' || !task.weekdays?.length) return '—'
  const names = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  return task.weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((d) => names[d] ?? d)
    .join(', ')
}

export function recurrenceSummary(task: Task): string {
  if (task.recurrenceType === 'once') return 'Einmalig'
  if (task.recurrenceType === 'daily') return 'Täglich'
  if (task.recurrenceType === 'weekly') return `Wöchentlich · ${weekdayLabelsDe(task)}`
  return `Monatlich · Tag ${task.monthDay ?? 1}`
}
