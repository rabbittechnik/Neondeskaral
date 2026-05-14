export type TimeEntryStatus = 'running' | 'completed' | 'needs_review' | 'corrected' | 'cancelled'

export type TimeEntryApprovalStatus = 'pending' | 'approved' | 'rejected' | 'correction_required'

export type TimeEntrySource =
  | 'cash_register_card_terminal'
  | 'manual'
  | 'system'
  | 'tablet'
  | 'employee_mobile_app'

export type TimeEntry = {
  id: string
  employeeId: string
  /** Aus API (Join employees), für Anzeige ohne Client-Cache */
  employeeName?: string
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
  approvalStatus?: TimeEntryApprovalStatus
  approvedBy?: string
  approvedAt?: string
  rejectedBy?: string
  rejectedAt?: string
  rejectionReason?: string
  correctionNote?: string
  payrollRelevant?: boolean
  /** Stations-Tablet / Planabweichung (Server) */
  plannedStartAt?: string
  startDeviationMinutes?: number
  startDeviationType?: 'early' | 'late' | 'no_planned_shift' | 'on_time'
  plannedEndAt?: string
  endDeviationMinutes?: number
  endDeviationType?: 'early' | 'late' | 'no_planned_shift' | 'on_time'
  /** Stations-Tablet: Pflichtgrund bei >30 Min. vor Plan-Ende */
  earlyLeaveMinutes?: number
  earlyLeaveReason?: string
  earlyLeaveNote?: string
  earlyLeaveConfirmedAt?: string
  earlyLeaveConfirmedByEmployeeId?: string
  /** Rohstempel (bei Korrektur); sonst = startAt */
  stampedStartAt?: string
  stampedEndAt?: string
  stampedBreakMinutes?: number
  effectiveStartAt?: string
  effectiveEndAt?: string
  effectiveBreakMinutes?: number
  latestCorrectionKind?: string
  needsAutoClockOutReview?: boolean
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
  /** Optional: Kassendifferenz beim Schichtabschluss (€), Standard 0 */
  cashDifference?: number
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
  | 'shift_warnings_pending'
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
