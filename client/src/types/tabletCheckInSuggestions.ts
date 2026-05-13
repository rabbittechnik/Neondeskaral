export type TabletCheckInSuggestionStatus = 'starts_soon' | 'shift_active'

export type TabletCheckInSuggestion = {
  employeeId: string
  employeeName: string
  shiftId: string
  plannedStart: string
  plannedEnd: string
  plannedStartAt?: string
  plannedEndAt?: string
  status: TabletCheckInSuggestionStatus
  /** Minuten relativ zum geplanten Schichtbeginn (negativ = vor Start). */
  deviationMinutes: number
  /** Vom Server berechneter Anzeigetext (Europe/Berlin). */
  displayText?: string
}

export type TabletCheckInAllEmployeeRow = {
  employeeId: string
  employeeName: string
  role: string
  isClockedIn: boolean
  /** Kurzinfo zur heutigen Schicht (Server, Europe/Berlin). */
  todayHint?: string
}

export type TabletCheckInSuggestionsPayload = {
  suggestions: TabletCheckInSuggestion[]
  allEmployees: TabletCheckInAllEmployeeRow[]
}
