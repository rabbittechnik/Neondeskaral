import type { ControlResult, TaskPriority, TaskRecurrence, TaskStatus } from '../../types/task'

export type TaskBadgeTone =
  | 'default'
  | 'cyan'
  | 'lime'
  | 'pink'
  | 'amber'
  | 'danger'
  | 'success'

export function taskStatusTone(status: TaskStatus): TaskBadgeTone {
  switch (status) {
    case 'offen':
      return 'cyan'
    case 'erledigt':
      return 'success'
    case 'überfällig':
      return 'danger'
    case 'in_kontrolle':
      return 'amber'
    case 'kontrolliert':
      return 'lime'
    case 'mangel':
      return 'danger'
    case 'deaktiviert':
    default:
      return 'default'
  }
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  offen: 'Offen',
  erledigt: 'Erledigt',
  überfällig: 'Überfällig',
  in_kontrolle: 'In Kontrolle',
  kontrolliert: 'Kontrolliert',
  mangel: 'Mangel',
  deaktiviert: 'Deaktiviert',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  niedrig: 'Niedrig',
  normal: 'Normal',
  hoch: 'Hoch',
  kritisch: 'Kritisch',
}

export function taskPriorityTone(p: TaskPriority): TaskBadgeTone {
  switch (p) {
    case 'niedrig':
      return 'default'
    case 'normal':
      return 'cyan'
    case 'hoch':
      return 'amber'
    case 'kritisch':
      return 'danger'
    default:
      return 'default'
  }
}

export const TASK_RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  once: 'Einmalig',
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
}

export const CONTROL_RESULT_LABELS: Record<ControlResult, string> = {
  ok: 'OK',
  mangel: 'Mangel',
  nacharbeiten: 'Nacharbeiten nötig',
}
