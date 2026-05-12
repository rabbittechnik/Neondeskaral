export type AbsenceType =
  | 'urlaub'
  | 'krankheit'
  | 'berufsschule'
  | 'frei'
  | 'sonderurlaub'
  | 'unbezahlt'
  | 'kind_krank'
  | 'sonstiges'

export type AbsenceStatus = 'beantragt' | 'genehmigt' | 'abgelehnt' | 'storniert'

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
