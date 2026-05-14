export type TaskTemplateType =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'weekend_dynamic'
  | 'yearly'
  | 'shift_close'
  | 'handover'
  | 'backshop'

export type TaskTemplate = {
  id: string
  stationId: string
  templateKey: string
  title: string
  description: string
  category: string
  templateType: string
  frequencyType: string
  appliesEveryShift: boolean
  appliesEarlyShift: boolean
  appliesLateShift: boolean
  weekendSatOnly: boolean
  weekendSunOnly: boolean
  appliesToWeekdays: number[]
  onlyWeekend: boolean
  isRequired: boolean
  requiredForShiftClose: boolean
  remarkRequiredIfNotDone: boolean
  dynamicAssignment: boolean
  maxPerYear: number | null
  maxPerMonth: number | null
  maxPerWeek: number | null
  tasksPerShift: number | null
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type TaskTemplateYearStat = {
  templateKey: string
  title: string
  completedThisYear: number
  maxPerYear: number | null
  lastDoneDate: string | null
  lastDoneBy: string | null
}

export type TaskTemplateAssignmentStat = {
  templateKey: string
  title: string
  lastAssignedAt: string | null
  lastAssignedEmployeeId: string | null
  lastCompletedAt: string | null
  completedThisYear: number
}
