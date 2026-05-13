export type TabletCheckInSuggestionStatus = 'starts_soon' | 'should_have_started' | 'currently_running'

export type TabletCheckInSuggestion = {
  employeeId: string
  employeeName: string
  shiftId: string
  plannedStart: string
  plannedEnd: string
  status: TabletCheckInSuggestionStatus
  deviationMinutes: number
}

export type TabletCheckInAllEmployeeRow = {
  employeeId: string
  employeeName: string
  role: string
  isClockedIn: boolean
}

export type TabletCheckInSuggestionsPayload = {
  suggestions: TabletCheckInSuggestion[]
  allEmployees: TabletCheckInAllEmployeeRow[]
}
