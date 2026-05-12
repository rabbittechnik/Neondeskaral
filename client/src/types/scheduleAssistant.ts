/** Schichtplan-Assistent (Phase 10), aligned with server payloads. */

export type AssistantMode = 'fill_gaps' | 'replace_drafts' | 'full_refresh'

export type AssistantSlotKind = 'early' | 'late' | 'night' | 'middle' | 'short' | 'school'

export type DayRequirementSlot = {
  kind: AssistantSlotKind
  startTime: string
  endTime: string
  workAreaId: string
  required: boolean
}

export type DayRequirement = {
  date: string
  slots: DayRequirementSlot[]
}

export type AssistantSuggestedShift = {
  id: string
  date: string
  startTime: string
  endTime: string
  workAreaId: string
  shiftType: string
  employeeId: string | null
  employeeName?: string
  score: number
  level: 'good' | 'warn' | 'bad'
  hints: string[]
  existingShiftId?: string
}

export type ScheduleAssistantGenerateResult = {
  suggestedShifts: AssistantSuggestedShift[]
  warnings: string[]
  scoreDetails: AssistantSuggestedShift[]
}

export type ScheduleAssistantApplyResult = {
  created: string[]
  updated: string[]
}
