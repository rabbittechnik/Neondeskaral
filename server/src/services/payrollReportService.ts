import type { Database } from 'better-sqlite3'
import type { GermanState } from '../data/germanHolidays2026.js'
import { todayIso } from '../utils/timestamps.js'
import type { AbsenceRow } from './absenceService.js'
import type { EmployeeRow } from './employeeService.js'
import type { TimeEntryRow } from './timeTrackingService.js'
import {
  countAbsenceSpanDaysCalendar,
  defaultPaidHoursPerDayFromEmployee,
  normalizeAbsenceDbType,
} from '../utils/vacationImpactCalculator.js'
import { computeSupplementEurosForTimeEntry, type EmployeeSurchargeFields } from './payrollSurchargeService.js'
import {
  employmentTypeSubjectToStatutoryMinimum,
  getEffectiveHourlyRate,
  getMinimumWageForDate,
} from './statutoryMinWageService.js'
import { listShifts } from './shiftService.js'
import { eachYmdInRangeInclusive, netHoursByBerlinYmdInRange, utcRangeBoundsMs } from '../utils/berlinCalendarWorkHours.js'

export type PayrollReportSource = 'time_tracking' | 'schedule_plan'

export type PayrollEmploymentFilter =
  | 'all'
  | 'all_with_exited'
  | 'vollzeit'
  | 'teilzeit'
  | 'aushilfe'
  | 'schichtleiter'
  | 'chef'
  | 'exited'

export type PayrollTimeTrackingRow = {
  employeeId: string
  employeeName: string
  employmentType: string
  /** Für Lohnberechnung verwendeter Stundenlohn (Durchschnitt bei tagesgenauer Mindestlohn-Anwendung). */
  hourlyWage: number
  /** Eingetragener Profil-Stundenlohn (bei Monatslohn oft 0 / irrelevant). */
  registeredHourlyWage?: number
  /** Kurztext z. B. Mindestlohn-Anpassung */
  minimumWageNote?: string
  totalHours: number
  overtimeHours: number
  vacationDays: number
  paidVacationHours: number
  basePay: number
  supplementsTotal: number
  mankogeld: number
  vl: number
  cashDifference: number
  bonus: number
  advance: number
  total: number
  /** Hinweise z. B. fehlendes Profilfeld — nicht berechnend, nur Anzeige */
  messages?: string[]
}

export type PayrollTimeTrackingTotals = {
  totalHours: number
  overtimeHours: number
  vacationDays: number
  basePay: number
  supplementsTotal: number
  mankogeld: number
  vl: number
  cashDifference: number
  bonus: number
  advance: number
  total: number
}

export type PayrollTimeTrackingReport = {
  stationId: string
  stationName: string
  federalState: GermanState
  fromDate: string
  toDate: string
  hasPendingApprovedTime: boolean
  /** Worauf die Berechnung basiert (Profil-/Schicht-/Zeiteinträge weiterhin echte Daten) */
  reportSource: PayrollReportSource
  rows: PayrollTimeTrackingRow[]
  totals: PayrollTimeTrackingTotals
}

type PayrollAdjBuckets = {
  cash: number
  bonus: number
  advance: number
  mankogeldExtra: number
  vlExtra: number
}

function emptyBuckets(): PayrollAdjBuckets {
  return { cash: 0, bonus: 0, advance: 0, mankogeldExtra: 0, vlExtra: 0 }
}

function accumulatePayrollAdjustments(rows: { employee_id: string; type: string; amount: number }[]) {
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

function mergeChecklistCashIntoBuckets(
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

/** pay_type / wage_type aus employees: Monatslohn vs. Stundenlohn */
function isMonthlyWageRecipient(R: Record<string, unknown>): boolean {
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

function pad2(n: number): string {
  return String(Math.trunc(n)).padStart(2, '0')
}

/** ISO für Zuschlagsberechnung (lokale Interpretation des Datumsstrings). */
function shiftToIsoEndpoints(dateStr: string, startTime: string, endTime: string): { startIso: string; endIso: string } {
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

function shiftNetHoursFromPlan(dateStr: string, startTime: string, endTime: string, breakMin: number): number {
  const [sh, sm] = startTime.split(':').map((x) => Number(x))
  const [eh, em] = endTime.split(':').map((x) => Number(x))
  const sMin = (sh ?? 0) * 60 + (sm ?? 0)
  let eMin = (eh ?? 0) * 60 + (em ?? 0)
  if (eMin <= sMin) eMin += 24 * 60
  const grossH = (eMin - sMin) / 60
  const brH = Math.max(0, Number(breakMin) || 0) / 60
  return Math.max(0, Math.round((grossH - brH) * 100) / 100)
}

export type PayrollTimeEntryDetailRow = {
  id: string
  employeeId: string
  employeeName: string
  date: string
  startAt: string
  endAt: string
  breakMinutes: number
  hours: number
  source: string
  status: string
  approvalStatus: string
}

function rNum(row: Record<string, unknown>, k: string, fb = 0): number {
  const v = row[k]
  if (v == null || v === '') return fb
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

function isExitedEmployee(row: EmployeeRow & Record<string, unknown>, todayYmd: string): boolean {
  if (String(row.deleted_at ?? '').trim()) return true
  if ((row.active ?? 1) === 0) return true
  const st = String(row.status ?? '').toLowerCase()
  if (st === 'deleted' || st === 'geloescht') return true
  const ed = String(row.end_date ?? '').trim()
  if (ed && ed < todayYmd) return true
  return false
}

function matchesEmploymentFilter(
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

function hideInPayroll(row: Record<string, unknown>): boolean {
  return rNum(row, 'hide_in_payroll', 0) === 1
}

/** Netto-Stunden im Zeitraum; Pause anteilig nach Überlappung. */
function entryNetHoursInRange(
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

function overlapPaidVacationDays(a: AbsenceRow, from: string, to: string): number {
  const t = normalizeAbsenceDbType(a.type)
  if (t !== 'paid_vacation') return 0
  if (a.status !== 'approved') return 0
  if ((a.counts_against_vacation ?? 0) !== 1) return 0

  const s = a.start_date > from ? a.start_date : from
  const e = a.end_date < to ? a.end_date : to
  if (e < s) return 0

  const half = (a.half_day ?? 0) === 1
  if (a.start_date === a.end_date && half) {
    if (s <= a.start_date && e >= a.start_date) return 0.5
    return 0
  }
  return countAbsenceSpanDaysCalendar(s, e, false)
}

function paidHoursPerDayForAbsence(a: AbsenceRow, empVacHoursPerDay: number | null): number {
  const fromRow = Number(a.paid_hours_per_day ?? 0)
  if (Number.isFinite(fromRow) && fromRow > 0) return fromRow
  return defaultPaidHoursPerDayFromEmployee(empVacHoursPerDay)
}

/** Anteil 0 / 0.5 / 1 bezogen auf bezahlten Urlaubstag (Kalenderdatum). */
function vacationDayWeight(ab: AbsenceRow, ymd: string): number {
  if (ymd < ab.start_date || ymd > ab.end_date) return 0
  const half = (ab.half_day ?? 0) === 1
  if (ab.start_date === ab.end_date) {
    return ymd === ab.start_date ? (half ? 0.5 : 1) : 0
  }
  if (half && ymd === ab.start_date) return 0.5
  return 1
}

function mergePaidVacationHoursByBerlinYmd(
  absences: AbsenceRow[],
  employeeId: string,
  rangeFrom: string,
  rangeTo: string,
  vacHpdDefault: number | null,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const ab of absences) {
    if (ab.employee_id !== employeeId) continue
    if (normalizeAbsenceDbType(ab.type) !== 'paid_vacation') continue
    if (ab.status !== 'approved') continue
    if ((ab.counts_against_vacation ?? 0) !== 1) continue
    const s = ab.start_date > rangeFrom ? ab.start_date : rangeFrom
    const e = ab.end_date < rangeTo ? ab.end_date : rangeTo
    if (e < s) continue
    for (const ymd of eachYmdInRangeInclusive(s, e)) {
      const w = vacationDayWeight(ab, ymd)
      if (w <= 0) continue
      const hpd = paidHoursPerDayForAbsence(ab, vacHpdDefault)
      map.set(ymd, (map.get(ymd) ?? 0) + w * hpd)
    }
  }
  return map
}

function maxMinimumWageInRange(db: Database, fromYmd: string, toYmd: string): number {
  let m = 0
  for (const d of eachYmdInRangeInclusive(fromYmd, toYmd)) {
    const v = getMinimumWageForDate(db, d)
    if (v > m) m = v
  }
  return m
}

function festangestelltMinWageWarning(
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

function surchargeFieldsFromEmployee(row: Record<string, unknown>): EmployeeSurchargeFields {
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

/** Anteil „1 Monatsbetrag“ über Kalendertage im Zeitraum (tagesgenau). */
function prorateFixedMonthlyAmountOverRange(monthlyAmount: number, fromYmd: string, toYmd: string): number {
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

function parseEmploymentFilter(raw: string | undefined): PayrollEmploymentFilter {
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

export function calculatePayrollTimeTrackingReport(
  db: Database,
  opts: {
    stationId: string
    fromDate: string
    toDate: string
    employmentFilter?: string
  },
): PayrollTimeTrackingReport {
  const stationId = opts.stationId.trim()
  const fromDate = opts.fromDate.trim()
  const toDate = opts.toDate.trim()
  const employmentFilter = parseEmploymentFilter(opts.employmentFilter)

  if (!stationId) throw new Error('stationId erforderlich')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) throw new Error('from/to als YYYY-MM-DD')
  if (fromDate > toDate) throw new Error('from darf nicht nach to liegen')

  const station = db.prepare(`SELECT name, federal_state FROM stations WHERE id = ?`).get(stationId) as
    | { name: string; federal_state: string | null }
    | undefined
  if (!station) throw new Error('Station nicht gefunden')

  const federalState = String(station.federal_state ?? 'BW').toUpperCase() as GermanState
  const todayYmd = todayIso()

  const employees = db
    .prepare(`SELECT * FROM employees WHERE station_id = ? ORDER BY display_name`)
    .all(stationId) as (EmployeeRow & Record<string, unknown>)[]

  const filteredEmployees = employees.filter(
    (e) => !hideInPayroll(e) && matchesEmploymentFilter(e, employmentFilter, todayYmd),
  )

  const approvedEntries = db
    .prepare(
      `SELECT te.* FROM time_entries te
       WHERE te.station_id = ?
         AND te.status = 'completed'
         AND te.approval_status = 'approved'
         AND te.end_at IS NOT NULL AND trim(te.end_at) != ''
         AND date(te.start_at) <= date(?)
         AND date(te.end_at) >= date(?)`,
    )
    .all(stationId, toDate, fromDate) as TimeEntryRow[]

  const pendingEntries = db
    .prepare(
      `SELECT COUNT(*) as c FROM time_entries te
       WHERE te.station_id = ?
         AND te.status = 'completed'
         AND (te.approval_status IS NULL OR trim(te.approval_status) = '' OR te.approval_status NOT IN ('approved', 'rejected'))
         AND te.end_at IS NOT NULL AND trim(te.end_at) != ''
         AND date(te.start_at) <= date(?)
         AND date(te.end_at) >= date(?)`,
    )
    .get(stationId, toDate, fromDate) as { c: number }

  const hasPendingApprovedTime = (pendingEntries?.c ?? 0) > 0

  const absences = db
    .prepare(
      `SELECT * FROM absences WHERE station_id = ?
       AND start_date <= ? AND end_date >= ?`,
    )
    .all(stationId, toDate, fromDate) as AbsenceRow[]

  const adjustments = db
    .prepare(
      `SELECT employee_id, type, amount FROM payroll_adjustments
       WHERE station_id = ? AND date >= ? AND date <= ?`,
    )
    .all(stationId, fromDate, toDate) as { employee_id: string; type: string; amount: number }[]

  const adjByEmployee = accumulatePayrollAdjustments(adjustments)
  mergeChecklistCashIntoBuckets(db, stationId, fromDate, toDate, adjByEmployee)

  const entriesByEmployee = new Map<string, TimeEntryRow[]>()
  for (const te of approvedEntries) {
    const list = entriesByEmployee.get(te.employee_id) ?? []
    list.push(te)
    entriesByEmployee.set(te.employee_id, list)
  }

  const rows: PayrollTimeTrackingRow[] = []

  for (const emp of filteredEmployees) {
    const R = emp as Record<string, unknown>
    const employeeId = emp.id
    const rawHourly = rNum(R, 'hourly_wage', 0)
    const monthlySalary = rNum(R, 'monthly_salary', 0)
    const monthlyRecipient = isMonthlyWageRecipient(R)
    const employmentType = String(emp.employment_type ?? '')
    const subject = employmentTypeSubjectToStatutoryMinimum(employmentType)
    const vacHpdDefault = rNum(R, 'vacation_hours_per_day', NaN) || null

    const wageForSupplements =
      monthlyRecipient ? rawHourly : subject ? getEffectiveHourlyRate(db, employmentType, rawHourly, fromDate) : rawHourly

    let totalHours = 0
    let supplementsTotal = 0
    const myEntries = entriesByEmployee.get(employeeId) ?? []
    for (const te of myEntries) {
      if (!te.start_at || !te.end_at) continue
      const h = entryNetHoursInRange(te.start_at, te.end_at, te.break_minutes ?? 0, fromDate, toDate)
      totalHours += h
      supplementsTotal += computeSupplementEurosForTimeEntry({
        employmentType,
        emp: surchargeFieldsFromEmployee(R),
        hourlyWage: Math.max(0, wageForSupplements),
        startIso: te.start_at,
        endIso: te.end_at,
        breakMinutes: te.break_minutes ?? 0,
        federalState,
      })
    }
    totalHours = Math.round(totalHours * 100) / 100
    supplementsTotal = Math.round(supplementsTotal * 100) / 100

    let vacationDays = 0
    let paidVacationHours = 0

    for (const ab of absences) {
      if (ab.employee_id !== employeeId) continue
      const od = overlapPaidVacationDays(ab, fromDate, toDate)
      if (od <= 0) continue
      vacationDays += od
      const hpd = paidHoursPerDayForAbsence(ab, vacHpdDefault)
      paidVacationHours += od * hpd
    }
    vacationDays = Math.round(vacationDays * 100) / 100
    paidVacationHours = Math.round(paidVacationHours * 100) / 100

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
      const workByYmd = new Map<string, number>()
      for (const te of myEntries) {
        if (!te.start_at || !te.end_at) continue
        const m = netHoursByBerlinYmdInRange(te.start_at, te.end_at, te.break_minutes ?? 0, fromDate, toDate)
        for (const [ymd, hx] of m) {
          workByYmd.set(ymd, (workByYmd.get(ymd) ?? 0) + hx)
        }
      }
      const vacByYmd = mergePaidVacationHoursByBerlinYmd(
        absences,
        employeeId,
        fromDate,
        toDate,
        vacHpdDefault,
      )
      const ymdKeys = new Set([...workByYmd.keys(), ...vacByYmd.keys()])
      for (const ymd of ymdKeys) {
        const wh = workByYmd.get(ymd) ?? 0
        const vh = vacByYmd.get(ymd) ?? 0
        const rate = getEffectiveHourlyRate(db, employmentType, rawHourly, ymd)
        basePay += (wh + vh) * rate
      }
      basePay = Math.round(basePay * 100) / 100
    } else {
      const fw = festangestelltMinWageWarning(db, employmentType, rawHourly, monthlyRecipient, fromDate, toDate)
      if (fw) messages.push(fw)
      if (rawHourly > 0) {
        basePay = Math.round((totalHours + paidVacationHours) * rawHourly * 100) / 100
      } else if (totalHours > 0 || paidVacationHours > 0) {
        messages.push('Stundenlohn fehlt im Mitarbeiterprofil.')
      }
    }

    const denom = Math.round((totalHours + paidVacationHours) * 100) / 100
    let effDisplay = 0
    if (!monthlyRecipient) {
      if (denom > 0 && basePay > 0) effDisplay = basePay / denom
      else if (subject) effDisplay = getEffectiveHourlyRate(db, employmentType, rawHourly, fromDate)
      else effDisplay = rawHourly
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

    const includeRow =
      totalHours > 0 ||
      paidVacationHours > 0 ||
      vacationDays > 0 ||
      basePay > 0 ||
      supplementsTotal !== 0 ||
      mankogeld !== 0 ||
      vl !== 0 ||
      cashDifference !== 0 ||
      bonus !== 0 ||
      advance !== 0

    if (!includeRow) continue

    rows.push({
      employeeId,
      employeeName: emp.display_name,
      employmentType,
      hourlyWage: Math.round(effDisplay * 100) / 100,
      ...(!monthlyRecipient ? { registeredHourlyWage: Math.round(rawHourly * 100) / 100 } : {}),
      ...(minimumWageNote ? { minimumWageNote } : {}),
      totalHours,
      overtimeHours,
      vacationDays,
      paidVacationHours,
      basePay,
      supplementsTotal,
      mankogeld,
      vl,
      cashDifference,
      bonus,
      advance,
      total,
      ...(messages.length ? { messages } : {}),
    })
  }

  const totals: PayrollTimeTrackingTotals = rows.reduce(
    (acc, r) => ({
      totalHours: acc.totalHours + r.totalHours,
      overtimeHours: acc.overtimeHours + r.overtimeHours,
      vacationDays: acc.vacationDays + r.vacationDays,
      basePay: acc.basePay + r.basePay,
      supplementsTotal: acc.supplementsTotal + r.supplementsTotal,
      mankogeld: acc.mankogeld + r.mankogeld,
      vl: acc.vl + r.vl,
      cashDifference: acc.cashDifference + r.cashDifference,
      bonus: acc.bonus + r.bonus,
      advance: acc.advance + r.advance,
      total: acc.total + r.total,
    }),
    {
      totalHours: 0,
      overtimeHours: 0,
      vacationDays: 0,
      basePay: 0,
      supplementsTotal: 0,
      mankogeld: 0,
      vl: 0,
      cashDifference: 0,
      bonus: 0,
      advance: 0,
      total: 0,
    },
  )

  Object.keys(totals).forEach((k) => {
    const key = k as keyof PayrollTimeTrackingTotals
    totals[key] = Math.round(totals[key] * 100) / 100
  })

  return {
    stationId,
    stationName: station.name,
    federalState,
    fromDate,
    toDate,
    hasPendingApprovedTime,
    reportSource: 'time_tracking',
    rows,
    totals,
  }
}

/**
 * Lohnabrechnung auf Basis **geplanter Schichten** (Tabelle `shifts`), gleiche Profil-/Urlaubs-/Anpassungslogik wie Zeiterfassung.
 */
export function calculatePayrollScheduleReport(
  db: Database,
  opts: {
    stationId: string
    fromDate: string
    toDate: string
    employmentFilter?: string
  },
): PayrollTimeTrackingReport {
  const stationId = opts.stationId.trim()
  const fromDate = opts.fromDate.trim()
  const toDate = opts.toDate.trim()
  const employmentFilter = parseEmploymentFilter(opts.employmentFilter)

  if (!stationId) throw new Error('stationId erforderlich')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) throw new Error('from/to als YYYY-MM-DD')
  if (fromDate > toDate) throw new Error('from darf nicht nach to liegen')

  const station = db.prepare(`SELECT name, federal_state FROM stations WHERE id = ?`).get(stationId) as
    | { name: string; federal_state: string | null }
    | undefined
  if (!station) throw new Error('Station nicht gefunden')

  const federalState = String(station.federal_state ?? 'BW').toUpperCase() as GermanState
  const todayYmd = todayIso()

  const employees = db
    .prepare(`SELECT * FROM employees WHERE station_id = ? ORDER BY display_name`)
    .all(stationId) as (EmployeeRow & Record<string, unknown>)[]

  const filteredEmployees = employees.filter(
    (e) => !hideInPayroll(e) && matchesEmploymentFilter(e, employmentFilter, todayYmd),
  )

  const shiftList = listShifts(db, { stationId, from: fromDate, to: toDate }).filter(
    (s) =>
      Boolean(s.employeeId) &&
      String(s.shiftType ?? '')
        .toLowerCase()
        .trim() !== 'frei',
  )

  const absences = db
    .prepare(
      `SELECT * FROM absences WHERE station_id = ?
       AND start_date <= ? AND end_date >= ?`,
    )
    .all(stationId, toDate, fromDate) as AbsenceRow[]

  const adjustments = db
    .prepare(
      `SELECT employee_id, type, amount FROM payroll_adjustments
       WHERE station_id = ? AND date >= ? AND date <= ?`,
    )
    .all(stationId, fromDate, toDate) as { employee_id: string; type: string; amount: number }[]

  const adjByEmployee = accumulatePayrollAdjustments(adjustments)
  mergeChecklistCashIntoBuckets(db, stationId, fromDate, toDate, adjByEmployee)

  const shiftsByEmployee = new Map<string, typeof shiftList>()
  for (const s of shiftList) {
    const id = s.employeeId!
    const list = shiftsByEmployee.get(id) ?? []
    list.push(s)
    shiftsByEmployee.set(id, list)
  }

  const rows: PayrollTimeTrackingRow[] = []

  for (const emp of filteredEmployees) {
    const R = emp as Record<string, unknown>
    const employeeId = emp.id
    const rawHourly = rNum(R, 'hourly_wage', 0)
    const monthlySalary = rNum(R, 'monthly_salary', 0)
    const monthlyRecipient = isMonthlyWageRecipient(R)
    const employmentType = String(emp.employment_type ?? '')
    const subject = employmentTypeSubjectToStatutoryMinimum(employmentType)
    const vacHpdDefault = rNum(R, 'vacation_hours_per_day', NaN) || null

    const wageForSupplements =
      monthlyRecipient ? rawHourly : subject ? getEffectiveHourlyRate(db, employmentType, rawHourly, fromDate) : rawHourly

    let totalHours = 0
    let supplementsTotal = 0
    const myShifts = shiftsByEmployee.get(employeeId) ?? []
    for (const s of myShifts) {
      if (!s.date || !s.startTime || !s.endTime) continue
      if (s.date < fromDate || s.date > toDate) continue
      const h = shiftNetHoursFromPlan(s.date, s.startTime, s.endTime, s.breakMinutes ?? 0)
      totalHours += h
      const { startIso, endIso } = shiftToIsoEndpoints(s.date, s.startTime, s.endTime)
      supplementsTotal += computeSupplementEurosForTimeEntry({
        employmentType,
        emp: surchargeFieldsFromEmployee(R),
        hourlyWage: Math.max(0, wageForSupplements),
        startIso,
        endIso,
        breakMinutes: s.breakMinutes ?? 0,
        federalState,
      })
    }
    totalHours = Math.round(totalHours * 100) / 100
    supplementsTotal = Math.round(supplementsTotal * 100) / 100

    let vacationDays = 0
    let paidVacationHours = 0

    for (const ab of absences) {
      if (ab.employee_id !== employeeId) continue
      const od = overlapPaidVacationDays(ab, fromDate, toDate)
      if (od <= 0) continue
      vacationDays += od
      const hpd = paidHoursPerDayForAbsence(ab, vacHpdDefault)
      paidVacationHours += od * hpd
    }
    vacationDays = Math.round(vacationDays * 100) / 100
    paidVacationHours = Math.round(paidVacationHours * 100) / 100

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
      const workByYmd = new Map<string, number>()
      for (const s of myShifts) {
        if (!s.date || !s.startTime || !s.endTime) continue
        if (s.date < fromDate || s.date > toDate) continue
        const { startIso, endIso } = shiftToIsoEndpoints(s.date, s.startTime, s.endTime)
        const m = netHoursByBerlinYmdInRange(startIso, endIso, s.breakMinutes ?? 0, fromDate, toDate)
        for (const [ymd, hx] of m) {
          workByYmd.set(ymd, (workByYmd.get(ymd) ?? 0) + hx)
        }
      }
      const vacByYmd = mergePaidVacationHoursByBerlinYmd(
        absences,
        employeeId,
        fromDate,
        toDate,
        vacHpdDefault,
      )
      const ymdKeys = new Set([...workByYmd.keys(), ...vacByYmd.keys()])
      for (const ymd of ymdKeys) {
        const wh = workByYmd.get(ymd) ?? 0
        const vh = vacByYmd.get(ymd) ?? 0
        const rate = getEffectiveHourlyRate(db, employmentType, rawHourly, ymd)
        basePay += (wh + vh) * rate
      }
      basePay = Math.round(basePay * 100) / 100
    } else {
      const fw = festangestelltMinWageWarning(db, employmentType, rawHourly, monthlyRecipient, fromDate, toDate)
      if (fw) messages.push(fw)
      if (rawHourly > 0) {
        basePay = Math.round((totalHours + paidVacationHours) * rawHourly * 100) / 100
      } else if (totalHours > 0 || paidVacationHours > 0) {
        messages.push('Stundenlohn fehlt im Mitarbeiterprofil.')
      }
    }

    const denom = Math.round((totalHours + paidVacationHours) * 100) / 100
    let effDisplay = 0
    if (!monthlyRecipient) {
      if (denom > 0 && basePay > 0) effDisplay = basePay / denom
      else if (subject) effDisplay = getEffectiveHourlyRate(db, employmentType, rawHourly, fromDate)
      else effDisplay = rawHourly
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

    const includeRow =
      totalHours > 0 ||
      paidVacationHours > 0 ||
      vacationDays > 0 ||
      basePay > 0 ||
      supplementsTotal !== 0 ||
      mankogeld !== 0 ||
      vl !== 0 ||
      cashDifference !== 0 ||
      bonus !== 0 ||
      advance !== 0

    if (!includeRow) continue

    rows.push({
      employeeId,
      employeeName: emp.display_name,
      employmentType,
      hourlyWage: Math.round(effDisplay * 100) / 100,
      ...(!monthlyRecipient ? { registeredHourlyWage: Math.round(rawHourly * 100) / 100 } : {}),
      ...(minimumWageNote ? { minimumWageNote } : {}),
      totalHours,
      overtimeHours,
      vacationDays,
      paidVacationHours,
      basePay,
      supplementsTotal,
      mankogeld,
      vl,
      cashDifference,
      bonus,
      advance,
      total,
      ...(messages.length ? { messages } : {}),
    })
  }

  const totals: PayrollTimeTrackingTotals = rows.reduce(
    (acc, r) => ({
      totalHours: acc.totalHours + r.totalHours,
      overtimeHours: acc.overtimeHours + r.overtimeHours,
      vacationDays: acc.vacationDays + r.vacationDays,
      basePay: acc.basePay + r.basePay,
      supplementsTotal: acc.supplementsTotal + r.supplementsTotal,
      mankogeld: acc.mankogeld + r.mankogeld,
      vl: acc.vl + r.vl,
      cashDifference: acc.cashDifference + r.cashDifference,
      bonus: acc.bonus + r.bonus,
      advance: acc.advance + r.advance,
      total: acc.total + r.total,
    }),
    {
      totalHours: 0,
      overtimeHours: 0,
      vacationDays: 0,
      basePay: 0,
      supplementsTotal: 0,
      mankogeld: 0,
      vl: 0,
      cashDifference: 0,
      bonus: 0,
      advance: 0,
      total: 0,
    },
  )

  ;(Object.keys(totals) as (keyof PayrollTimeTrackingTotals)[]).forEach((key) => {
    totals[key] = Math.round(totals[key] * 100) / 100
  })

  return {
    stationId,
    stationName: station.name,
    federalState,
    fromDate,
    toDate,
    hasPendingApprovedTime: false,
    reportSource: 'schedule_plan',
    rows,
    totals,
  }
}

export function listPayrollTimeEntryDetails(
  db: Database,
  opts: { stationId: string; fromDate: string; toDate: string; employeeId?: string },
): PayrollTimeEntryDetailRow[] {
  const { stationId, fromDate, toDate, employeeId } = opts
  let sql = `SELECT te.*, e.display_name AS employee_display_name
    FROM time_entries te
    LEFT JOIN employees e ON e.id = te.employee_id AND e.station_id = te.station_id
    WHERE te.station_id = ?
      AND date(te.start_at) <= date(?)
      AND date(te.end_at) >= date(?)`
  const params: string[] = [stationId, toDate, fromDate]
  if (employeeId) {
    sql += ` AND te.employee_id = ?`
    params.push(employeeId)
  }
  sql += ` ORDER BY te.start_at ASC`
  const list = db.prepare(sql).all(...params) as (TimeEntryRow & { employee_display_name?: string | null })[]
  const out: PayrollTimeEntryDetailRow[] = []
  for (const te of list) {
    if (!te.end_at) continue
    const h = entryNetHoursInRange(te.start_at, te.end_at, te.break_minutes ?? 0, fromDate, toDate)
    const approval =
      te.status === 'completed'
        ? te.approval_status && String(te.approval_status).trim()
          ? te.approval_status
          : 'pending'
        : te.approval_status ?? ''
    out.push({
      id: te.id,
      employeeId: te.employee_id,
      employeeName: String(te.employee_display_name ?? '').trim() || te.employee_id,
      date: te.start_at.slice(0, 10),
      startAt: te.start_at,
      endAt: te.end_at,
      breakMinutes: te.break_minutes ?? 0,
      hours: h,
      source: te.source ?? '',
      status: te.status ?? '',
      approvalStatus: approval,
    })
  }
  return out
}
