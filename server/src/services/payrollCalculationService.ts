/**
 * Zentrale Lohnberechnung (Geldblöcke, Urlaub, Mindestlohn-Hinweise, Anpassungen).
 * Datenquellen (shifts / time_entries / Kombi) bleiben in `payrollReportService`,
 * die **gleiche** Berechnung für Grundlohn, Urlaub, Manko/VL/Summe läuft hier.
 */

import type { Database } from 'better-sqlite3'
import type { GermanState } from '../data/germanHolidays2026.js'
import { GERMAN_HOLIDAYS_2026, holidayAppliesToState } from '../data/germanHolidays2026.js'
import type { EmployeeSurchargeFields } from './payrollSurchargeService.js'
import type { AbsenceRow } from './absenceService.js'
import type { EmployeeRow } from './employeeService.js'
import type { TimeEntryRow } from './timeTrackingService.js'
import {
  countAbsenceSpanDaysCalendar,
  defaultPaidHoursPerDayFromEmployee,
  normalizeAbsenceDbType,
} from '../utils/vacationImpactCalculator.js'
import { isStableEmploymentForHolidayExclusion } from '../utils/vacationRequestCalculator.js'
import {
  employmentTypeSubjectToStatutoryMinimum,
  getEffectiveHourlyRate,
  getMinimumWageForDate,
} from './statutoryMinWageService.js'
import { eachYmdInRangeInclusive, utcRangeBoundsMs } from '../utils/berlinCalendarWorkHours.js'
import { todayIso } from '../utils/timestamps.js'
import { listShifts } from './shiftService.js'

function isPublicHolidayYmd(ymd: string, state: GermanState): boolean {
  return GERMAN_HOLIDAYS_2026.some((h) => h.date === ymd && holidayAppliesToState(h, state))
}

export type PayrollEmploymentFilter =
  | 'all'
  | 'all_with_exited'
  | 'vollzeit'
  | 'teilzeit'
  | 'aushilfe'
  | 'schichtleiter'
  | 'chef'
  | 'exited'

export type PayrollAdjBuckets = {
  cash: number
  bonus: number
  advance: number
  mankogeldExtra: number
  vlExtra: number
}

export function emptyBuckets(): PayrollAdjBuckets {
  return { cash: 0, bonus: 0, advance: 0, mankogeldExtra: 0, vlExtra: 0 }
}

export function accumulatePayrollAdjustments(rows: { employee_id: string; type: string; amount: number }[]) {
  const map = new Map<string, PayrollAdjBuckets>()
  for (const a of rows) {
    const cur = map.get(a.employee_id) ?? emptyBuckets()
    const amt = Number(a.amount)
    if (!Number.isFinite(amt)) continue
    const t = String(a.type ?? '').toLowerCase().trim()
    if (t === 'cash_difference') cur.cash += amt
    else if (t === 'bonus') cur.bonus += amt
    else if (t === 'advance') cur.advance += amt
    else if (t === 'mankogeld') cur.mankogeldExtra += amt
    else if (t === 'vl') cur.vlExtra += amt
    map.set(a.employee_id, cur)
  }
  return map
}

export function mergeChecklistCashIntoBuckets(
  db: Database,
  stationId: string,
  fromDate: string,
  toDate: string,
  map: Map<string, PayrollAdjBuckets>,
) {
  const checklistCashRows = db
    .prepare(
      `SELECT te.employee_id as employee_id, SUM(COALESCE(scc.cash_difference, 0)) as amt
       FROM shift_close_checklists scc
       INNER JOIN time_entries te ON te.id = scc.time_entry_id AND te.station_id = ?
       WHERE te.status = 'completed'
         AND te.approval_status = 'approved'
         AND te.end_at IS NOT NULL AND trim(te.end_at) != ''
         AND date(te.end_at) >= date(?)
         AND date(te.end_at) <= date(?)
       GROUP BY te.employee_id`,
    )
    .all(stationId, fromDate, toDate) as { employee_id: string; amt: number }[]
  for (const row of checklistCashRows) {
    const add = Number(row.amt)
    if (!Number.isFinite(add) || add === 0) continue
    const cur = map.get(row.employee_id) ?? emptyBuckets()
    cur.cash += add
    map.set(row.employee_id, cur)
  }
}

export function isMonthlyWageRecipient(R: Record<string, unknown>): boolean {
  const raw = String(R.pay_type ?? R.wage_type ?? 'hourly')
    .toLowerCase()
    .trim()
  return (
    raw === 'monthly' ||
    raw === 'salary' ||
    raw === 'gehalt' ||
    raw === 'festgehalt' ||
    raw === 'salaried'
  )
}

export function pad2(n: number): string {
  return String(Math.trunc(n)).padStart(2, '0')
}

/** ISO für Überlappung mit UTC-Zeitraum (Schichtplan-Datum + Uhrzeit, naive T-Komponente wie bisher). */
export function shiftToIsoEndpoints(
  dateStr: string,
  startTime: string,
  endTime: string,
): { startIso: string; endIso: string } {
  const [sh, sm] = startTime.split(':').map((x) => Number(x))
  const [eh, em] = endTime.split(':').map((x) => Number(x))
  const sMin = (sh ?? 0) * 60 + (sm ?? 0)
  const eMinRaw = (eh ?? 0) * 60 + (em ?? 0)
  let endDay = dateStr
  if (eMinRaw <= sMin) {
    const d = new Date(`${dateStr}T12:00:00`)
    d.setDate(d.getDate() + 1)
    endDay = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  }
  return {
    startIso: `${dateStr}T${pad2(sh ?? 0)}:${pad2(sm ?? 0)}:00`,
    endIso: `${endDay}T${pad2(eh ?? 0)}:${pad2(em ?? 0)}:00`,
  }
}

export function shiftNetHoursFromPlan(dateStr: string, startTime: string, endTime: string, breakMin: number): number {
  const [sh, sm] = startTime.split(':').map((x) => Number(x))
  const [eh, em] = endTime.split(':').map((x) => Number(x))
  const sMin = (sh ?? 0) * 60 + (sm ?? 0)
  let eMin = (eh ?? 0) * 60 + (em ?? 0)
  if (eMin <= sMin) eMin += 24 * 60
  const grossH = (eMin - sMin) / 60
  const brH = Math.max(0, Number(breakMin) || 0) / 60
  return Math.max(0, Math.round((grossH - brH) * 100) / 100)
}

export function rNum(row: Record<string, unknown>, k: string, fb = 0): number {
  const v = row[k]
  if (v == null || v === '') return fb
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

export function hideInPayroll(row: Record<string, unknown>): boolean {
  return rNum(row, 'hide_in_payroll', 0) === 1
}

export function isExitedEmployee(row: EmployeeRow & Record<string, unknown>, todayYmd: string): boolean {
  if (String(row.deleted_at ?? '').trim()) return true
  if ((row.active ?? 1) === 0) return true
  const st = String(row.status ?? '').toLowerCase()
  if (st === 'deleted' || st === 'geloescht') return true
  const ed = String(row.end_date ?? '').trim()
  if (ed && ed < todayYmd) return true
  return false
}

export function matchesEmploymentFilter(
  row: EmployeeRow & Record<string, unknown>,
  f: PayrollEmploymentFilter,
  todayYmd: string,
): boolean {
  const role = `${row.role ?? ''} ${row.employment_role ?? ''}`.toLowerCase()
  const et = String(row.employment_type ?? '').toLowerCase().trim()
  const exited = isExitedEmployee(row, todayYmd)
  const softDeleted = Boolean(String(row.deleted_at ?? '').trim()) || String(row.status ?? '').toLowerCase() === 'deleted'

  switch (f) {
    case 'all':
      return !exited
    case 'all_with_exited':
      return !softDeleted
    case 'exited':
      return exited
    case 'vollzeit':
      return !exited && et === 'vollzeit'
    case 'teilzeit':
      return !exited && et === 'teilzeit'
    case 'aushilfe':
      return !exited && et === 'aushilfe'
    case 'schichtleiter':
      return !exited && role.includes('schichtleiter')
    case 'chef':
      return !exited && (role.includes('administrator') || role.includes('chef'))
    default:
      return !exited
  }
}

/** Netto-Stunden im Zeitraum; Pause anteilig nach Überlappung. */
export function entryNetHoursInRange(
  startIso: string,
  endIso: string,
  breakMin: number,
  rangeFrom: string,
  rangeTo: string,
): number {
  const { start: rs, end: re } = utcRangeBoundsMs(rangeFrom, rangeTo)
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0
  const lo = Math.max(s, rs)
  const hi = Math.min(e, re)
  if (hi <= lo) return 0
  const overlapMs = hi - lo
  const totalMs = e - s
  const ratio = totalMs > 0 ? overlapMs / totalMs : 0
  const grossH = overlapMs / 3_600_000
  const brH = (Math.max(0, Number(breakMin) || 0) / 60) * ratio
  return Math.max(0, Math.round((grossH - brH) * 100) / 100)
}

/** Anteil 0 / 0.5 / 1 bezogen auf bezahlten Urlaubstag (Kalenderdatum). */
export function vacationDayWeight(ab: AbsenceRow, ymd: string): number {
  if (ymd < ab.start_date || ymd > ab.end_date) return 0
  const half = (ab.half_day ?? 0) === 1
  if (ab.start_date === ab.end_date) {
    return ymd === ab.start_date ? (half ? 0.5 : 1) : 0
  }
  if (half && ymd === ab.start_date) return 0.5
  return 1
}

/** Genehmigte Abwesenheit, die in der Lohnberechnung berücksichtigt werden darf. */
export function absenceApprovedForPayroll(a: AbsenceRow): boolean {
  const st = String(a.status ?? '')
    .toLowerCase()
    .trim()
  return st === 'approved'
}

/** Pro Kalendertag: bei gleichem Tag Arbeitszeit + bezahlter Urlaub nicht doppelt zählen (max). */
export function effectivePayrollDayHours(wh: number, vh: number): number {
  const w = Math.max(0, wh)
  const v = Math.max(0, vh)
  if (w > 0 && v > 0) return Math.round(Math.max(w, v) * 100) / 100
  return Math.round((w + v) * 100) / 100
}

export function sumEffectivePayrollHoursByYmd(workByYmd: Map<string, number>, vacByYmd: Map<string, number>): number {
  const keys = new Set([...workByYmd.keys(), ...vacByYmd.keys()])
  let sum = 0
  for (const ymd of keys) {
    sum += effectivePayrollDayHours(workByYmd.get(ymd) ?? 0, vacByYmd.get(ymd) ?? 0)
  }
  return Math.round(sum * 100) / 100
}

export function paidHoursPerDayForAbsence(a: AbsenceRow, empVacHoursPerDay: number | null): number {
  const fromRow = Number(a.paid_hours_per_day ?? 0)
  if (Number.isFinite(fromRow) && fromRow > 0) return fromRow
  return defaultPaidHoursPerDayFromEmployee(empVacHoursPerDay)
}

/**
 * Bezahlte Urlaubstage im Schnitt mit Abwesenheit (geclippt auf Zeitraum).
 * Bei Vollzeit/Teilzeit/Schichtleitung/etc.: **gesetzliche Feiertage zählen nicht** als Urlaubstag (BW laut `federalState`).
 * Aushilfe/Minijob: Kalendertage wie bisher (kein automatischer Feiertagsabzug vom Urlaubskonto).
 */
export function overlapPaidVacationDaysForPayroll(
  a: AbsenceRow,
  from: string,
  to: string,
  federalState: GermanState,
  employmentType: string,
  employmentRole: string,
): number {
  const t = normalizeAbsenceDbType(a.type)
  if (t !== 'paid_vacation') return 0
  if (!absenceApprovedForPayroll(a)) return 0

  const s = a.start_date > from ? a.start_date : from
  const e = a.end_date < to ? a.end_date : to
  if (e < s) return 0

  const half = (a.half_day ?? 0) === 1
  if (a.start_date === a.end_date && half) {
    if (s <= a.start_date && e >= a.start_date) {
      if (
        isStableEmploymentForHolidayExclusion(employmentType, employmentRole) &&
        isPublicHolidayYmd(a.start_date, federalState)
      ) {
        return 0
      }
      return 0.5
    }
    return 0
  }

  const excludeHol = isStableEmploymentForHolidayExclusion(employmentType, employmentRole)
  let sum = 0
  for (const ymd of eachYmdInRangeInclusive(s, e)) {
    const w = vacationDayWeight(a, ymd)
    if (w <= 0) continue
    if (excludeHol && isPublicHolidayYmd(ymd, federalState)) continue
    sum += w
  }
  return Math.round(sum * 100) / 100
}

export function mergePaidVacationHoursByBerlinYmd(
  absences: AbsenceRow[],
  employeeId: string,
  rangeFrom: string,
  rangeTo: string,
  vacHpdDefault: number | null,
  federalState: GermanState,
  employmentType: string,
  employmentRole: string,
): Map<string, number> {
  const map = new Map<string, number>()
  const excludeHol = isStableEmploymentForHolidayExclusion(employmentType, employmentRole)
  for (const ab of absences) {
    if (ab.employee_id !== employeeId) continue
    if (normalizeAbsenceDbType(ab.type) !== 'paid_vacation') continue
    if (!absenceApprovedForPayroll(ab)) continue
    const s = ab.start_date > rangeFrom ? ab.start_date : rangeFrom
    const e = ab.end_date < rangeTo ? ab.end_date : rangeTo
    if (e < s) continue
    for (const ymd of eachYmdInRangeInclusive(s, e)) {
      if (excludeHol && isPublicHolidayYmd(ymd, federalState)) continue
      const w = vacationDayWeight(ab, ymd)
      if (w <= 0) continue
      const hpd = paidHoursPerDayForAbsence(ab, vacHpdDefault)
      map.set(ymd, (map.get(ymd) ?? 0) + w * hpd)
    }
  }
  return map
}

/** Krank / Kind krank / Sonderurlaub mit bezahlten Stunden (z. B. 8 h/Tag), für Lohn aggregiert. */
export function mergeOtherPaidAbsenceHoursByBerlinYmd(
  absences: AbsenceRow[],
  employeeId: string,
  rangeFrom: string,
  rangeTo: string,
  vacHpdDefault: number | null,
  federalState: GermanState,
  employmentType: string,
  employmentRole: string,
): Map<string, number> {
  const map = new Map<string, number>()
  const excludeHol = isStableEmploymentForHolidayExclusion(employmentType, employmentRole)
  for (const ab of absences) {
    if (ab.employee_id !== employeeId) continue
    if (!absenceApprovedForPayroll(ab)) continue
    if ((ab.paid ?? 0) !== 1) continue
    const t = normalizeAbsenceDbType(ab.type)
    if (t !== 'sick' && t !== 'child_sick' && t !== 'special_leave') continue
    const hpd = paidHoursPerDayForAbsence(ab, vacHpdDefault)
    if (!(hpd > 0)) continue
    const s = ab.start_date > rangeFrom ? ab.start_date : rangeFrom
    const e = ab.end_date < rangeTo ? ab.end_date : rangeTo
    if (e < s) continue
    for (const ymd of eachYmdInRangeInclusive(s, e)) {
      if (excludeHol && isPublicHolidayYmd(ymd, federalState)) continue
      const w = vacationDayWeight(ab, ymd)
      if (w <= 0) continue
      map.set(ymd, (map.get(ymd) ?? 0) + w * hpd)
    }
  }
  return map
}

export function mergePaidAbsenceHoursMapsForPayroll(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const out = new Map(a)
  for (const [k, v] of b) {
    out.set(k, (out.get(k) ?? 0) + v)
  }
  return out
}

export function maxMinimumWageInRange(db: Database, fromYmd: string, toYmd: string): number {
  let m = 0
  for (const d of eachYmdInRangeInclusive(fromYmd, toYmd)) {
    const v = getMinimumWageForDate(db, d)
    if (v > m) m = v
  }
  return m
}

export function festangestelltMinWageWarning(
  db: Database,
  employmentType: string,
  rawHourly: number,
  monthlyRecipient: boolean,
  fromYmd: string,
  toYmd: string,
): string | undefined {
  if (monthlyRecipient) return undefined
  if (employmentTypeSubjectToStatutoryMinimum(employmentType)) return undefined
  if (!Number.isFinite(rawHourly) || rawHourly <= 0) return undefined
  const mx = maxMinimumWageInRange(db, fromYmd, toYmd)
  if (rawHourly + 0.003 < mx) {
    return 'Hinweis: Der eingetragene Stundenlohn liegt unter dem gesetzlichen Mindestlohn. Bitte prüfen.'
  }
  return undefined
}

function optPositivePct(row: Record<string, unknown>, k: string): number | null {
  const v = row[k]
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function surchargeFieldsFromEmployee(row: Record<string, unknown>): EmployeeSurchargeFields {
  return {
    surcharge_mode: (row.surcharge_mode as string) ?? null,
    night_surcharge_percent: optPositivePct(row, 'night_surcharge_percent'),
    night_surcharge_start: (row.night_surcharge_start as string) ?? null,
    night_surcharge_end: (row.night_surcharge_end as string) ?? null,
    saturday_surcharge_percent: optPositivePct(row, 'saturday_surcharge_percent'),
    sunday_surcharge_percent: optPositivePct(row, 'sunday_surcharge_percent'),
    holiday_surcharge_percent: optPositivePct(row, 'holiday_surcharge_percent'),
    special_holiday_surcharge_percent: optPositivePct(row, 'special_holiday_surcharge_percent'),
    night_0_4_surcharge_percent: optPositivePct(row, 'night_0_4_surcharge_percent'),
    night_0_4_after_sunday_percent: optPositivePct(row, 'night_0_4_after_sunday_percent'),
    night_0_4_after_holiday_percent: optPositivePct(row, 'night_0_4_after_holiday_percent'),
    night_0_4_after_special_holiday_percent: optPositivePct(row, 'night_0_4_after_special_holiday_percent'),
    surcharge_calculation_mode: (row.surcharge_calculation_mode as string) ?? null,
  }
}

export function prorateFixedMonthlyAmountOverRange(monthlyAmount: number, fromYmd: string, toYmd: string): number {
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return 0
  const [fy, fm, fd] = fromYmd.split('-').map(Number)
  const [ty, tm, td] = toYmd.split('-').map(Number)
  let cur = new Date(Date.UTC(fy!, fm! - 1, fd!))
  const end = new Date(Date.UTC(ty!, tm! - 1, td!))
  let sum = 0
  while (cur <= end) {
    const y = cur.getUTCFullYear()
    const dim = new Date(Date.UTC(y, cur.getUTCMonth() + 1, 0)).getUTCDate()
    sum += monthlyAmount / dim
    cur = new Date(Date.UTC(y, cur.getUTCMonth(), cur.getUTCDate() + 1))
  }
  return Math.round(sum * 100) / 100
}

export function parseEmploymentFilter(raw: string | undefined): PayrollEmploymentFilter {
  const s = String(raw ?? 'all').toLowerCase().trim()
  const allowed: PayrollEmploymentFilter[] = [
    'all',
    'all_with_exited',
    'vollzeit',
    'teilzeit',
    'aushilfe',
    'schichtleiter',
    'chef',
    'exited',
  ]
  return (allowed.includes(s as PayrollEmploymentFilter) ? s : 'all') as PayrollEmploymentFilter
}

export type PayrollMoneyBlockInput = {
  db: Database
  R: Record<string, unknown>
  employeeId: string
  fromDate: string
  toDate: string
  federalState: GermanState
  absences: AbsenceRow[]
  adjByEmployee: Map<string, PayrollAdjBuckets>
  /** Netto-Arbeitsstunden pro Europe/Berlin-Kalendertag (Quelle: Plan, Zeiterfassung oder Kombi). */
  workHoursByBerlinYmd: Map<string, number>
  supplementsTotal: number
  /** Summe Arbeitsstunden (Anzeige), ohne Urlaubsstunden */
  totalWorkHoursForDisplay: number
}

export type PayrollMoneyBlockResult = {
  basePay: number
  vacationDays: number
  paidVacationHours: number
  /** Summe der tagesbezogenen Effektivstunden (Arbeit + Urlaub, ohne Doppelzählung am selben Tag). */
  payrollHoursTotal: number
  overtimeHours: number
  hourlyWageDisplay: number
  minimumWageNote?: string
  messages: string[]
  mankogeld: number
  vl: number
  cashDifference: number
  bonus: number
  advance: number
  total: number
}

/**
 * Grundlohn (Monatslohn / tagesgenauer Mindestlohn / einfacher Stundenlohn), Urlaub, Profil-Manko/VL,
 * Anpassungen und **Summe** = Grundlohn + Zuschläge + Manko + VL + Kassendifferenz + Prämie − Vorschuss.
 */
export function computePayrollMoneyBlock(inp: PayrollMoneyBlockInput): PayrollMoneyBlockResult {
  const {
    db,
    R,
    employeeId,
    fromDate,
    toDate,
    federalState,
    absences,
    adjByEmployee,
    workHoursByBerlinYmd,
    supplementsTotal,
    totalWorkHoursForDisplay,
  } = inp

  const rawHourly = rNum(R, 'hourly_wage', 0)
  const monthlySalary = rNum(R, 'monthly_salary', 0)
  const monthlyRecipient = isMonthlyWageRecipient(R)
  const employmentType = String(R.employment_type ?? '')
  const employmentRole = String(R.employment_role ?? '')
  const subject = employmentTypeSubjectToStatutoryMinimum(employmentType)
  const vacHpdDefault = rNum(R, 'vacation_hours_per_day', NaN) || null

  let vacationDays = 0
  let paidVacationHours = 0
  for (const ab of absences) {
    if (ab.employee_id !== employeeId) continue
    const od = overlapPaidVacationDaysForPayroll(ab, fromDate, toDate, federalState, employmentType, employmentRole)
    if (od <= 0) continue
    vacationDays += od
    const hpd = paidHoursPerDayForAbsence(ab, vacHpdDefault)
    paidVacationHours += od * hpd
  }
  vacationDays = Math.round(vacationDays * 100) / 100
  paidVacationHours = Math.round(paidVacationHours * 100) / 100

  const vacByYmd = mergePaidVacationHoursByBerlinYmd(
    absences,
    employeeId,
    fromDate,
    toDate,
    vacHpdDefault,
    federalState,
    employmentType,
    employmentRole,
  )
  const otherPaidByYmd = mergeOtherPaidAbsenceHoursByBerlinYmd(
    absences,
    employeeId,
    fromDate,
    toDate,
    vacHpdDefault,
    federalState,
    employmentType,
    employmentRole,
  )
  let otherPaidAbsenceHoursSum = 0
  for (const v of otherPaidByYmd.values()) {
    otherPaidAbsenceHoursSum += v
  }
  otherPaidAbsenceHoursSum = Math.round(otherPaidAbsenceHoursSum * 100) / 100
  paidVacationHours = Math.round((paidVacationHours + otherPaidAbsenceHoursSum) * 100) / 100

  const allPaidAbsenceByYmd = mergePaidAbsenceHoursMapsForPayroll(vacByYmd, otherPaidByYmd)
  const payrollHoursTotal = monthlyRecipient
    ? Math.round((totalWorkHoursForDisplay + paidVacationHours) * 100) / 100
    : sumEffectivePayrollHoursByYmd(workHoursByBerlinYmd, allPaidAbsenceByYmd)

  const overtimeHours = 0
  const messages: string[] = []
  let basePay = 0

  if (monthlyRecipient) {
    if (monthlySalary > 0) {
      basePay = prorateFixedMonthlyAmountOverRange(monthlySalary, fromDate, toDate)
    } else {
      messages.push('Monatsgehalt fehlt im Mitarbeiterprofil.')
    }
  } else if (subject) {
    const ymdKeys = new Set([...workHoursByBerlinYmd.keys(), ...allPaidAbsenceByYmd.keys()])
    for (const ymd of ymdKeys) {
      const wh = workHoursByBerlinYmd.get(ymd) ?? 0
      const vh = allPaidAbsenceByYmd.get(ymd) ?? 0
      const eh = effectivePayrollDayHours(wh, vh)
      const rate = getEffectiveHourlyRate(db, employmentType, rawHourly, ymd)
      basePay += eh * rate
    }
    basePay = Math.round(basePay * 100) / 100
  } else {
    const fw = festangestelltMinWageWarning(db, employmentType, rawHourly, monthlyRecipient, fromDate, toDate)
    if (fw) messages.push(fw)
    if (rawHourly > 0) {
      basePay = Math.round(payrollHoursTotal * rawHourly * 100) / 100
    } else if (payrollHoursTotal > 0) {
      messages.push('Stundenlohn fehlt im Mitarbeiterprofil.')
    }
  }

  const denom = Math.round(payrollHoursTotal * 100) / 100
  let hourlyWageDisplay = 0
  if (!monthlyRecipient) {
    if (denom > 0 && basePay > 0) hourlyWageDisplay = basePay / denom
    else if (subject) hourlyWageDisplay = getEffectiveHourlyRate(db, employmentType, rawHourly, fromDate)
    else hourlyWageDisplay = rawHourly
  }

  let minimumWageNote: string | undefined
  if (!monthlyRecipient && subject && rawHourly > 0) {
    const mx = maxMinimumWageInRange(db, fromDate, toDate)
    if (rawHourly + 0.003 < mx) {
      minimumWageNote =
        'Für die Lohnabrechnung wird der gültige gesetzliche Mindestlohn je Kalendertag angewendet (eingetragener Stundenlohn bleibt im Profil).'
      messages.push(
        'Hinweis: Der eingetragene Stundenlohn liegt unter dem gesetzlichen Mindestlohn. Für die Lohnabrechnung wird automatisch der gültige Mindestlohn verwendet.',
      )
    }
  }

  const mankoProfile = prorateFixedMonthlyAmountOverRange(rNum(R, 'manko_money', 0), fromDate, toDate)
  const vlProfile = prorateFixedMonthlyAmountOverRange(rNum(R, 'vl_amount', 0), fromDate, toDate)
  const adj = adjByEmployee.get(employeeId) ?? emptyBuckets()
  const mankogeld = Math.round((mankoProfile + adj.mankogeldExtra) * 100) / 100
  const vl = Math.round((vlProfile + adj.vlExtra) * 100) / 100
  const cashDifference = Math.round(adj.cash * 100) / 100
  const bonus = Math.round(adj.bonus * 100) / 100
  const advance = Math.round(adj.advance * 100) / 100

  const total =
    Math.round((basePay + supplementsTotal + mankogeld + vl + cashDifference + bonus - advance) * 100) / 100

  if (process.env.PAYROLL_DEBUG === '1') {
    console.info('[PAYROLL_DEBUG]', {
      employeeId,
      fromDate,
      toDate,
      totalWorkHoursForDisplay,
      paidVacationHours,
      payrollHoursTotal,
      vacationDays,
      basePay,
      supplementsTotal,
      total,
    })
  }

  return {
    basePay,
    vacationDays,
    paidVacationHours,
    payrollHoursTotal,
    overtimeHours,
    hourlyWageDisplay: Math.round(hourlyWageDisplay * 100) / 100,
    ...(minimumWageNote ? { minimumWageNote } : {}),
    messages,
    mankogeld,
    vl,
    cashDifference,
    bonus,
    advance,
    total,
  }
}

export type PayrollValidationIssue = {
  severity: 'warning' | 'error'
  code: string
  employeeId: string
  employeeName: string
  message: string
  detail?: string
}

/** Interner Prüfreport vor Monatsabschluss (keine Datenänderung). */
export function buildPayrollValidationReport(
  db: Database,
  opts: { stationId: string; fromDate: string; toDate: string; employmentFilter?: string },
): { stationId: string; fromDate: string; toDate: string; issues: PayrollValidationIssue[] } {
  const stationId = opts.stationId.trim()
  const fromDate = opts.fromDate.trim()
  const toDate = opts.toDate.trim()
  const employmentFilter = parseEmploymentFilter(opts.employmentFilter)
  const issues: PayrollValidationIssue[] = []

  const station = db.prepare(`SELECT name, federal_state FROM stations WHERE id = ?`).get(stationId) as
    | { name: string; federal_state: string | null }
    | undefined
  if (!station) {
    issues.push({
      severity: 'error',
      code: 'station_missing',
      employeeId: '',
      employeeName: '',
      message: 'Station nicht gefunden',
    })
    return { stationId, fromDate, toDate, issues }
  }

  const federalState = String(station.federal_state ?? 'BW').toUpperCase() as GermanState
  const todayYmd = todayIso()

  const employees = db
    .prepare(`SELECT * FROM employees WHERE station_id = ? ORDER BY display_name`)
    .all(stationId) as (EmployeeRow & Record<string, unknown>)[]

  const filtered = employees.filter((e) => !hideInPayroll(e) && matchesEmploymentFilter(e, employmentFilter, todayYmd))

  const openRunning = db
    .prepare(
      `SELECT te.*, e.display_name AS en FROM time_entries te
       LEFT JOIN employees e ON e.id = te.employee_id
       WHERE te.station_id = ?
         AND te.status = 'completed'
         AND (te.end_at IS NULL OR trim(te.end_at) = '')
         AND date(te.start_at) <= date(?)`,
    )
    .all(stationId, toDate) as (TimeEntryRow & { en?: string | null })[]

  for (const te of openRunning) {
    issues.push({
      severity: 'error',
      code: 'open_time_entry',
      employeeId: te.employee_id,
      employeeName: String(te.en ?? '').trim() || te.employee_id,
      message: 'Offene Zeiterfassung ohne Ende',
      detail: `Start ${te.start_at}`,
    })
  }

  const shiftList = listShifts(db, { stationId, from: fromDate, to: toDate })
  for (const s of shiftList) {
    if (!s.employeeId && String(s.shiftType ?? '').toLowerCase().trim() !== 'frei') {
      issues.push({
        severity: 'warning',
        code: 'shift_no_employee',
        employeeId: '',
        employeeName: '',
        message: 'Schicht ohne Mitarbeiter',
        detail: `${s.date} ${s.startTime}–${s.endTime}`,
      })
    }
  }

  const approvedH = db
    .prepare(
      `SELECT te.employee_id as eid, SUM(
         (julianday(te.end_at) - julianday(te.start_at)) * 24.0
         - COALESCE(te.break_minutes,0)/60.0
       ) as h
       FROM time_entries te
       WHERE te.station_id = ? AND te.status = 'completed' AND te.approval_status = 'approved'
         AND te.end_at IS NOT NULL AND trim(te.end_at) != ''
         AND date(te.start_at) <= date(?) AND date(te.end_at) >= date(?)
       GROUP BY te.employee_id`,
    )
    .all(stationId, toDate, fromDate) as { eid: string; h: number }[]

  const hoursByEmp = new Map<string, number>()
  for (const r of approvedH) {
    hoursByEmp.set(r.eid, Math.max(0, Math.round(Number(r.h) * 100) / 100))
  }

  for (const emp of filtered) {
    const R = emp as Record<string, unknown>
    const id = emp.id
    const name = String(emp.display_name ?? id)
    const monthly = isMonthlyWageRecipient(R)
    const raw = rNum(R, 'hourly_wage', 0)
    const et = String(emp.employment_type ?? '')
    const subject = employmentTypeSubjectToStatutoryMinimum(et)

    let planH = 0
    for (const s of shiftList) {
      if (s.employeeId !== id) continue
      if (String(s.shiftType ?? '').toLowerCase().trim() === 'frei') continue
      if (!s.date || !s.startTime || !s.endTime) continue
      planH += shiftNetHoursFromPlan(s.date, s.startTime, s.endTime, s.breakMinutes ?? 0)
    }
    planH = Math.round(planH * 100) / 100
    const trH = hoursByEmp.get(id) ?? 0

    if (!monthly && raw <= 0 && (planH > 0 || trH > 0)) {
      issues.push({
        severity: 'warning',
        code: 'missing_hourly_wage',
        employeeId: id,
        employeeName: name,
        message: 'Stundenlohn fehlt, aber Schichtplan oder Zeiterfassung enthält Stunden',
        detail: `Schichtplan ca. ${planH} Std., Zeiterfassung ${trH} Std.`,
      })
    }

    if (subject && raw > 0 && raw + 0.003 < maxMinimumWageInRange(db, fromDate, toDate)) {
      issues.push({
        severity: 'warning',
        code: 'below_minimum_wage',
        employeeId: id,
        employeeName: name,
        message: 'Eingetragener Stundenlohn unter gültigem Mindestlohn (Abrechnung wird angehoben)',
      })
    }

    if (!monthly && raw > 0 && (planH > 0 || trH > 0) && Math.abs(planH - trH) > 0.25 && planH > 0 && trH > 0) {
      issues.push({
        severity: 'warning',
        code: 'plan_vs_time_diff',
        employeeId: id,
        employeeName: name,
        message: 'Abweichung Schichtplan vs. Zeiterfassung (freigegeben)',
        detail: `Plan ${planH} Std. · Zeiterfassung ${trH} Std.`,
      })
    }
  }

  return { stationId, fromDate, toDate, issues }
}
