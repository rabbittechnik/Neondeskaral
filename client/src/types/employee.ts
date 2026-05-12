/** Stammdaten-Mitarbeiter (Phase 4, ohne API). */

export type EmploymentType =
  | 'vollzeit'
  | 'teilzeit'
  | 'minijob'
  | 'aushilfe'
  | 'schueler'
  | 'sonstige'

/** Anstellungs-/Anwesenheits-Anzeige in Listen & Filtern */
export type EmployeeHRStatus = 'aktiv' | 'inaktiv' | 'urlaub' | 'krank'

/** Zusatz-Hinweis für Schichtplan-Leiste (optional) */
export type EmployeePlanHint = 'frei' | 'ueberstunden'

export type WorkAreaDefinition = {
  id: string
  name: string
  shortCode: string
  /** Hex, für Badges / Karten */
  color: string
}

export type Employee = {
  id: string
  firstName: string
  lastName: string
  displayName: string
  email: string
  phone: string
  /** ISO YYYY-MM-DD */
  birthday: string
  role: string
  employmentType: EmploymentType
  hourlyWage: number
  monthlySalary?: number
  /** Vertrags-Soll Wochenstunden */
  weeklyHours: number
  /** Dummy-Ist Monatsstunden (Anzeige) */
  monthlyHours: number
  vacationDaysTotal: number
  vacationDaysUsed: number
  remainingVacationDays: number
  color: string
  status: EmployeeHRStatus
  workAreaIds: string[]
  avatar?: string
  /** ISO YYYY-MM-DD */
  startDate: string
  endDate?: string
  notes: string
  planHint?: EmployeePlanHint
  /** Kassenkartennummer fürs Mitarbeiter-Terminal (Dummy, keine echten Karten). */
  cashRegisterCardNumber: string
  /** Terminal-Stempeln erlaubt */
  terminalEnabled: boolean
  /** Zeiterfassung aktiv */
  timeTrackingEnabled: boolean
  /** Persönlicher Mitarbeiter-App-Token (nur Admin-API, nicht in Mitarbeiter-App) */
  employeeAccessToken?: string
  employeeAccessConfigured?: boolean
  employeeAccessEnabled?: boolean
  employeeAccessCreatedAt?: string
  employeeAccessLastUsedAt?: string
  /** Schichtplan-Assistent (JSON-Arrays aus API) */
  preferredShiftTypes?: string[]
  preferredWorkDays?: string[]
  notPreferredWorkDays?: string[]
  canWorkWeekends?: boolean
  canWorkHolidays?: boolean
  maxPreferredDaysPerWeek?: number
  maxWeeklyHours?: number
  planningNotes?: string
}

/** Für Schichtplan-Komponenten (abgeleitet aus Employee) */
export type ScheduleEmployeeRow = {
  id: string
  name: string
  role: string
  color: string
  avatar?: string
  monthlyHours: number
  weeklyTargetHours?: number
  /** Badge in Mitarbeiter-Leiste */
  schedulePresence:
    | 'aktiv'
    | 'urlaub'
    | 'krank'
    | 'frei'
    | 'ueberstunden'
    | 'inaktiv'
}

export function toScheduleEmployeeRow(e: Employee): ScheduleEmployeeRow {
  let schedulePresence: ScheduleEmployeeRow['schedulePresence'] = 'aktiv'
  if (e.status === 'inaktiv') schedulePresence = 'inaktiv'
  else if (e.status === 'urlaub') schedulePresence = 'urlaub'
  else if (e.status === 'krank') schedulePresence = 'krank'
  else if (e.planHint === 'frei') schedulePresence = 'frei'
  else if (e.planHint === 'ueberstunden') schedulePresence = 'ueberstunden'

  return {
    id: e.id,
    name: e.displayName,
    role: e.role,
    color: e.color,
    avatar: e.avatar,
    monthlyHours: e.monthlyHours,
    weeklyTargetHours: e.weeklyHours,
    schedulePresence,
  }
}
