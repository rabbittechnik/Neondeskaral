export type TaskRecurrence = 'once' | 'daily' | 'weekly' | 'monthly'

export type AssignedType = 'all' | 'employee' | 'role' | 'workArea'

export type TaskPriority = 'niedrig' | 'normal' | 'hoch' | 'kritisch'

export type TaskStatus =
  | 'offen'
  | 'erledigt'
  | 'überfällig'
  | 'in_kontrolle'
  | 'kontrolliert'
  | 'mangel'
  | 'deaktiviert'

export type ControlResult = 'ok' | 'mangel' | 'nacharbeiten'

export type TaskShiftHint = 'frueh' | 'spaet' | null

export type Task = {
  id: string
  title: string
  description: string
  workAreaId: string
  assignedType: AssignedType
  assignedEmployeeId?: string
  assignedRole?: string
  recurrenceType: TaskRecurrence
  startDate: string
  endDate?: string
  /** getDay(): 0 So … 6 Sa */
  weekdays?: number[]
  monthDay?: number
  startTime: string
  endTime: string
  confirmRequired: boolean
  controlRequired: boolean
  mandatory: boolean
  priority: TaskPriority
  active: boolean
  icon?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  note?: string
  /** Optional: Hinweis Früh-/Spätschicht (noch ohne Schichtplan-Logik) */
  shiftHint?: TaskShiftHint
  /** Server: Anzeigezeile (Schichtzeit, Zeitraum, Abschluss …) */
  timeCaption?: string
  taskKind?: string
  employeeSelfService?: boolean
  tabletStationBoard?: boolean
  assignedShiftType?: string
  requiredForShiftClose?: boolean
  /** Generator: stabiler Schlüssel der Vorlage (z. B. yearly_window_cleaning). */
  weekendTaskTemplateSlug?: string
  taskCategory?: string
}

export type TaskLog = {
  id: string
  taskId: string
  /** Mitarbeiter, dem der Log-Eintrag zugeordnet ist (Tablet/Schichtabschluss). */
  employeeId?: string
  date: string
  status: TaskStatus
  confirmedAt?: string
  confirmedBy?: string
  controlledAt?: string
  controlledBy?: string
  controlResult?: ControlResult
  comment?: string
  notDoneReason?: string
}
