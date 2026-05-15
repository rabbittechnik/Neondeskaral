export type EmployeeWeekSchedulePublicEmployee = {
  id: string
  displayName: string
  shortName: string
  color: string
  role: string
}

export type EmployeeWeekScheduleShift = {
  id: string
  date: string
  startTime: string
  endTime: string
  workAreaId: string
  shiftType?: string
  employeeId: string | null
  employee: EmployeeWeekSchedulePublicEmployee | null
  publicationStatus: 'published' | 'draft'
}

export type EmployeeWeekScheduleWorkArea = {
  id: string
  name: string
  shortCode: string
  color: string
  description: string
}

export type EmployeeWeekSchedulePayload = {
  weekStart: string
  weekEnd: string
  calendarWeek: number
  calendarWeekYear: number
  stationId: string
  stationName: string
  shifts: EmployeeWeekScheduleShift[]
  workAreas: EmployeeWeekScheduleWorkArea[]
  holidays: { date: string; name: string }[]
  weekPublished?: boolean
  weekPublication?: {
    status: 'draft' | 'published'
    publishedAt: string | null
    hasUnpublishedChanges: boolean
    calendarWeek: number
    calendarWeekYear: number
  }
}
