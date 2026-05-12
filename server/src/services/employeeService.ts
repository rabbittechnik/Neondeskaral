import type { Database } from 'better-sqlite3'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'
import {
  RB_ACCESS_DISABLED,
  RB_EMPLOYEE_INACTIVE,
  RB_EMPLOYEE_REMOVED,
  RB_TOKEN_REGEN,
  reactivateDevicesAfterAccessReEnabled,
  revokeAllDevicesForEmployee,
} from './employeeAppDeviceService.js'

function jsonStringArrayFromBody(body: Record<string, unknown>, key: string): string {
  const v = body[key]
  if (v == null) return '[]'
  if (Array.isArray(v)) return JSON.stringify(v.map(String))
  return '[]'
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw || !String(raw).trim()) return []
  try {
    const j = JSON.parse(raw) as unknown
    return Array.isArray(j) ? j.map((x) => String(x)) : []
  } catch {
    return []
  }
}

function parseJsonStringArrayFromRow(row: Record<string, unknown>, key: string): string[] {
  return parseJsonStringArray(row[key] as string | null | undefined)
}

export type EmployeeRow = {
  id: string
  station_id: string
  first_name: string
  last_name: string
  display_name: string
  email: string | null
  phone: string | null
  birthday: string | null
  role: string | null
  employment_type: string | null
  hourly_wage: number | null
  monthly_salary: number | null
  weekly_hours: number | null
  monthly_hours: number | null
  vacation_days_total: number | null
  vacation_days_used: number | null
  color: string | null
  status: string | null
  cash_register_card_number: string | null
  terminal_enabled: number | null
  time_tracking_enabled: number | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  active: number | null
  employee_access_token?: string | null
  employee_access_enabled?: number | null
  employee_access_created_at?: string | null
  employee_access_last_used_at?: string | null
  preferred_shift_types_json?: string | null
  preferred_work_days_json?: string | null
  not_preferred_work_days_json?: string | null
  can_work_weekends?: number | null
  can_work_holidays?: number | null
  max_preferred_days_per_week?: number | null
  max_weekly_hours?: number | null
  planning_notes?: string | null
  created_at?: string | null
  updated_at?: string | null
} & Record<string, unknown>

const SENSITIVE_API_KEYS = new Set([
  'hourlyWage',
  'monthlySalary',
  'iban',
  'bic',
  'accountHolder',
  'cashRegisterCardNumber',
  'mankoMoney',
  'vlAmount',
  'hideInPayroll',
  'payType',
  'maxHoursPerMonth',
  'workDays',
])

export function hashEmployeePin(pin: string): string {
  return createHash('sha256').update(`neonshift-pin|${pin}`).digest('hex')
}

function mapStatusToFrontend(dbStatus: string | null, active: number | null, row?: Record<string, unknown>): string {
  if (row && String(row.deleted_at ?? '').trim()) return 'geloescht'
  const ds = String(dbStatus ?? '').toLowerCase()
  if (ds === 'deleted' || ds === 'geloescht') return 'geloescht'
  if (active === 0) return 'inaktiv'
  if (dbStatus === 'inactive') return 'inaktiv'
  if (dbStatus === 'blocked' || dbStatus === 'gesperrt') return 'gesperrt'
  if (dbStatus === 'urlaub' || dbStatus === 'krank') return dbStatus
  return 'aktiv'
}

function rStr(row: Record<string, unknown>, k: string): string {
  const v = row[k]
  return v == null ? '' : String(v)
}

function rNum(row: Record<string, unknown>, k: string, fallback = 0): number {
  const v = row[k]
  if (v == null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function rOptNum(row: Record<string, unknown>, k: string): number | undefined {
  const v = row[k]
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function rBool(row: Record<string, unknown>, k: string, def = true): boolean {
  const v = row[k]
  if (v == null) return def
  return Number(v) === 1
}

function rowToEmployeeApiFull(row: EmployeeRow, workAreaIds: string[], includeAccessToken: boolean) {
  const R = row as Record<string, unknown>
  const total = rNum(R, 'vacation_days_total', 0)
  const used = rNum(R, 'vacation_days_used', 0)
  const token = rStr(R, 'employee_access_token').trim()
  const configured = Boolean(token)
  const enabled = rBool(R, 'employee_access_enabled', true)
  const mobile = rStr(R, 'mobile_phone') || rStr(R, 'phone')
  const landline = rStr(R, 'landline_phone')
  const workDays = parseJsonStringArrayFromRow(R, 'work_days_json')

  const api: Record<string, unknown> = {
    id: row.id,
    salutation: rStr(R, 'salutation') || 'none',
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    shortName: rStr(R, 'short_name'),
    email: row.email ?? '',
    phone: mobile,
    mobilePhone: mobile,
    landlinePhone: landline,
    birthday: row.birthday ?? '',
    personnelNumber: rStr(R, 'personnel_number'),
    role: row.role ?? '',
    employmentRole: rStr(R, 'employment_role') || row.role || '',
    employmentType: (row.employment_type ?? 'teilzeit') as string,
    hourlyWage: rNum(R, 'hourly_wage', 0),
    monthlySalary: rOptNum(R, 'monthly_salary'),
    weeklyHours: rNum(R, 'weekly_hours', 0),
    monthlyHours: rNum(R, 'monthly_hours', 0),
    vacationDaysTotal: total,
    vacationDaysUsed: used,
    remainingVacationDays: Math.max(0, total - used),
    color: row.color ?? '#22d3ee',
    status: mapStatusToFrontend(row.status, row.active, R),
    workAreaIds,
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? undefined,
    notes: row.notes ?? '',
    cashRegisterCardNumber: rStr(R, 'cash_register_card_number'),
    terminalEnabled: rBool(R, 'terminal_enabled', true),
    timeTrackingEnabled: rBool(R, 'time_tracking_enabled', true),
    timeTrackingMode: rStr(R, 'time_tracking_mode') || 'station_default',
    breakMode: rStr(R, 'break_mode') || 'station_default',
    mobilePunchMode: rStr(R, 'mobile_punch_mode') || 'station_default',
    checkInMode: rStr(R, 'check_in_mode') || 'station_default',
    checkOutMode: rStr(R, 'check_out_mode') || 'station_default',
    employeeAppEnabled: rBool(R, 'employee_app_enabled', true),
    payType: rStr(R, 'pay_type') || 'hourly',
    maxHoursPerMonth: rOptNum(R, 'max_hours_per_month'),
    workDays: workDays.length ? workDays : ['mo', 'di', 'mi', 'do', 'fr'],
    mankoMoney: rNum(R, 'manko_money', 0),
    vlAmount: rNum(R, 'vl_amount', 0),
    hideInPayroll: rBool(R, 'hide_in_payroll', false),
    overtimeEnabled: rBool(R, 'overtime_enabled', false),
    overtimeStartValue: rOptNum(R, 'overtime_start_value'),
    overtimeStartDate: rStr(R, 'overtime_start_date'),
    overtimeCurrentValue: rOptNum(R, 'overtime_current_value'),
    overtimeAutoCalculate: rBool(R, 'overtime_auto_calculate', false),
    overtimeIncludeInReports: rBool(R, 'overtime_include_in_reports', true),
    iban: rStr(R, 'iban'),
    bic: rStr(R, 'bic'),
    accountHolder: rStr(R, 'account_holder'),
    vacationStartEnabled: rBool(R, 'vacation_start_enabled', false),
    vacationStartValue: rOptNum(R, 'vacation_start_value'),
    vacationStartDate: rStr(R, 'vacation_start_date'),
    annualVacationDays: rOptNum(R, 'annual_vacation_days'),
    vacationHoursPerDay: rOptNum(R, 'vacation_hours_per_day'),
    vacationAutoAverage13Weeks: rBool(R, 'vacation_auto_average_13_weeks', false),
    firstBreakValue: rOptNum(R, 'first_break_value'),
    firstBreakAfterHours: rOptNum(R, 'first_break_after_hours'),
    secondBreakValue: rOptNum(R, 'second_break_value'),
    secondBreakAfterHours: rOptNum(R, 'second_break_after_hours'),
    useStationBreakSettings: rBool(R, 'use_station_break_settings', true),
    ownBreakRuleEnabled: rBool(R, 'own_break_rule_enabled', false),
    surchargeMode: rStr(R, 'surcharge_mode') || 'none',
    nightSurchargePercent: rOptNum(R, 'night_surcharge_percent'),
    nightSurchargeStart: rStr(R, 'night_surcharge_start'),
    nightSurchargeEnd: rStr(R, 'night_surcharge_end'),
    nightSurchargeAfterTwoHours: rBool(R, 'night_surcharge_after_two_hours', false),
    saturdaySurchargePercent: rOptNum(R, 'saturday_surcharge_percent'),
    sundaySurchargePercent: rOptNum(R, 'sunday_surcharge_percent'),
    holidaySurchargePercent: rOptNum(R, 'holiday_surcharge_percent'),
    specialHolidaySurchargePercent: rOptNum(R, 'special_holiday_surcharge_percent'),
    night04SurchargePercent: rOptNum(R, 'night_0_4_surcharge_percent'),
    night04AfterSundayPercent: rOptNum(R, 'night_0_4_after_sunday_percent'),
    night04AfterHolidayPercent: rOptNum(R, 'night_0_4_after_holiday_percent'),
    night04AfterSpecialHolidayPercent: rOptNum(R, 'night_0_4_after_special_holiday_percent'),
    surchargeCalculationMode: rStr(R, 'surcharge_calculation_mode') || 'higher',
    hideContactInAddressBook: rBool(R, 'hide_contact_in_address_book', false),
    showOnlyFirstNameInEmployeeApp: rBool(R, 'show_only_first_name_in_employee_app', false),
    visibleInTeamSchedule: rBool(R, 'visible_in_team_schedule', true),
    phoneVisibleToTeam: rBool(R, 'phone_visible_to_team', true),
    emailVisibleToTeam: rBool(R, 'email_visible_to_team', true),
    employeeAccessConfigured: configured,
    /** Roh-Flag aus DB; sinnvoll nur wenn ein Token existiert (Zugang aktiv vs. deaktiviert). */
    employeeAccessEnabled: enabled,
    employeeAccessCreatedAt: rStr(R, 'employee_access_created_at') || undefined,
    employeeAccessLastUsedAt: rStr(R, 'employee_access_last_used_at') || undefined,
    preferredShiftTypes: parseJsonStringArray(row.preferred_shift_types_json),
    preferredWorkDays: parseJsonStringArray(row.preferred_work_days_json),
    notPreferredWorkDays: parseJsonStringArray(row.not_preferred_work_days_json),
    canWorkWeekends: rBool(R, 'can_work_weekends', true),
    canWorkHolidays: rBool(R, 'can_work_holidays', true),
    maxPreferredDaysPerWeek: rOptNum(R, 'max_preferred_days_per_week'),
    maxWeeklyHours: rOptNum(R, 'max_weekly_hours'),
    planningNotes: rStr(R, 'planning_notes'),
    deletedAt: rStr(R, 'deleted_at').trim() || undefined,
    deletedBy: rStr(R, 'deleted_by').trim() || undefined,
  }
  if (includeAccessToken) api.employeeAccessToken = token
  return api as EmployeeApi
}

export type EmployeeApi = {
  id: string
  salutation: string
  firstName: string
  lastName: string
  displayName: string
  shortName: string
  email: string
  phone: string
  mobilePhone: string
  landlinePhone: string
  birthday: string
  personnelNumber: string
  role: string
  employmentRole: string
  employmentType: string
  hourlyWage?: number
  monthlySalary?: number
  weeklyHours: number
  monthlyHours: number
  vacationDaysTotal: number
  vacationDaysUsed: number
  remainingVacationDays: number
  color: string
  status: string
  workAreaIds: string[]
  startDate: string
  endDate?: string
  notes: string
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
  employeeAccessConfigured: boolean
  employeeAccessEnabled: boolean
  employeeAccessCreatedAt?: string
  employeeAccessLastUsedAt?: string
  preferredShiftTypes: string[]
  preferredWorkDays: string[]
  notPreferredWorkDays: string[]
  canWorkWeekends: boolean
  canWorkHolidays: boolean
  maxPreferredDaysPerWeek?: number
  maxWeeklyHours?: number
  planningNotes: string
  deletedAt?: string
  deletedBy?: string
  employeeAccessToken?: string
}

export function filterEmployeeSensitiveFields(api: EmployeeApi, includeSensitive: boolean): EmployeeApi {
  if (includeSensitive) return api
  const out = { ...api }
  for (const k of SENSITIVE_API_KEYS) delete (out as Record<string, unknown>)[k]
  return out
}

export function rowToEmployeeApi(
  row: EmployeeRow,
  workAreaIds: string[],
  opts?: { includeAccessToken?: boolean; includeSensitive?: boolean },
): EmployeeApi {
  const raw = rowToEmployeeApiFull(row, workAreaIds, Boolean(opts?.includeAccessToken))
  return filterEmployeeSensitiveFields(raw, Boolean(opts?.includeSensitive))
}

/** Nicht soft-gelöscht: weder Zeitstempel noch Status „deleted“. */
function sqlEmployeeNotSoftDeleted(alias = ''): string {
  const p = alias ? `${alias}.` : ''
  return `( (COALESCE(${p}deleted_at, '') = '' OR trim(${p}deleted_at) = '')
    AND lower(trim(COALESCE(${p}status, ''))) != 'deleted' )`
}

/** Für Standardliste: explizit oder per COALESCE als aktiv behandeln (Legacy-Zeilen mit NULL). */
function sqlEmployeeActive(alias = ''): string {
  const p = alias ? `${alias}.` : ''
  return `(COALESCE(${p}active, 1) = 1)`
}

export function listEmployees(
  db: Database,
  stationId = DEFAULT_STATION_ID,
  opts?: {
    includeInactive?: boolean
    includeDeleted?: boolean
    includeSensitive?: boolean
    includeAccessTokens?: boolean
  },
) {
  const showDeleted = opts?.includeDeleted === true
  const showInactive = opts?.includeInactive === true

  let where = 'station_id = ?'
  if (!showDeleted) {
    where += ` AND ${sqlEmployeeNotSoftDeleted()}`
    if (!showInactive) {
      where += ` AND ${sqlEmployeeActive()}`
    }
  }

  const sql = `SELECT * FROM employees WHERE ${where} ORDER BY display_name`
  const rows = db.prepare(sql).all(stationId) as EmployeeRow[]
  const waStmt = db.prepare(`SELECT work_area_id FROM employee_work_areas WHERE employee_id = ?`)
  const sens = Boolean(opts?.includeSensitive)
  return rows.map((r) =>
    rowToEmployeeApi(r, (waStmt.all(r.id) as { work_area_id: string }[]).map((x) => x.work_area_id), {
      includeAccessToken: false,
      includeSensitive: sens,
    }),
  )
}

export function getEmployee(db: Database, id: string, opts?: { includeAccessToken?: boolean; includeSensitive?: boolean }) {
  const row = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id) as EmployeeRow | undefined
  if (!row) return undefined
  const wa = db
    .prepare(`SELECT work_area_id FROM employee_work_areas WHERE employee_id = ?`)
    .all(id)
    .map((x) => (x as { work_area_id: string }).work_area_id)
  return rowToEmployeeApi(row, wa, {
    includeAccessToken: opts?.includeAccessToken !== false,
    includeSensitive: Boolean(opts?.includeSensitive),
  })
}

export function getEmployeeByCard(db: Database, cardNumber: string, stationId = DEFAULT_STATION_ID) {
  const row = db
    .prepare(
      `SELECT * FROM employees WHERE station_id = ? AND cash_register_card_number = ?
       AND (COALESCE(active, 1) = 1)
       AND (COALESCE(deleted_at, '') = '' OR trim(deleted_at) = '')
       AND lower(trim(COALESCE(status, ''))) != 'deleted'`,
    )
    .get(stationId, cardNumber.trim()) as EmployeeRow | undefined
  if (!row) return undefined
  return getEmployee(db, row.id, { includeAccessToken: false, includeSensitive: false })
}

function syncWorkAreas(db: Database, employeeId: string, stationId: string, workAreaIds: string[]) {
  db.prepare(`DELETE FROM employee_work_areas WHERE employee_id = ?`).run(employeeId)
  const insWa = db.prepare(
    `INSERT INTO employee_work_areas (id, employee_id, station_id, work_area_id) VALUES (?, ?, ?, ?)`,
  )
  for (const wid of workAreaIds) {
    insWa.run(randomUUID(), employeeId, stationId, wid)
  }
}

export function createEmployee(
  db: Database,
  body: Record<string, unknown>,
  stationId = DEFAULT_STATION_ID,
  opts?: { allowSensitive?: boolean },
) {
  const allowSensitive = Boolean(opts?.allowSensitive)
  const first = String(body.firstName ?? '').trim()
  const last = String(body.lastName ?? '').trim()
  const displayName =
    String(body.displayName ?? '').trim() || `${first} ${last}`.trim() || 'Neuer Mitarbeiter'
  if (!first || !last) throw new Error('Vorname und Nachname erforderlich')
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : randomUUID()
  const ts = nowIso()
  const workAreaIds = Array.isArray(body.workAreaIds) ? (body.workAreaIds as string[]).filter(Boolean) : ['kasse']
  if (workAreaIds.length === 0) throw new Error('Mindestens ein Arbeitsbereich')

  const accessTok = randomBytes(32).toString('hex')
  const pinRaw = typeof body.pin === 'string' ? body.pin.trim() : ''
  const pinHash = allowSensitive && pinRaw ? hashEmployeePin(pinRaw) : null

  const hourly = allowSensitive && body.hourlyWage !== undefined ? Number(body.hourlyWage) : 14
  const monthlySal = allowSensitive && body.monthlySalary != null ? Number(body.monthlySalary) : null
  const iban = allowSensitive ? String(body.iban ?? '').trim() || null : null
  const bic = allowSensitive ? String(body.bic ?? '').trim() || null : null
  const accHolder = allowSensitive ? String(body.accountHolder ?? '').trim() || null : null
  const cardNo = allowSensitive ? String(body.cashRegisterCardNumber ?? '').trim() || null : null
  const manko = allowSensitive ? Number(body.mankoMoney ?? 0) : null
  const vl = allowSensitive ? Number(body.vlAmount ?? 0) : null
  const hidePay = allowSensitive ? (body.hideInPayroll ? 1 : 0) : 0

  const insertCols = `id, station_id, salutation, first_name, last_name, display_name, short_name,
      email, phone, mobile_phone, landline_phone, birthday, personnel_number,
      role, employment_role, employment_type,
      hourly_wage, monthly_salary, weekly_hours, monthly_hours, vacation_days_total, vacation_days_used,
      color, status, cash_register_card_number, terminal_enabled, time_tracking_enabled,
      pin_hash, time_tracking_mode, break_mode, mobile_punch_mode, check_in_mode, check_out_mode,
      employee_app_enabled, pay_type, max_hours_per_month, work_days_json,
      manko_money, vl_amount, hide_in_payroll,
      overtime_enabled, overtime_start_value, overtime_start_date, overtime_current_value,
      overtime_auto_calculate, overtime_include_in_reports,
      iban, bic, account_holder,
      vacation_start_enabled, vacation_start_value, vacation_start_date, annual_vacation_days,
      vacation_hours_per_day, vacation_auto_average_13_weeks,
      first_break_value, first_break_after_hours, second_break_value, second_break_after_hours,
      use_station_break_settings, own_break_rule_enabled,
      surcharge_mode, night_surcharge_percent, night_surcharge_start, night_surcharge_end, night_surcharge_after_two_hours,
      saturday_surcharge_percent, sunday_surcharge_percent, holiday_surcharge_percent, special_holiday_surcharge_percent,
      night_0_4_surcharge_percent, night_0_4_after_sunday_percent, night_0_4_after_holiday_percent, night_0_4_after_special_holiday_percent,
      surcharge_calculation_mode,
      hide_contact_in_address_book, show_only_first_name_in_employee_app, visible_in_team_schedule,
      phone_visible_to_team, email_visible_to_team,
      start_date, end_date, notes, active,
      employee_access_token, employee_access_enabled, employee_access_created_at,
      preferred_shift_types_json, preferred_work_days_json, not_preferred_work_days_json,
      can_work_weekends, can_work_holidays, max_preferred_days_per_week, max_weekly_hours, planning_notes,
      created_at, updated_at`
  const nCols = insertCols.split(',').length
  const ph = Array.from({ length: nCols }, () => '?').join(', ')
  db.prepare(`INSERT INTO employees (${insertCols}) VALUES (${ph})`).run(
    id,
    stationId,
    String(body.salutation ?? 'none'),
    first,
    last,
    displayName,
    String(body.shortName ?? '').trim() || null,
    String(body.email ?? '') || null,
    String(body.mobilePhone ?? body.phone ?? '') || null,
    String(body.mobilePhone ?? body.phone ?? '') || null,
    String(body.landlinePhone ?? '') || null,
    String(body.birthday ?? '') || null,
    String(body.personnelNumber ?? '').trim() || null,
    String(body.employmentRole ?? body.role ?? 'Verkäufer') || null,
    String(body.employmentRole ?? body.role ?? 'Verkäufer') || null,
    String(body.employmentType ?? 'teilzeit') || null,
    hourly,
    monthlySal,
    Number(body.weeklyHours ?? 40),
    Number(body.monthlyHours ?? 0),
    Number(body.vacationDaysTotal ?? 28),
    Number(body.vacationDaysUsed ?? 0),
    String(body.color ?? '#22d3ee'),
    'active',
    cardNo,
    body.terminalEnabled === false ? 0 : 1,
    body.timeTrackingEnabled === false ? 0 : 1,
    pinHash,
    String(body.timeTrackingMode ?? 'station_default'),
    String(body.breakMode ?? 'station_default'),
    String(body.mobilePunchMode ?? 'station_default'),
    String(body.checkInMode ?? 'station_default'),
    String(body.checkOutMode ?? 'station_default'),
    body.employeeAppEnabled === false ? 0 : 1,
    String(body.payType ?? 'hourly'),
    body.maxHoursPerMonth != null ? Number(body.maxHoursPerMonth) : null,
    Array.isArray(body.workDays) ? JSON.stringify(body.workDays) : '["mo","di","mi","do","fr"]',
    manko,
    vl,
    hidePay,
    body.overtimeEnabled ? 1 : 0,
    body.overtimeStartValue != null ? Number(body.overtimeStartValue) : null,
    String(body.overtimeStartDate ?? '') || null,
    body.overtimeCurrentValue != null ? Number(body.overtimeCurrentValue) : null,
    body.overtimeAutoCalculate ? 1 : 0,
    body.overtimeIncludeInReports === false ? 0 : 1,
    iban,
    bic,
    accHolder,
    body.vacationStartEnabled ? 1 : 0,
    body.vacationStartValue != null ? Number(body.vacationStartValue) : null,
    String(body.vacationStartDate ?? '') || null,
    body.annualVacationDays != null ? Number(body.annualVacationDays) : null,
    body.vacationHoursPerDay != null ? Number(body.vacationHoursPerDay) : null,
    body.vacationAutoAverage13Weeks ? 1 : 0,
    body.firstBreakValue != null ? Number(body.firstBreakValue) : null,
    body.firstBreakAfterHours != null ? Number(body.firstBreakAfterHours) : null,
    body.secondBreakValue != null ? Number(body.secondBreakValue) : null,
    body.secondBreakAfterHours != null ? Number(body.secondBreakAfterHours) : null,
    body.useStationBreakSettings === false ? 0 : 1,
    body.ownBreakRuleEnabled ? 1 : 0,
    String(body.surchargeMode ?? 'none'),
    body.nightSurchargePercent != null ? Number(body.nightSurchargePercent) : null,
    String(body.nightSurchargeStart ?? '') || null,
    String(body.nightSurchargeEnd ?? '') || null,
    body.nightSurchargeAfterTwoHours ? 1 : 0,
    body.saturdaySurchargePercent != null ? Number(body.saturdaySurchargePercent) : null,
    body.sundaySurchargePercent != null ? Number(body.sundaySurchargePercent) : null,
    body.holidaySurchargePercent != null ? Number(body.holidaySurchargePercent) : null,
    body.specialHolidaySurchargePercent != null ? Number(body.specialHolidaySurchargePercent) : null,
    body.night04SurchargePercent != null ? Number(body.night04SurchargePercent) : null,
    body.night04AfterSundayPercent != null ? Number(body.night04AfterSundayPercent) : null,
    body.night04AfterHolidayPercent != null ? Number(body.night04AfterHolidayPercent) : null,
    body.night04AfterSpecialHolidayPercent != null ? Number(body.night04AfterSpecialHolidayPercent) : null,
    String(body.surchargeCalculationMode ?? 'higher'),
    body.hideContactInAddressBook ? 1 : 0,
    body.showOnlyFirstNameInEmployeeApp ? 1 : 0,
    body.visibleInTeamSchedule === false ? 0 : 1,
    body.phoneVisibleToTeam === false ? 0 : 1,
    body.emailVisibleToTeam === false ? 0 : 1,
    String(body.startDate ?? ts.slice(0, 10)),
    body.endDate != null ? String(body.endDate) : null,
    String(body.notes ?? '') || null,
    1,
    accessTok,
    1,
    ts,
    jsonStringArrayFromBody(body, 'preferredShiftTypes'),
    jsonStringArrayFromBody(body, 'preferredWorkDays'),
    jsonStringArrayFromBody(body, 'notPreferredWorkDays'),
    body.canWorkWeekends === false ? 0 : 1,
    body.canWorkHolidays === false ? 0 : 1,
    body.maxPreferredDaysPerWeek != null ? Number(body.maxPreferredDaysPerWeek) : null,
    body.maxWeeklyHours != null ? Number(body.maxWeeklyHours) : null,
    String(body.planningNotes ?? '') || null,
    ts,
    ts,
  )

  syncWorkAreas(db, id, stationId, workAreaIds)

  return getEmployee(db, id, { includeAccessToken: true, includeSensitive: allowSensitive })
}

export function updateEmployee(
  db: Database,
  id: string,
  body: Record<string, unknown>,
  opts?: { allowSensitive?: boolean },
) {
  const existing = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id) as EmployeeRow | undefined
  if (!existing) throw new Error('Mitarbeiter nicht gefunden')
  const allowSensitive = Boolean(opts?.allowSensitive)
  const ts = nowIso()
  const sid = String(existing.station_id)
  const exR = existing as Record<string, unknown>
  if (rStr(exR, 'deleted_at').trim()) {
    throw new Error('Gelöschte Mitarbeitende können hier nicht bearbeitet werden. Bitte zuerst wiederherstellen.')
  }

  if (body.status === 'inaktiv' || body.status === 'inactive') {
    db.prepare(
      `UPDATE employees SET active = 0, status = 'inactive', employee_access_enabled = 0, updated_at = ? WHERE id = ?`,
    ).run(ts, id)
    revokeAllDevicesForEmployee(db, id, RB_EMPLOYEE_INACTIVE)
  } else if (body.status === 'aktiv' || body.status === 'active') {
    db.prepare(
      `UPDATE employees SET active = 1, status = 'active', employee_access_enabled = 1, updated_at = ? WHERE id = ?`,
    ).run(ts, id)
  } else if (body.status === 'gesperrt' || body.status === 'blocked') {
    db.prepare(`UPDATE employees SET status = 'blocked', updated_at = ? WHERE id = ?`).run(ts, id)
  }

  db.prepare(
    `UPDATE employees SET
      salutation = COALESCE(?, salutation),
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      display_name = COALESCE(?, display_name),
      short_name = ?,
      email = ?, mobile_phone = ?, landline_phone = ?, phone = ?, birthday = ?, personnel_number = ?,
      role = ?, employment_role = ?, employment_type = ?,
      hourly_wage = ?, monthly_salary = ?, weekly_hours = ?, monthly_hours = ?,
      vacation_days_total = ?, vacation_days_used = ?, color = ?,
      cash_register_card_number = ?, terminal_enabled = ?, time_tracking_enabled = ?,
      time_tracking_mode = ?, break_mode = ?, mobile_punch_mode = ?, check_in_mode = ?, check_out_mode = ?,
      employee_app_enabled = ?,
      pay_type = ?, max_hours_per_month = ?, work_days_json = ?,
      manko_money = ?, vl_amount = ?, hide_in_payroll = ?,
      overtime_enabled = ?, overtime_start_value = ?, overtime_start_date = ?, overtime_current_value = ?,
      overtime_auto_calculate = ?, overtime_include_in_reports = ?,
      iban = ?, bic = ?, account_holder = ?,
      vacation_start_enabled = ?, vacation_start_value = ?, vacation_start_date = ?, annual_vacation_days = ?,
      vacation_hours_per_day = ?, vacation_auto_average_13_weeks = ?,
      first_break_value = ?, first_break_after_hours = ?, second_break_value = ?, second_break_after_hours = ?,
      use_station_break_settings = ?, own_break_rule_enabled = ?,
      surcharge_mode = ?, night_surcharge_percent = ?, night_surcharge_start = ?, night_surcharge_end = ?, night_surcharge_after_two_hours = ?,
      saturday_surcharge_percent = ?, sunday_surcharge_percent = ?, holiday_surcharge_percent = ?, special_holiday_surcharge_percent = ?,
      night_0_4_surcharge_percent = ?, night_0_4_after_sunday_percent = ?, night_0_4_after_holiday_percent = ?, night_0_4_after_special_holiday_percent = ?,
      surcharge_calculation_mode = ?,
      hide_contact_in_address_book = ?, show_only_first_name_in_employee_app = ?, visible_in_team_schedule = ?,
      phone_visible_to_team = ?, email_visible_to_team = ?,
      start_date = ?, end_date = ?, notes = ?,
      updated_at = ?
    WHERE id = ?`,
  ).run(
    body.salutation != null ? String(body.salutation) : null,
    body.firstName != null ? String(body.firstName) : null,
    body.lastName != null ? String(body.lastName) : null,
    body.displayName != null ? String(body.displayName) : null,
    body.shortName !== undefined ? String(body.shortName ?? '').trim() || null : existing.short_name ?? null,
    body.email !== undefined ? String(body.email ?? '') || null : existing.email,
    body.mobilePhone !== undefined
      ? String(body.mobilePhone ?? '').trim() || null
      : (existing as Record<string, unknown>).mobile_phone != null
        ? String((existing as Record<string, unknown>).mobile_phone)
        : existing.phone,
    body.landlinePhone !== undefined ? String(body.landlinePhone ?? '').trim() || null : (existing as Record<string, unknown>).landline_phone != null ? String((existing as Record<string, unknown>).landline_phone) : null,
    body.mobilePhone !== undefined
      ? String(body.mobilePhone ?? '').trim() || null
      : existing.phone,
    body.birthday !== undefined ? String(body.birthday ?? '') || null : existing.birthday,
    body.personnelNumber !== undefined ? String(body.personnelNumber ?? '').trim() || null : (existing as Record<string, unknown>).personnel_number != null ? String((existing as Record<string, unknown>).personnel_number) : null,
    body.role !== undefined ? String(body.role ?? '') || null : existing.role,
    body.employmentRole !== undefined ? String(body.employmentRole ?? '') || null : (existing as Record<string, unknown>).employment_role != null ? String((existing as Record<string, unknown>).employment_role) : existing.role,
    body.employmentType !== undefined ? String(body.employmentType) : existing.employment_type,
    allowSensitive && body.hourlyWage !== undefined ? Number(body.hourlyWage) : existing.hourly_wage,
    allowSensitive && body.monthlySalary !== undefined
      ? body.monthlySalary == null
        ? null
        : Number(body.monthlySalary)
      : existing.monthly_salary,
    body.weeklyHours != null ? Number(body.weeklyHours) : existing.weekly_hours,
    body.monthlyHours != null ? Number(body.monthlyHours) : existing.monthly_hours,
    body.vacationDaysTotal != null ? Number(body.vacationDaysTotal) : existing.vacation_days_total,
    body.vacationDaysUsed != null ? Number(body.vacationDaysUsed) : existing.vacation_days_used,
    body.color != null ? String(body.color) : existing.color,
    allowSensitive && body.cashRegisterCardNumber !== undefined
      ? String(body.cashRegisterCardNumber ?? '').trim() || null
      : existing.cash_register_card_number,
    body.terminalEnabled === false ? 0 : body.terminalEnabled === true ? 1 : existing.terminal_enabled,
    body.timeTrackingEnabled === false ? 0 : body.timeTrackingEnabled === true ? 1 : existing.time_tracking_enabled,
    body.timeTrackingMode != null ? String(body.timeTrackingMode) : (existing as Record<string, unknown>).time_tracking_mode ?? 'station_default',
    body.breakMode != null ? String(body.breakMode) : (existing as Record<string, unknown>).break_mode ?? 'station_default',
    body.mobilePunchMode != null ? String(body.mobilePunchMode) : (existing as Record<string, unknown>).mobile_punch_mode ?? 'station_default',
    body.checkInMode != null ? String(body.checkInMode) : (existing as Record<string, unknown>).check_in_mode ?? 'station_default',
    body.checkOutMode != null ? String(body.checkOutMode) : (existing as Record<string, unknown>).check_out_mode ?? 'station_default',
    body.employeeAppEnabled === false ? 0 : body.employeeAppEnabled === true ? 1 : (existing as Record<string, unknown>).employee_app_enabled ?? 1,
    body.payType != null ? String(body.payType) : (existing as Record<string, unknown>).pay_type ?? 'hourly',
    body.maxHoursPerMonth !== undefined
      ? body.maxHoursPerMonth == null
        ? null
        : Number(body.maxHoursPerMonth)
      : (existing as Record<string, unknown>).max_hours_per_month ?? null,
    body.workDays !== undefined ? jsonStringArrayFromBody(body, 'workDays') : String((existing as Record<string, unknown>).work_days_json ?? '[]'),
    allowSensitive && body.mankoMoney !== undefined ? Number(body.mankoMoney) : (existing as Record<string, unknown>).manko_money ?? null,
    allowSensitive && body.vlAmount !== undefined ? Number(body.vlAmount) : (existing as Record<string, unknown>).vl_amount ?? null,
    allowSensitive && body.hideInPayroll !== undefined ? (body.hideInPayroll ? 1 : 0) : (existing as Record<string, unknown>).hide_in_payroll ?? 0,
    body.overtimeEnabled !== undefined ? (body.overtimeEnabled ? 1 : 0) : (existing as Record<string, unknown>).overtime_enabled ?? 0,
    body.overtimeStartValue !== undefined
      ? body.overtimeStartValue == null
        ? null
        : Number(body.overtimeStartValue)
      : (existing as Record<string, unknown>).overtime_start_value ?? null,
    body.overtimeStartDate !== undefined ? String(body.overtimeStartDate ?? '') || null : (existing as Record<string, unknown>).overtime_start_date ?? null,
    body.overtimeCurrentValue !== undefined
      ? body.overtimeCurrentValue == null
        ? null
        : Number(body.overtimeCurrentValue)
      : (existing as Record<string, unknown>).overtime_current_value ?? null,
    body.overtimeAutoCalculate !== undefined ? (body.overtimeAutoCalculate ? 1 : 0) : (existing as Record<string, unknown>).overtime_auto_calculate ?? 0,
    body.overtimeIncludeInReports !== undefined ? (body.overtimeIncludeInReports ? 1 : 0) : (existing as Record<string, unknown>).overtime_include_in_reports ?? 1,
    allowSensitive && body.iban !== undefined ? String(body.iban ?? '').trim() || null : (existing as Record<string, unknown>).iban ?? null,
    allowSensitive && body.bic !== undefined ? String(body.bic ?? '').trim() || null : (existing as Record<string, unknown>).bic ?? null,
    allowSensitive && body.accountHolder !== undefined ? String(body.accountHolder ?? '').trim() || null : (existing as Record<string, unknown>).account_holder ?? null,
    body.vacationStartEnabled !== undefined ? (body.vacationStartEnabled ? 1 : 0) : (existing as Record<string, unknown>).vacation_start_enabled ?? 0,
    body.vacationStartValue !== undefined
      ? body.vacationStartValue == null
        ? null
        : Number(body.vacationStartValue)
      : (existing as Record<string, unknown>).vacation_start_value ?? null,
    body.vacationStartDate !== undefined ? String(body.vacationStartDate ?? '') || null : (existing as Record<string, unknown>).vacation_start_date ?? null,
    body.annualVacationDays !== undefined
      ? body.annualVacationDays == null
        ? null
        : Number(body.annualVacationDays)
      : (existing as Record<string, unknown>).annual_vacation_days ?? null,
    body.vacationHoursPerDay !== undefined
      ? body.vacationHoursPerDay == null
        ? null
        : Number(body.vacationHoursPerDay)
      : (existing as Record<string, unknown>).vacation_hours_per_day ?? null,
    body.vacationAutoAverage13Weeks !== undefined ? (body.vacationAutoAverage13Weeks ? 1 : 0) : (existing as Record<string, unknown>).vacation_auto_average_13_weeks ?? 0,
    body.firstBreakValue !== undefined
      ? body.firstBreakValue == null
        ? null
        : Number(body.firstBreakValue)
      : (existing as Record<string, unknown>).first_break_value ?? null,
    body.firstBreakAfterHours !== undefined
      ? body.firstBreakAfterHours == null
        ? null
        : Number(body.firstBreakAfterHours)
      : (existing as Record<string, unknown>).first_break_after_hours ?? null,
    body.secondBreakValue !== undefined
      ? body.secondBreakValue == null
        ? null
        : Number(body.secondBreakValue)
      : (existing as Record<string, unknown>).second_break_value ?? null,
    body.secondBreakAfterHours !== undefined
      ? body.secondBreakAfterHours == null
        ? null
        : Number(body.secondBreakAfterHours)
      : (existing as Record<string, unknown>).second_break_after_hours ?? null,
    body.useStationBreakSettings !== undefined ? (body.useStationBreakSettings ? 1 : 0) : (existing as Record<string, unknown>).use_station_break_settings ?? 1,
    body.ownBreakRuleEnabled !== undefined ? (body.ownBreakRuleEnabled ? 1 : 0) : (existing as Record<string, unknown>).own_break_rule_enabled ?? 0,
    body.surchargeMode != null ? String(body.surchargeMode) : (existing as Record<string, unknown>).surcharge_mode ?? 'none',
    body.nightSurchargePercent !== undefined
      ? body.nightSurchargePercent == null
        ? null
        : Number(body.nightSurchargePercent)
      : (existing as Record<string, unknown>).night_surcharge_percent ?? null,
    body.nightSurchargeStart !== undefined ? String(body.nightSurchargeStart ?? '') || null : (existing as Record<string, unknown>).night_surcharge_start ?? null,
    body.nightSurchargeEnd !== undefined ? String(body.nightSurchargeEnd ?? '') || null : (existing as Record<string, unknown>).night_surcharge_end ?? null,
    body.nightSurchargeAfterTwoHours !== undefined ? (body.nightSurchargeAfterTwoHours ? 1 : 0) : (existing as Record<string, unknown>).night_surcharge_after_two_hours ?? 0,
    body.saturdaySurchargePercent !== undefined
      ? body.saturdaySurchargePercent == null
        ? null
        : Number(body.saturdaySurchargePercent)
      : (existing as Record<string, unknown>).saturday_surcharge_percent ?? null,
    body.sundaySurchargePercent !== undefined
      ? body.sundaySurchargePercent == null
        ? null
        : Number(body.sundaySurchargePercent)
      : (existing as Record<string, unknown>).sunday_surcharge_percent ?? null,
    body.holidaySurchargePercent !== undefined
      ? body.holidaySurchargePercent == null
        ? null
        : Number(body.holidaySurchargePercent)
      : (existing as Record<string, unknown>).holiday_surcharge_percent ?? null,
    body.specialHolidaySurchargePercent !== undefined
      ? body.specialHolidaySurchargePercent == null
        ? null
        : Number(body.specialHolidaySurchargePercent)
      : (existing as Record<string, unknown>).special_holiday_surcharge_percent ?? null,
    body.night04SurchargePercent !== undefined
      ? body.night04SurchargePercent == null
        ? null
        : Number(body.night04SurchargePercent)
      : (existing as Record<string, unknown>).night_0_4_surcharge_percent ?? null,
    body.night04AfterSundayPercent !== undefined
      ? body.night04AfterSundayPercent == null
        ? null
        : Number(body.night04AfterSundayPercent)
      : (existing as Record<string, unknown>).night_0_4_after_sunday_percent ?? null,
    body.night04AfterHolidayPercent !== undefined
      ? body.night04AfterHolidayPercent == null
        ? null
        : Number(body.night04AfterHolidayPercent)
      : (existing as Record<string, unknown>).night_0_4_after_holiday_percent ?? null,
    body.night04AfterSpecialHolidayPercent !== undefined
      ? body.night04AfterSpecialHolidayPercent == null
        ? null
        : Number(body.night04AfterSpecialHolidayPercent)
      : (existing as Record<string, unknown>).night_0_4_after_special_holiday_percent ?? null,
    body.surchargeCalculationMode != null ? String(body.surchargeCalculationMode) : (existing as Record<string, unknown>).surcharge_calculation_mode ?? 'higher',
    body.hideContactInAddressBook !== undefined ? (body.hideContactInAddressBook ? 1 : 0) : (existing as Record<string, unknown>).hide_contact_in_address_book ?? 0,
    body.showOnlyFirstNameInEmployeeApp !== undefined ? (body.showOnlyFirstNameInEmployeeApp ? 1 : 0) : (existing as Record<string, unknown>).show_only_first_name_in_employee_app ?? 0,
    body.visibleInTeamSchedule !== undefined ? (body.visibleInTeamSchedule ? 1 : 0) : (existing as Record<string, unknown>).visible_in_team_schedule ?? 1,
    body.phoneVisibleToTeam !== undefined ? (body.phoneVisibleToTeam ? 1 : 0) : (existing as Record<string, unknown>).phone_visible_to_team ?? 1,
    body.emailVisibleToTeam !== undefined ? (body.emailVisibleToTeam ? 1 : 0) : (existing as Record<string, unknown>).email_visible_to_team ?? 1,
    body.startDate != null ? String(body.startDate) : existing.start_date,
    body.endDate !== undefined ? (body.endDate == null ? null : String(body.endDate)) : existing.end_date,
    body.notes != null ? String(body.notes) : existing.notes,
    ts,
    id,
  )

  if (allowSensitive && body.pin !== undefined) {
    const p = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (p) db.prepare(`UPDATE employees SET pin_hash = ?, updated_at = ? WHERE id = ?`).run(hashEmployeePin(p), ts, id)
    else db.prepare(`UPDATE employees SET pin_hash = NULL, updated_at = ? WHERE id = ?`).run(ts, id)
  }

  if (
    body.preferredShiftTypes !== undefined ||
    body.preferredWorkDays !== undefined ||
    body.notPreferredWorkDays !== undefined ||
    body.canWorkWeekends !== undefined ||
    body.canWorkHolidays !== undefined ||
    body.maxPreferredDaysPerWeek !== undefined ||
    body.maxWeeklyHours !== undefined ||
    body.planningNotes !== undefined
  ) {
    const cur = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id) as EmployeeRow
    const prefShift =
      body.preferredShiftTypes !== undefined
        ? jsonStringArrayFromBody(body, 'preferredShiftTypes')
        : (cur.preferred_shift_types_json ?? '[]')
    const prefDays =
      body.preferredWorkDays !== undefined
        ? jsonStringArrayFromBody(body, 'preferredWorkDays')
        : (cur.preferred_work_days_json ?? '[]')
    const notPref =
      body.notPreferredWorkDays !== undefined
        ? jsonStringArrayFromBody(body, 'notPreferredWorkDays')
        : (cur.not_preferred_work_days_json ?? '[]')
    const cWk =
      body.canWorkWeekends !== undefined ? (body.canWorkWeekends ? 1 : 0) : (cur.can_work_weekends ?? 1)
    const cH =
      body.canWorkHolidays !== undefined ? (body.canWorkHolidays ? 1 : 0) : (cur.can_work_holidays ?? 1)
    const maxDays =
      body.maxPreferredDaysPerWeek !== undefined
        ? body.maxPreferredDaysPerWeek == null
          ? null
          : Number(body.maxPreferredDaysPerWeek)
        : cur.max_preferred_days_per_week
    const maxH =
      body.maxWeeklyHours !== undefined
        ? body.maxWeeklyHours == null
          ? null
          : Number(body.maxWeeklyHours)
        : cur.max_weekly_hours
    const pNotes =
      body.planningNotes !== undefined ? String(body.planningNotes ?? '') : (cur.planning_notes ?? '')
    db.prepare(
      `UPDATE employees SET
        preferred_shift_types_json = ?,
        preferred_work_days_json = ?,
        not_preferred_work_days_json = ?,
        can_work_weekends = ?,
        can_work_holidays = ?,
        max_preferred_days_per_week = ?,
        max_weekly_hours = ?,
        planning_notes = ?,
        updated_at = ?
      WHERE id = ?`,
    ).run(prefShift, prefDays, notPref, cWk, cH, maxDays, maxH, pNotes, ts, id)
  }

  if (Array.isArray(body.workAreaIds)) {
    syncWorkAreas(db, id, sid, body.workAreaIds as string[])
  }

  return getEmployee(db, id, { includeAccessToken: true, includeSensitive: allowSensitive })
}

export function softDeleteEmployee(db: Database, id: string) {
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE employees SET active = 0, status = 'inactive', employee_access_enabled = 0, updated_at = ? WHERE id = ?`,
    )
    .run(ts, id)
  if (r.changes === 0) throw new Error('Mitarbeiter nicht gefunden')
  revokeAllDevicesForEmployee(db, id, RB_EMPLOYEE_INACTIVE)
}

/** Aus aktiver Verwaltung entfernen (Soft Delete): Nachweise in Schichten/Zeiten bleiben erhalten. */
export function removeEmployeeFromManagement(
  db: Database,
  id: string,
  opts: { revokedBy: string; deletedBy: string },
) {
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE employees SET
        active = 0,
        status = 'deleted',
        deleted_at = ?,
        deleted_by = ?,
        employee_access_enabled = 0,
        terminal_enabled = 0,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(ts, opts.deletedBy, ts, id)
  if (r.changes === 0) throw new Error('Mitarbeiter nicht gefunden')
  revokeAllDevicesForEmployee(db, id, opts.revokedBy)
}

export function restoreEmployeeFromDeletion(db: Database, id: string) {
  const row = getEmployeeRowInternal(db, id)
  if (!row) throw new Error('Mitarbeiter nicht gefunden')
  const R = row as Record<string, unknown>
  const delAt = rStr(R, 'deleted_at').trim()
  const st = String(row.status ?? '').toLowerCase()
  if (!delAt && st !== 'deleted') throw new Error('Mitarbeiter ist nicht gelöscht')
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE employees SET
        active = 1,
        status = 'active',
        deleted_at = NULL,
        deleted_by = NULL,
        terminal_enabled = 1,
        employee_access_enabled = 0,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(ts, id)
  if (r.changes === 0) throw new Error('Mitarbeiter nicht gefunden')
  return getEmployee(db, id, { includeAccessToken: true, includeSensitive: false })
}

export function getEmployeeRowInternal(db: Database, id: string): EmployeeRow | undefined {
  return db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id) as EmployeeRow | undefined
}

export function regenerateEmployeeAccessToken(db: Database, id: string) {
  revokeAllDevicesForEmployee(db, id, RB_TOKEN_REGEN)
  const ts = nowIso()
  const tok = randomBytes(32).toString('hex')
  const r = db
    .prepare(
      `UPDATE employees SET employee_access_token = ?, employee_access_created_at = ?, employee_access_enabled = 1, updated_at = ? WHERE id = ?`,
    )
    .run(tok, ts, ts, id)
  if (r.changes === 0) throw new Error('Mitarbeiter nicht gefunden')
  return getEmployee(db, id, { includeAccessToken: true, includeSensitive: false })
}

export function setEmployeeAccessEnabled(db: Database, id: string, enabled: boolean) {
  const row = getEmployeeRowInternal(db, id)
  if (!row) throw new Error('Mitarbeiter nicht gefunden')
  const R = row as Record<string, unknown>
  const existingTok = rStr(R, 'employee_access_token').trim()
  if (enabled && !existingTok) {
    return regenerateEmployeeAccessToken(db, id)
  }
  const ts = nowIso()
  const r = db
    .prepare(`UPDATE employees SET employee_access_enabled = ?, updated_at = ? WHERE id = ?`)
    .run(enabled ? 1 : 0, ts, id)
  if (r.changes === 0) throw new Error('Mitarbeiter nicht gefunden')
  if (!enabled) {
    revokeAllDevicesForEmployee(db, id, RB_ACCESS_DISABLED)
  } else if (existingTok) {
    reactivateDevicesAfterAccessReEnabled(db, id)
  }
  return getEmployee(db, id, { includeAccessToken: true, includeSensitive: false })
}

export function employeeHistoryCounts(db: Database, employeeId: string) {
  const shifts = (db.prepare(`SELECT COUNT(*) as c FROM shifts WHERE employee_id = ?`).get(employeeId) as { c: number })
    .c
  const times = (db.prepare(`SELECT COUNT(*) as c FROM time_entries WHERE employee_id = ?`).get(employeeId) as {
    c: number
  }).c
  const abs = (db.prepare(`SELECT COUNT(*) as c FROM absences WHERE employee_id = ?`).get(employeeId) as {
    c: number
  }).c
  const logs = (db.prepare(`SELECT COUNT(*) as c FROM task_logs WHERE employee_id = ?`).get(employeeId) as {
    c: number
  }).c
  const chk = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM shift_close_checklists WHERE employee_id = ? OR time_entry_id IN (SELECT id FROM time_entries WHERE employee_id = ?)`,
      )
      .get(employeeId, employeeId) as { c: number }
  ).c
  const appDevices = (
    db.prepare(`SELECT COUNT(*) as c FROM employee_app_devices WHERE employee_id = ?`).get(employeeId) as {
      c: number
    }
  ).c
  let shiftWarnings = 0
  try {
    shiftWarnings = (
      db.prepare(`SELECT COUNT(*) as c FROM employee_shift_warnings WHERE employee_id = ?`).get(employeeId) as {
        c: number
      }
    ).c
  } catch {
    shiftWarnings = 0
  }
  let checklistReviews = 0
  try {
    checklistReviews = (
      db
        .prepare(`SELECT COUNT(*) as c FROM shift_checklist_review_items WHERE employee_id = ?`)
        .get(employeeId) as { c: number }
    ).c
  } catch {
    checklistReviews = 0
  }
  const total = shifts + times + abs + logs + chk + appDevices + shiftWarnings + checklistReviews
  return {
    shifts,
    times,
    abs,
    logs,
    chk,
    appDevices,
    shiftWarnings,
    checklistReviews,
    total,
    any: total > 0,
  }
}

/** Hard-Delete nur ohne Historie; sonst Soft-Delete (aus Verwaltung entfernen). */
export function deleteEmployeeHardOrFallback(
  db: Database,
  id: string,
  opts?: { deletedBy?: string; revokeBy?: string },
): {
  mode: 'hard_deleted' | 'soft_deleted'
  message: string
} {
  const hist = employeeHistoryCounts(db, id)
  const deletedBy = opts?.deletedBy?.trim() || 'system'
  const revokeBy = opts?.revokeBy?.trim() || RB_EMPLOYEE_REMOVED
  if (hist.any) {
    removeEmployeeFromManagement(db, id, { revokedBy: revokeBy, deletedBy })
    return {
      mode: 'soft_deleted',
      message: 'Mitarbeiter wurde gelöscht. Historische Daten bleiben erhalten.',
    }
  }
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM employee_app_devices WHERE employee_id = ?`).run(id)
    db.prepare(
      `DELETE FROM shift_checklist_review_items WHERE employee_id = ? OR time_entry_id IN (SELECT id FROM time_entries WHERE employee_id = ?)`,
    ).run(id, id)
    db.prepare(`DELETE FROM employee_shift_warnings WHERE employee_id = ?`).run(id)
    db.prepare(
      `DELETE FROM shift_close_checklists WHERE time_entry_id IN (SELECT id FROM time_entries WHERE employee_id = ?) OR employee_id = ?`,
    ).run(id, id)
    db.prepare(`DELETE FROM time_entries WHERE employee_id = ?`).run(id)
    db.prepare(`DELETE FROM absences WHERE employee_id = ?`).run(id)
    db.prepare(`DELETE FROM task_logs WHERE employee_id = ?`).run(id)
    db.prepare(`UPDATE shifts SET employee_id = NULL WHERE employee_id = ?`).run(id)
    db.prepare(`UPDATE tasks SET assigned_employee_id = NULL WHERE assigned_employee_id = ?`).run(id)
    db.prepare(`DELETE FROM employee_work_areas WHERE employee_id = ?`).run(id)
    db.prepare(`DELETE FROM employee_access_logs WHERE employee_id = ?`).run(id)
    db.prepare(`UPDATE card_entry_events SET employee_id = NULL WHERE employee_id = ?`).run(id)
    const r = db.prepare(`DELETE FROM employees WHERE id = ?`).run(id)
    if (r.changes === 0) throw new Error('Mitarbeiter nicht gefunden')
  })
  tx()
  return { mode: 'hard_deleted', message: 'Mitarbeiter wurde gelöscht.' }
}
