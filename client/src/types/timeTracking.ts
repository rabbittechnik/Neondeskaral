export type TimeEntryStatus = 'running' | 'completed' | 'needs_review' | 'corrected' | 'cancelled'

export type TimeEntrySource =
  | 'cash_register_card_terminal'
  | 'manual'
  | 'system'
  | 'tablet'
  | 'employee_mobile_app'

export type TimeEntry = {
  id: string
  employeeId: string
  stationId: string
  shiftId?: string
  startAt: string
  endAt?: string
  breakMinutes: number
  status: TimeEntryStatus
  source: TimeEntrySource
  startedBy: string
  endedBy?: string
  startNote?: string
  endNote?: string
  createdAt: string
  updatedAt: string
}

export type ShiftCloseChecklist = {
  id: string
  timeEntryId: string
  employeeId: string
  fridgeFronted: boolean
  drinksFilled: boolean
  cigarettesFilled: boolean
  shelvesFilled: boolean
  trashEmptied: boolean
  counterClean: boolean
  coffeeAreaClean: boolean
  outsideChecked: boolean
  incidentsNoted: boolean
  handoverPossible: boolean
  closingReady: boolean
  everythingOk: boolean
  incidentNote: string
  completedAt: string
}

export type CardActionType = 'check_in' | 'check_out'

export type CardEntryResult =
  | 'success'
  | 'unknown_card'
  | 'already_checked_in'
  | 'not_checked_in'
  | 'not_scheduled'
  | 'too_early'
  | 'too_late'
  | 'checklist_required'
  | 'error'

export type CashRegisterCardEvent = {
  id: string
  cardNumber: string
  employeeId?: string
  stationId: string
  actionType: CardActionType
  scannedAt: string
  result: CardEntryResult
  message: string
}
