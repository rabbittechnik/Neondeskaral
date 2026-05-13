export type AbsenceType =
  | 'paid_vacation'
  | 'unpaid_vacation'
  | 'day_off'
  | 'sick'
  | 'special_leave'
  | 'child_sick'
  | 'other'
  | 'school'

export type AbsenceStatus = 'beantragt' | 'genehmigt' | 'abgelehnt' | 'storniert' | 'erfasst'

export type Absence = {
  id: string
  employeeId: string
  type: AbsenceType
  /** ISO YYYY-MM-DD */
  startDate: string
  endDate: string
  halfDay: boolean
  status: AbsenceStatus
  comment: string
  /** ISO datetime */
  requestedAt: string
  approvedBy?: string
  approvedAt?: string
  rejectedReason?: string
  /** Hinweis aus Konfliktprüfung (optional gespeichert) */
  conflictHint?: string
  paid?: boolean
  countsAgainstVacation?: boolean
  paidHoursPerDay?: number
  paidHoursTotal?: number
  absenceDays?: number
}

export type VacationBlock = {
  id: string
  title: string
  startDate: string
  endDate: string
  description: string
  workAreaIds: string[]
  active: boolean
}
