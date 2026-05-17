/** Stammdaten-Mitarbeiter (erweitert für StationGuide-Felder). */

export type Salutation = 'herr' | 'frau' | 'divers' | 'none'

export type EmploymentType =
  | 'vollzeit'
  | 'teilzeit'
  | 'minijob'
  | 'aushilfe'
  | 'schueler'
  | 'werkstudent'
  | 'sonstige'

/** Anstellungs-/Anwesenheits-Anzeige in Listen & Filtern */
export type EmployeeHRStatus = 'aktiv' | 'inaktiv' | 'urlaub' | 'krank' | 'gesperrt' | 'geloescht'

/** Zusatz-Hinweis für Schichtplan-Leiste (optional) */
export type EmployeePlanHint = 'frei' | 'ueberstunden'

export type WorkAreaDefinition = {
  id: string
  name: string
  shortCode: string
  /** Hex, für Badges / Karten */
  color: string
  description?: string
  sortOrder?: number
  isDefault?: boolean
  active?: boolean
}

export type Employee = {
  id: string
  salutation: Salutation
  firstName: string
  lastName: string
  displayName: string
  shortName: string
  email: string
  /** @deprecated Legacy, gleichbedeutend mit mobilePhone */
  phone: string
  mobilePhone: string
  landlinePhone: string
  /** ISO YYYY-MM-DD */
  birthday: string
  personnelNumber: string
  role: string
  employmentRole: string
  employmentType: EmploymentType
  hourlyWage?: number
  monthlySalary?: number
  weeklyHours: number
  monthlyHours: number
  vacationDaysTotal: number
  vacationDaysUsed: number
  remainingVacationDays: number
  color: string
  status: EmployeeHRStatus
  /** Server: Soft-Delete-Zeitpunkt (nur Admin-Ansicht „gelöscht anzeigen“). */
  deletedAt?: string
  deletedBy?: string
  workAreaIds: string[]
  avatar?: string
  startDate: string
  endDate?: string
  notes: string
  /** Hinweis z. B. gesetzlicher Mindestlohn (vom Server gesetzt). */
  wageAdjustmentNote?: string
  statutoryMinimumHourlyToday?: number
  minimumWageMinijobHint?: string
  minimumWageProfilePayrollNote?: string
  minimumWageFestangestelltHint?: string
  planHint?: EmployeePlanHint
  cashRegisterCardNumber?: string
  terminalEnabled: boolean
  timeTrackingEnabled: boolean
  timeTrackingMode: string
  breakMode: string
  mobilePunchMode: string
  checkInMode: string
  checkOutMode: string
  employeeAppEnabled: boolean
  payType?: string
  maxHoursPerMonth?: number
  workDays?: string[]
  mankoMoney?: number
  vlAmount?: number
  hideInPayroll?: boolean
  overtimeEnabled: boolean
  overtimeStartValue?: number
  overtimeStartDate: string
  overtimeCurrentValue?: number
  overtimeAutoCalculate: boolean
  overtimeIncludeInReports: boolean
  iban?: string
  bic?: string
  accountHolder?: string
  vacationStartEnabled: boolean
  vacationStartValue?: number
  vacationStartDate: string
  annualVacationDays?: number
  vacationHoursPerDay?: number
  vacationAutoAverage13Weeks: boolean
  firstBreakValue?: number
  firstBreakAfterHours?: number
  secondBreakValue?: number
  secondBreakAfterHours?: number
  useStationBreakSettings: boolean
  ownBreakRuleEnabled: boolean
  surchargeMode: string
  nightSurchargePercent?: number
  nightSurchargeStart: string
  nightSurchargeEnd: string
  nightSurchargeAfterTwoHours: boolean
  saturdaySurchargePercent?: number
  sundaySurchargePercent?: number
  holidaySurchargePercent?: number
  specialHolidaySurchargePercent?: number
  night04SurchargePercent?: number
  night04AfterSundayPercent?: number
  night04AfterHolidayPercent?: number
  night04AfterSpecialHolidayPercent?: number
  surchargeCalculationMode: string
  hideContactInAddressBook: boolean
  showOnlyFirstNameInEmployeeApp: boolean
  visibleInTeamSchedule: boolean
  phoneVisibleToTeam: boolean
  emailVisibleToTeam: boolean
  employeeAccessToken?: string
  employeeAccessConfigured?: boolean
  employeeAccessEnabled?: boolean
  employeeAccessCreatedAt?: string
  employeeAccessLastUsedAt?: string
  preferredShiftTypes?: string[]
  preferredWorkDays?: string[]
  notPreferredWorkDays?: string[]
  canWorkWeekends?: boolean
  canWorkHolidays?: boolean
  maxPreferredDaysPerWeek?: number
  maxWeeklyHours?: number
  planningNotes?: string
  /** Nur beim Speichern setzen, nie aus API lesen */
  pin?: string
}

/** Für Schichtplan-Komponenten (abgeleitet aus Employee) */
export type ScheduleEmployeeRow = {
  id: string
  name: string
  role: string
  color: string
  avatar?: string
  monthlyHours: number
  /** Profilfeld max_hours_per_month — Obergrenze für geplante Monatsstunden */
  maxHoursPerMonth?: number
  weeklyTargetHours?: number
  /** Badge in Mitarbeiter-Leiste */
  schedulePresence:
    | 'aktiv'
    | 'urlaub'
    | 'krank'
    | 'frei'
    | 'ueberstunden'
    | 'inaktiv'
    | 'gesperrt'
}

export function toScheduleEmployeeRow(e: Employee): ScheduleEmployeeRow {
  let schedulePresence: ScheduleEmployeeRow['schedulePresence'] = 'aktiv'
  if (e.status === 'geloescht') schedulePresence = 'inaktiv'
  else if (e.status === 'inaktiv') schedulePresence = 'inaktiv'
  else if (e.status === 'gesperrt') schedulePresence = 'gesperrt'
  else if (e.status === 'urlaub') schedulePresence = 'urlaub'
  else if (e.status === 'krank') schedulePresence = 'krank'
  else if (e.planHint === 'frei') schedulePresence = 'frei'
  else if (e.planHint === 'ueberstunden') schedulePresence = 'ueberstunden'

  return {
    id: e.id,
    name: e.displayName,
    role: e.employmentRole || e.role,
    color: e.color,
    avatar: e.avatar,
    monthlyHours: e.monthlyHours,
    maxHoursPerMonth: e.maxHoursPerMonth,
    weeklyTargetHours: e.weeklyHours,
    schedulePresence,
  }
}
