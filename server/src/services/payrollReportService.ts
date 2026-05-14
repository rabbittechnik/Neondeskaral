import type { Database } from 'better-sqlite3'
import type { GermanState } from '../data/germanHolidays2026.js'
import { todayIso } from '../utils/timestamps.js'
import type { AbsenceRow } from './absenceService.js'
import type { EmployeeRow } from './employeeService.js'
import type { TimeEntryRow } from './timeTrackingService.js'
import {
  computeSupplementEurosForTimeEntry,
  computeScheduleShiftSupplementEuros,
  isGermanPublicHolidayYmd,
  publicHolidayNameDe,
  type EmployeeSurchargeFields,
  type ScheduleShiftSurchargeDebug,
} from './payrollSurchargeService.js'
import { buildStationHolidayOverlay } from './stationExtraHolidayService.js'
import type { StationHolidayOverlay } from '../types/stationHolidayOverlay.js'
import { employmentTypeSubjectToStatutoryMinimum, getEffectiveHourlyRate } from './statutoryMinWageService.js'
import { listShifts } from './shiftService.js'
import { eachYmdInRangeInclusive, netHoursByBerlinYmdInRange, berlinYmdFromMs } from '../utils/berlinCalendarWorkHours.js'
import { berlinWallClockToUtcMs, formatTimeHmBerlin } from '../utils/europeBerlinWallTime.js'
import {
  accumulatePayrollAdjustments,
  absenceApprovedForPayroll,
  computePayrollMoneyBlock,
  entryNetHoursInRange,
  hideInPayroll,
  isExitedEmployee,
  matchesEmploymentFilter,
  mergeChecklistCashIntoBuckets,
  mergePaidAbsenceHoursMapsForPayroll,
  mergePaidVacationHoursByBerlinYmd,
  mergeOtherPaidAbsenceHoursByBerlinYmd,
  parseEmploymentFilter,
  paidHoursPerDayForAbsence,
  rNum,
  vacationDayWeight,
  isMonthlyWageRecipient,
  shiftNetHoursFromPlan,
  shiftToIsoEndpoints,
  surchargeFieldsFromEmployee,
} from './payrollCalculationService.js'
import { normalizeAbsenceDbType } from '../utils/vacationImpactCalculator.js'
import { earlyLeaveReasonLabelDe } from '../constants/earlyLeaveCheckout.js'

export type { PayrollEmploymentFilter } from './payrollCalculationService.js'

export type PayrollReportSource = 'time_tracking' | 'schedule_plan'

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
  /** Sonstige bezahlte Abwesenheit (Krankheit, Sonderurlaub …), Stunden im Zeitraum. */
  paidOtherAbsenceHours?: number
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
  /** Nur Schichtplan: Netto-Stunden aus geplanten Schichten (ohne Urlaubszeilen). */
  workPlanHours?: number
  /** Nur Schichtplan: Tages-/Schichtliste inkl. Urlaub für die Detailansicht. */
  scheduleLines?: PayrollScheduleDetailLine[]
  /** Zeiterfassung: Stempelzeiten plus automatische Urlaubs-/Abwesenheitszeilen (keine DB-time_entries). */
  timeTrackingDetailLines?: PayrollScheduleDetailLine[]
}

export type PayrollScheduleDetailLine = {
  date: string
  weekdayDe: string
  lineType: 'shift' | 'paid_vacation' | 'unpaid_vacation' | 'sick' | 'special_leave' | 'other_absence'
  von: string
  bis: string
  bereich: string
  hours: number
  nacht: string
  samstag: string
  sonntag: string
  feiertag: string
  besondererFeiertag: string
  hinweis: string
  /** z. B. paid_vacation_auto, time_entry (nur Auswertung / Export). */
  lineSource?: string
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
  /** Nur bei reportSource schedule_plan und PAYROLL_SCHEDULE_DEBUG=1 gesetzt. */
  schedulePayrollDebug?: ScheduleShiftSurchargeDebug[]
}

export type PayrollCombinedDaySource =
  | 'schedule'
  | 'time_tracking'
  | 'time_tracking_extra'
  | 'schedule_fallback'
  | 'paid_vacation'
  | 'paid_other_absence'
  | 'manual_correction'
  | 'none'

export type PayrollCombinedDetailHighlight = 'green' | 'yellow' | 'orange' | 'red' | 'neutral'

export type PayrollCombinedShiftDetail = { id: string; label: string; hours: number }

export type PayrollCombinedTimeDetail = {
  id: string
  startAt: string
  endAt: string | null
  hours: number
  open: boolean
  /** Früher >30 Min. vs. Plan: dokumentierter Grund / fehlend (nur Anzeige). */
  earlyLeaveDoc?: 'documented' | 'missing'
}

export type PayrollCombinedDayDetail = {
  date: string
  weekdayDe: string
  scheduleShifts: PayrollCombinedShiftDetail[]
  /** Netto aus geplanten Schichten (Start–Ende abzüglich gespeicherter Pause). */
  scheduledHours: number
  /** Bezahlter Urlaub aus Abwesenheiten (Kalendertag), separat für Anzeige. */
  plannedPaidVacationHours: number
  /** Sonstige bezahlte Abwesenheit (Krankheit, Sonderurlaub …), Kalendertag. */
  plannedOtherPaidAbsenceHours: number
  timeEntries: PayrollCombinedTimeDetail[]
  trackedHours: number
  usedHours: number
  differenceHours: number
  source: PayrollCombinedDaySource
  note: string
  highlight: PayrollCombinedDetailHighlight
  daySupplementsEuro: number
  hasConflict: boolean
}

export type PayrollCombinedRow = {
  employeeId: string
  employeeName: string
  employmentType: string
  hourlyWage: number
  registeredHourlyWage?: number
  minimumWageNote?: string
  scheduleHoursTotal: number
  timeTrackingHoursTotal: number
  usedHoursTotal: number
  differenceHours: number
  extraUnplannedHours: number
  missingTimeEntriesDayCount: number
  unplannedWorkDayCount: number
  vacationDays: number
  paidVacationHours: number
  paidOtherAbsenceHours?: number
  overtimeHours: number
  basePay: number
  supplementsTotal: number
  mankogeld: number
  vl: number
  cashDifference: number
  bonus: number
  advance: number
  total: number
  messages?: string[]
  details: PayrollCombinedDayDetail[]
}

export type PayrollCombinedTotals = {
  scheduleHours: number
  timeTrackingHours: number
  usedHours: number
  differenceHours: number
  extraUnplannedHours: number
  missingTimeEntriesDayCount: number
  unplannedWorkDayCount: number
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

export type PayrollCombinedReport = {
  stationId: string
  stationName: string
  federalState: GermanState
  fromDate: string
  toDate: string
  hasPendingApprovedTime: boolean
  hasOpenRunningTimeEntries: boolean
  rows: PayrollCombinedRow[]
  totals: PayrollCombinedTotals
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
  /** true: keine echte Stempelung (z. B. bezahlter Urlaub aus Abwesenheit). */
  synthetic?: boolean
  absenceId?: string | null
  /** Kurztext Frühgehen >30 Min. mit/ohne Grund (Tablet). */
  earlyLeaveSummary?: string
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
  const holidayOverlay = buildStationHolidayOverlay(db, stationId)
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
    const monthlyRecipient = isMonthlyWageRecipient(R)
    const employmentType = String(emp.employment_type ?? '')
    const subject = employmentTypeSubjectToStatutoryMinimum(employmentType)

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
        holidayOverlay,
      })
    }
    totalHours = Math.round(totalHours * 100) / 100
    supplementsTotal = Math.round(supplementsTotal * 100) / 100

    const workByYmd = new Map<string, number>()
    for (const te of myEntries) {
      if (!te.start_at || !te.end_at) continue
      const m = netHoursByBerlinYmdInRange(te.start_at, te.end_at, te.break_minutes ?? 0, fromDate, toDate)
      for (const [ymd, hx] of m) {
        workByYmd.set(ymd, (workByYmd.get(ymd) ?? 0) + hx)
      }
    }

    const money = computePayrollMoneyBlock({
      db,
      R,
      employeeId,
      fromDate,
      toDate,
      federalState,
      absences,
      adjByEmployee,
      workHoursByBerlinYmd: workByYmd,
      supplementsTotal,
      totalWorkHoursForDisplay: totalHours,
    })

    const {
      basePay,
      vacationDays,
      paidVacationHours,
      paidOtherAbsenceHours,
      payrollHoursTotal,
      overtimeHours,
      hourlyWageDisplay: effDisplay,
      minimumWageNote,
      messages,
      mankogeld,
      vl,
      cashDifference,
      bonus,
      advance,
      total,
    } = money

    const includeRow =
      payrollHoursTotal > 0 ||
      paidVacationHours > 0 ||
      (paidOtherAbsenceHours ?? 0) > 0 ||
      vacationDays > 0 ||
      basePay > 0 ||
      supplementsTotal !== 0 ||
      mankogeld !== 0 ||
      vl !== 0 ||
      cashDifference !== 0 ||
      bonus !== 0 ||
      advance !== 0

    if (!includeRow) continue

    const vacHpdDefaultTt = rNum(R, 'vacation_hours_per_day', NaN) || null
    const timeTrackingDetailLines = buildTimeTrackingPayrollDetailLines({
      employeeId,
      fromDate,
      toDate,
      federalState,
      holidayOverlay,
      employmentType,
      employmentRole: String(R.employment_role ?? ''),
      vacHpdDefault: vacHpdDefaultTt,
      absences,
      timeEntries: myEntries,
    })

    rows.push({
      employeeId,
      employeeName: emp.display_name,
      employmentType,
      hourlyWage: Math.round(effDisplay * 100) / 100,
      ...(!monthlyRecipient ? { registeredHourlyWage: Math.round(rawHourly * 100) / 100 } : {}),
      ...(minimumWageNote ? { minimumWageNote } : {}),
      totalHours: payrollHoursTotal,
      workPlanHours: totalHours,
      overtimeHours,
      vacationDays,
      paidVacationHours,
      ...((paidOtherAbsenceHours ?? 0) > 0 ? { paidOtherAbsenceHours } : {}),
      basePay,
      supplementsTotal,
      mankogeld,
      vl,
      cashDifference,
      bonus,
      advance,
      total,
      timeTrackingDetailLines,
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
  const holidayOverlay = buildStationHolidayOverlay(db, stationId)
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

  const waRows = db
    .prepare(`SELECT id, name FROM work_areas WHERE station_id = ?`)
    .all(stationId) as { id: string; name: string }[]
  const workAreaNameById = new Map(waRows.map((r) => [r.id, String(r.name ?? '').trim() || r.id]))

  const shiftsByEmployee = new Map<string, typeof shiftList>()
  for (const s of shiftList) {
    const id = s.employeeId!
    const list = shiftsByEmployee.get(id) ?? []
    list.push(s)
    shiftsByEmployee.set(id, list)
  }

  const rows: PayrollTimeTrackingRow[] = []
  const schedulePayrollDebug: ScheduleShiftSurchargeDebug[] = []
  const dbgSchedule = process.env.PAYROLL_SCHEDULE_DEBUG === '1'

  for (const emp of filteredEmployees) {
    const R = emp as Record<string, unknown>
    const employeeId = emp.id
    const rawHourly = rNum(R, 'hourly_wage', 0)
    const monthlyRecipient = isMonthlyWageRecipient(R)
    const employmentType = String(emp.employment_type ?? '')
    const subject = employmentTypeSubjectToStatutoryMinimum(employmentType)

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
      const dbg: Partial<ScheduleShiftSurchargeDebug> | undefined = dbgSchedule ? {} : undefined
      const sup = computeScheduleShiftSupplementEuros({
        emp: surchargeFieldsFromEmployee(R),
        hourlyWage: Math.max(0, wageForSupplements),
        shiftDate: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        breakMinutes: s.breakMinutes ?? 0,
        federalState,
        holidayOverlay,
        employeeId,
        employeeName: emp.display_name,
        debug: dbg,
      })
      supplementsTotal += sup
      if (dbgSchedule) {
        const msNoon = berlinWallClockToUtcMs(s.date, '12:00')
        const wdStr = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Europe/Berlin',
          weekday: 'short',
        }).format(new Date(msNoon))
        const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
        const wd0 = wdMap[wdStr] ?? 0
        const base: Partial<ScheduleShiftSurchargeDebug> = {
          employeeId,
          employeeName: emp.display_name,
          date: s.date,
          shiftStart: String(s.startTime),
          shiftEnd: String(s.endTime),
          hoursNet: h,
          isSunday: wd0 === 0,
          isSaturday: wd0 === 6,
          isPublicHoliday: isGermanPublicHolidayYmd(s.date, federalState, holidayOverlay),
          holidayName: publicHolidayNameDe(s.date, federalState, holidayOverlay),
          isSpecialHolidayTier: false,
          hourlyRate: Math.max(0, wageForSupplements),
          holidayBonusPercentApplied: 0,
          holidayBonusAmount: 0,
          sundayBonusAmount: 0,
          saturdayBonusAmount: 0,
          nightBonusAmount: 0,
          night04BonusAmount: 0,
          totalBonuses: sup,
        }
        const merged = { ...base, ...(dbg ?? {}) } as ScheduleShiftSurchargeDebug
        merged.totalBonuses = Math.round(sup * 100) / 100
        schedulePayrollDebug.push(merged)
        console.info('[PAYROLL_SCHEDULE_DEBUG]', JSON.stringify(merged))
      }
    }
    totalHours = Math.round(totalHours * 100) / 100
    supplementsTotal = Math.round(supplementsTotal * 100) / 100

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

    const money = computePayrollMoneyBlock({
      db,
      R,
      employeeId,
      fromDate,
      toDate,
      federalState,
      absences,
      adjByEmployee,
      workHoursByBerlinYmd: workByYmd,
      supplementsTotal,
      totalWorkHoursForDisplay: totalHours,
    })

    const {
      basePay,
      vacationDays,
      paidVacationHours,
      paidOtherAbsenceHours,
      payrollHoursTotal,
      overtimeHours,
      hourlyWageDisplay: effDisplay,
      minimumWageNote,
      messages,
      mankogeld,
      vl,
      cashDifference,
      bonus,
      advance,
      total,
    } = money

    const includeRow =
      payrollHoursTotal > 0 ||
      paidVacationHours > 0 ||
      (paidOtherAbsenceHours ?? 0) > 0 ||
      vacationDays > 0 ||
      basePay > 0 ||
      supplementsTotal !== 0 ||
      mankogeld !== 0 ||
      vl !== 0 ||
      cashDifference !== 0 ||
      bonus !== 0 ||
      advance !== 0

    if (!includeRow) continue

    const vacHpdDefault = rNum(R, 'vacation_hours_per_day', NaN) || null
    const scheduleLines = buildSchedulePayrollDetailLines({
      employeeId,
      fromDate,
      toDate,
      federalState,
      holidayOverlay,
      employmentType,
      employmentRole: String(R.employment_role ?? ''),
      vacHpdDefault,
      myShifts,
      absences,
      workAreaNameById,
    })

    rows.push({
      employeeId,
      employeeName: emp.display_name,
      employmentType,
      hourlyWage: Math.round(effDisplay * 100) / 100,
      ...(!monthlyRecipient ? { registeredHourlyWage: Math.round(rawHourly * 100) / 100 } : {}),
      ...(minimumWageNote ? { minimumWageNote } : {}),
      totalHours: payrollHoursTotal,
      workPlanHours: totalHours,
      overtimeHours,
      vacationDays,
      paidVacationHours,
      ...((paidOtherAbsenceHours ?? 0) > 0 ? { paidOtherAbsenceHours } : {}),
      basePay,
      supplementsTotal,
      mankogeld,
      vl,
      cashDifference,
      bonus,
      advance,
      total,
      scheduleLines,
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
    ...(dbgSchedule && schedulePayrollDebug.length ? { schedulePayrollDebug } : {}),
  }
}

function weekdayDeLongEuropeBerlin(ymd: string): string {
  const ms = berlinWallClockToUtcMs(ymd, '12:00')
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'Europe/Berlin' }).format(new Date(ms))
}

function weekdayShortFlags(ymd: string): { sat: boolean; sun: boolean } {
  const ms = berlinWallClockToUtcMs(ymd, '12:00')
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Berlin' }).format(new Date(ms))
  return { sat: wd === 'Sat', sun: wd === 'Sun' }
}

function lineTypeSortRank(t: PayrollScheduleDetailLine['lineType']): number {
  if (t === 'shift') return 0
  if (t === 'paid_vacation') return 1
  if (t === 'special_leave') return 2
  return 3
}

export function buildSchedulePayrollDetailLines(p: {
  employeeId: string
  fromDate: string
  toDate: string
  federalState: GermanState
  holidayOverlay?: StationHolidayOverlay | null
  employmentType: string
  employmentRole: string
  vacHpdDefault: number | null
  myShifts: Array<{
    id: string
    date?: string
    startTime?: string
    endTime?: string
    breakMinutes?: number
    shiftType?: string
    workAreaId?: string
    note?: string
  }>
  absences: AbsenceRow[]
  workAreaNameById: Map<string, string>
}): PayrollScheduleDetailLine[] {
  const lines: PayrollScheduleDetailLine[] = []
  const vacByYmd = mergePaidVacationHoursByBerlinYmd(
    p.absences,
    p.employeeId,
    p.fromDate,
    p.toDate,
    p.vacHpdDefault,
    p.federalState,
    p.employmentType,
    p.employmentRole,
  )

  for (const s of p.myShifts) {
    if (!s.date || !s.startTime || !s.endTime) continue
    if (s.date < p.fromDate || s.date > p.toDate) continue
    const st = String(s.shiftType ?? '')
      .toLowerCase()
      .trim()
    if (st === 'frei') continue
    const h = shiftNetHoursFromPlan(s.date, s.startTime, s.endTime, s.breakMinutes ?? 0)
    const feiertag = isGermanPublicHolidayYmd(s.date, p.federalState, p.holidayOverlay ?? null)
      ? publicHolidayNameDe(s.date, p.federalState, p.holidayOverlay ?? null)
      : ''
    const { sat, sun } = weekdayShortFlags(s.date)
    const area = p.workAreaNameById.get(String(s.workAreaId ?? ''))?.trim() || 'Schicht'
    const note = String(s.note ?? '').trim()
    lines.push({
      date: s.date,
      weekdayDe: weekdayDeLongEuropeBerlin(s.date),
      lineType: 'shift',
      von: String(s.startTime).slice(0, 5),
      bis: String(s.endTime).slice(0, 5),
      bereich: area,
      hours: h,
      nacht: '—',
      samstag: sat ? '✓' : '',
      sonntag: sun ? '✓' : '',
      feiertag,
      besondererFeiertag: '',
      hinweis: [feiertag ? `Feiertag: ${feiertag}` : '', note].filter(Boolean).join(' · ') || (feiertag ? `Feiertag: ${feiertag}` : ''),
    })
  }

  for (const ymd of eachYmdInRangeInclusive(p.fromDate, p.toDate)) {
    const vh = vacByYmd.get(ymd) ?? 0
    if (vh <= 0) continue
    const { sat, sun } = weekdayShortFlags(ymd)
    const hol = isGermanPublicHolidayYmd(ymd, p.federalState, p.holidayOverlay ?? null)
      ? publicHolidayNameDe(ymd, p.federalState, p.holidayOverlay ?? null)
      : ''
    lines.push({
      date: ymd,
      weekdayDe: weekdayDeLongEuropeBerlin(ymd),
      lineType: 'paid_vacation',
      von: '',
      bis: '',
      bereich: 'Urlaub',
      hours: vh,
      nacht: '',
      samstag: sat ? '✓' : '',
      sonntag: sun ? '✓' : '',
      feiertag: hol,
      besondererFeiertag: '',
      hinweis: hol
        ? `Urlaub bezahlt · Quelle: Bezahlter Urlaub (automatisch aus Abwesenheit, keine Stempelung). Feiertag: ${hol}.`
        : 'Urlaub bezahlt · Quelle: Bezahlter Urlaub (automatisch aus Abwesenheit, keine Stempelung).',
      lineSource: 'paid_vacation_auto',
    })
  }

  for (const ab of p.absences) {
    if (ab.employee_id !== p.employeeId || !absenceApprovedForPayroll(ab)) continue
    const t = normalizeAbsenceDbType(ab.type)
    if (t === 'paid_vacation') continue
    const s = ab.start_date > p.fromDate ? ab.start_date : p.fromDate
    const e = ab.end_date < p.toDate ? ab.end_date : p.toDate
    if (e < s) continue
    for (const ymd of eachYmdInRangeInclusive(s, e)) {
      if (t === 'unpaid_vacation' && (vacByYmd.get(ymd) ?? 0) > 0) continue
      const label =
        t === 'sick' || t === 'child_sick'
          ? 'Krank'
          : t === 'unpaid_vacation'
            ? 'Urlaub (unbezahlt)'
            : t === 'special_leave'
              ? 'Sonderurlaub'
              : 'Abwesenheit'
      const { sat, sun } = weekdayShortFlags(ymd)
      const hol = isGermanPublicHolidayYmd(ymd, p.federalState, p.holidayOverlay ?? null)
      ? publicHolidayNameDe(ymd, p.federalState, p.holidayOverlay ?? null)
      : ''
      const paidOther =
        (t === 'sick' || t === 'child_sick' || t === 'special_leave') &&
        (ab.paid ?? 0) === 1 &&
        paidHoursPerDayForAbsence(ab, p.vacHpdDefault) > 0
      const dayHours = paidOther
        ? Math.round(vacationDayWeight(ab, ymd) * paidHoursPerDayForAbsence(ab, p.vacHpdDefault) * 100) / 100
        : 0
      const lineType: PayrollScheduleDetailLine['lineType'] =
        t === 'unpaid_vacation'
          ? 'unpaid_vacation'
          : t === 'sick' || t === 'child_sick'
            ? 'sick'
            : t === 'special_leave'
              ? 'special_leave'
              : 'other_absence'
      lines.push({
        date: ymd,
        weekdayDe: weekdayDeLongEuropeBerlin(ymd),
        lineType,
        von: '',
        bis: '',
        bereich: label,
        hours: dayHours,
        nacht: '',
        samstag: sat ? '✓' : '',
        sonntag: sun ? '✓' : '',
        feiertag: hol,
        besondererFeiertag: '',
        hinweis:
          dayHours > 0
            ? 'Bezahlte Abwesenheit (Lohn) · Quelle: Abwesenheit'
            : t === 'unpaid_vacation'
              ? 'Unbezahlter Urlaub – nicht bezahlt'
              : 'Nicht als bezahlte Arbeitsstunden gewertet',
      })
    }
  }

  lines.sort((a, b) => a.date.localeCompare(b.date) || lineTypeSortRank(a.lineType) - lineTypeSortRank(b.lineType))
  return lines
}

/** Detailzeilen für Lohnabrechnung Zeiterfassung: genehmigte Einträge plus automatische Urlaubs-/Abwesenheitszeilen (keine synthetischen `time_entries`). */
export function buildTimeTrackingPayrollDetailLines(p: {
  employeeId: string
  fromDate: string
  toDate: string
  federalState: GermanState
  holidayOverlay?: StationHolidayOverlay | null
  employmentType: string
  employmentRole: string
  vacHpdDefault: number | null
  absences: AbsenceRow[]
  timeEntries: TimeEntryRow[]
}): PayrollScheduleDetailLine[] {
  const lines: PayrollScheduleDetailLine[] = []

  for (const te of p.timeEntries) {
    if (te.employee_id !== p.employeeId) continue
    if (te.status !== 'completed' || String(te.approval_status ?? '').trim() !== 'approved') continue
    if (!te.start_at || !te.end_at) continue
    const m = netHoursByBerlinYmdInRange(te.start_at, te.end_at, te.break_minutes ?? 0, p.fromDate, p.toDate)
    const ymKeys = [...m.keys()].filter((k) => (m.get(k) ?? 0) > 0)
    for (const ymd of ymKeys) {
      const h = Math.round((m.get(ymd) ?? 0) * 100) / 100
      if (h <= 0) continue
      const { sat, sun } = weekdayShortFlags(ymd)
      const feiertag = isGermanPublicHolidayYmd(ymd, p.federalState, p.holidayOverlay ?? null)
        ? publicHolidayNameDe(ymd, p.federalState, p.holidayOverlay ?? null)
        : ''
      let von = '—'
      let bis = '—'
      let hinweis = 'Quelle: Zeiterfassung · genehmigter Eintrag'
      if (ymKeys.length === 1) {
        const sMs = new Date(te.start_at).getTime()
        const eMs = new Date(te.end_at).getTime()
        if (Number.isFinite(sMs) && Number.isFinite(eMs)) {
          von = formatTimeHmBerlin(sMs)
          bis = formatTimeHmBerlin(eMs)
        }
      } else {
        hinweis = 'Quelle: Zeiterfassung (mehrtägiger Eintrag, Anteil Kalendertag).'
      }
      lines.push({
        date: ymd,
        weekdayDe: weekdayDeLongEuropeBerlin(ymd),
        lineType: 'shift',
        von,
        bis,
        bereich: 'Zeiterfassung',
        hours: h,
        nacht: '—',
        samstag: sat ? '✓' : '',
        sonntag: sun ? '✓' : '',
        feiertag,
        besondererFeiertag: '',
        hinweis: [hinweis, feiertag ? `Feiertag: ${feiertag}` : ''].filter(Boolean).join(' · '),
        lineSource: 'time_entry',
      })
    }
  }

  const vacByYmd = mergePaidVacationHoursByBerlinYmd(
    p.absences,
    p.employeeId,
    p.fromDate,
    p.toDate,
    p.vacHpdDefault,
    p.federalState,
    p.employmentType,
    p.employmentRole,
  )

  for (const ymd of eachYmdInRangeInclusive(p.fromDate, p.toDate)) {
    const vh = vacByYmd.get(ymd) ?? 0
    if (vh <= 0) continue
    const { sat, sun } = weekdayShortFlags(ymd)
    const hol = isGermanPublicHolidayYmd(ymd, p.federalState, p.holidayOverlay ?? null)
      ? publicHolidayNameDe(ymd, p.federalState, p.holidayOverlay ?? null)
      : ''
    lines.push({
      date: ymd,
      weekdayDe: weekdayDeLongEuropeBerlin(ymd),
      lineType: 'paid_vacation',
      von: '',
      bis: '',
      bereich: 'Urlaub',
      hours: vh,
      nacht: '',
      samstag: sat ? '✓' : '',
      sonntag: sun ? '✓' : '',
      feiertag: hol,
      besondererFeiertag: '',
      hinweis: hol
        ? `Urlaub bezahlt · Quelle: Bezahlter Urlaub (automatisch aus Abwesenheit, keine Stempelung). Feiertag: ${hol}.`
        : 'Urlaub bezahlt · Quelle: Bezahlter Urlaub (automatisch aus Abwesenheit, keine Stempelung).',
      lineSource: 'paid_vacation_auto',
    })
  }

  for (const ab of p.absences) {
    if (ab.employee_id !== p.employeeId || !absenceApprovedForPayroll(ab)) continue
    const t = normalizeAbsenceDbType(ab.type)
    if (t === 'paid_vacation') continue
    const s = ab.start_date > p.fromDate ? ab.start_date : p.fromDate
    const e = ab.end_date < p.toDate ? ab.end_date : p.toDate
    if (e < s) continue
    for (const ymd of eachYmdInRangeInclusive(s, e)) {
      if (t === 'unpaid_vacation' && (vacByYmd.get(ymd) ?? 0) > 0) continue
      const label =
        t === 'sick' || t === 'child_sick'
          ? 'Krank'
          : t === 'unpaid_vacation'
            ? 'Urlaub (unbezahlt)'
            : t === 'special_leave'
              ? 'Sonderurlaub'
              : 'Abwesenheit'
      const { sat, sun } = weekdayShortFlags(ymd)
      const hol = isGermanPublicHolidayYmd(ymd, p.federalState, p.holidayOverlay ?? null)
      ? publicHolidayNameDe(ymd, p.federalState, p.holidayOverlay ?? null)
      : ''
      const paidOther =
        (t === 'sick' || t === 'child_sick' || t === 'special_leave') &&
        (ab.paid ?? 0) === 1 &&
        paidHoursPerDayForAbsence(ab, p.vacHpdDefault) > 0
      const dayHours = paidOther
        ? Math.round(vacationDayWeight(ab, ymd) * paidHoursPerDayForAbsence(ab, p.vacHpdDefault) * 100) / 100
        : 0
      const lineType: PayrollScheduleDetailLine['lineType'] =
        t === 'unpaid_vacation'
          ? 'unpaid_vacation'
          : t === 'sick' || t === 'child_sick'
            ? 'sick'
            : t === 'special_leave'
              ? 'special_leave'
              : 'other_absence'
      lines.push({
        date: ymd,
        weekdayDe: weekdayDeLongEuropeBerlin(ymd),
        lineType,
        von: '',
        bis: '',
        bereich: label,
        hours: dayHours,
        nacht: '',
        samstag: sat ? '✓' : '',
        sonntag: sun ? '✓' : '',
        feiertag: hol,
        besondererFeiertag: '',
        hinweis:
          dayHours > 0
            ? 'Bezahlte Abwesenheit (Lohn) · Quelle: Abwesenheit'
            : t === 'unpaid_vacation'
              ? 'Unbezahlter Urlaub – nicht bezahlt'
              : 'Nicht als bezahlte Arbeitsstunden gewertet',
        lineSource: dayHours > 0 ? 'paid_other_absence_auto' : 'absence_display',
      })
    }
  }

  lines.sort((a, b) => a.date.localeCompare(b.date) || lineTypeSortRank(a.lineType) - lineTypeSortRank(b.lineType))
  return lines
}

function parseEmployeeIdFilter(raw: string | undefined): Set<string> | null {
  if (!raw || !String(raw).trim()) return null
  const ids = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.length ? new Set(ids) : null
}

/**
 * Lohnabrechnung **Zusammenfassung**: pro Kalendertag (Europe/Berlin) max(Schichtplan, freigegebene Zeiterfassung),
 * Schichtplan als Fallback bei fehlender/kürzerer Stempelung, Zuschläge je Quelle (Plan vs. gestempelt).
 */
export function calculatePayrollCombinedReport(
  db: Database,
  opts: {
    stationId: string
    fromDate: string
    toDate: string
    employmentFilter?: string
    employeeIds?: string
  },
): PayrollCombinedReport {
  const stationId = opts.stationId.trim()
  const fromDate = opts.fromDate.trim()
  const toDate = opts.toDate.trim()
  const employmentFilter = parseEmploymentFilter(opts.employmentFilter)
  const employeeIdFilter = parseEmployeeIdFilter(opts.employeeIds)

  if (!stationId) throw new Error('stationId erforderlich')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) throw new Error('from/to als YYYY-MM-DD')
  if (fromDate > toDate) throw new Error('from darf nicht nach to liegen')

  const station = db.prepare(`SELECT name, federal_state FROM stations WHERE id = ?`).get(stationId) as
    | { name: string; federal_state: string | null }
    | undefined
  if (!station) throw new Error('Station nicht gefunden')

  const federalState = String(station.federal_state ?? 'BW').toUpperCase() as GermanState
  const holidayOverlay = buildStationHolidayOverlay(db, stationId)
  const todayYmd = todayIso()

  const employees = db
    .prepare(`SELECT * FROM employees WHERE station_id = ? ORDER BY display_name`)
    .all(stationId) as (EmployeeRow & Record<string, unknown>)[]

  let filteredEmployees = employees.filter(
    (e) => !hideInPayroll(e) && matchesEmploymentFilter(e, employmentFilter, todayYmd),
  )
  if (employeeIdFilter) {
    filteredEmployees = filteredEmployees.filter((e) => employeeIdFilter.has(e.id))
  }

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

  const openRunning = db
    .prepare(
      `SELECT te.* FROM time_entries te
       WHERE te.station_id = ?
         AND te.status = 'completed'
         AND (te.end_at IS NULL OR trim(te.end_at) = '')
         AND date(te.start_at) <= date(?)`,
    )
    .all(stationId, toDate) as TimeEntryRow[]

  const hasOpenRunningTimeEntries = openRunning.length > 0

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

  const entriesByEmployee = new Map<string, TimeEntryRow[]>()
  for (const te of approvedEntries) {
    const list = entriesByEmployee.get(te.employee_id) ?? []
    list.push(te)
    entriesByEmployee.set(te.employee_id, list)
  }

  const openByEmployee = new Map<string, TimeEntryRow[]>()
  for (const te of openRunning) {
    const list = openByEmployee.get(te.employee_id) ?? []
    list.push(te)
    openByEmployee.set(te.employee_id, list)
  }

  type YmdPack = {
    sh: number
    tr: number
    shifts: PayrollCombinedShiftDetail[]
    entries: PayrollCombinedTimeDetail[]
    openConflict: boolean
  }

  const rows: PayrollCombinedRow[] = []

  for (const emp of filteredEmployees) {
    const R = emp as Record<string, unknown>
    const employeeId = emp.id
    const rawHourly = rNum(R, 'hourly_wage', 0)
    const monthlyRecipient = isMonthlyWageRecipient(R)
    const employmentType = String(emp.employment_type ?? '')
    const subject = employmentTypeSubjectToStatutoryMinimum(employmentType)

    const wageForSupplements =
      monthlyRecipient ? rawHourly : subject ? getEffectiveHourlyRate(db, employmentType, rawHourly, fromDate) : rawHourly

    const empFields = surchargeFieldsFromEmployee(R)
    const myShifts = shiftsByEmployee.get(employeeId) ?? []
    const myEntries = entriesByEmployee.get(employeeId) ?? []
    const myOpen = openByEmployee.get(employeeId) ?? []

    const byYmd = new Map<string, YmdPack>()
    const ensurePack = (ymd: string): YmdPack => {
      const p = byYmd.get(ymd) ?? { sh: 0, tr: 0, shifts: [], entries: [], openConflict: false }
      byYmd.set(ymd, p)
      return p
    }

    for (const s of myShifts) {
      if (!s.date || !s.startTime || !s.endTime) continue
      if (s.date < fromDate || s.date > toDate) continue
      const { startIso, endIso } = shiftToIsoEndpoints(s.date, s.startTime, s.endTime)
      const m = netHoursByBerlinYmdInRange(startIso, endIso, s.breakMinutes ?? 0, fromDate, toDate)
      const label = `${String(s.startTime).slice(0, 5)}–${String(s.endTime).slice(0, 5)}`
      for (const [ymd, h] of m) {
        if (h <= 0) continue
        const p = ensurePack(ymd)
        p.sh += h
        p.shifts.push({ id: s.id, label, hours: Math.round(h * 100) / 100 })
      }
    }

    for (const te of myEntries) {
      if (!te.start_at || !te.end_at) continue
      const m = netHoursByBerlinYmdInRange(te.start_at, te.end_at, te.break_minutes ?? 0, fromDate, toDate)
      for (const [ymd, h] of m) {
        if (h <= 0) continue
        const p = ensurePack(ymd)
        p.tr += h
        p.entries.push({
          id: te.id,
          startAt: te.start_at,
          endAt: te.end_at,
          hours: Math.round(h * 100) / 100,
          open: false,
          earlyLeaveDoc:
            te.end_deviation_type === 'early' &&
            typeof te.end_deviation_minutes === 'number' &&
            te.end_deviation_minutes > 30
              ? te.early_leave_reason
                ? ('documented' as const)
                : ('missing' as const)
              : undefined,
        })
      }
    }

    for (const te of myOpen) {
      if (!te.start_at) continue
      const startMs = new Date(te.start_at).getTime()
      if (!Number.isFinite(startMs)) continue
      const d0 = berlinYmdFromMs(startMs)
      const spanStart = d0 < fromDate ? fromDate : d0
      if (spanStart > toDate) continue
      for (const ymd of eachYmdInRangeInclusive(spanStart, toDate)) {
        const p = ensurePack(ymd)
        p.openConflict = true
        if (!p.entries.some((e) => e.id === te.id && e.open)) {
          p.entries.push({
            id: te.id,
            startAt: te.start_at,
            endAt: null,
            hours: 0,
            open: true,
          })
        }
      }
    }

    const vacHpdDefaultCombined = rNum(R, 'vacation_hours_per_day', NaN) || null
    const employmentRoleCombined = String(R.employment_role ?? '')
    const vacByYmd = mergePaidVacationHoursByBerlinYmd(
      absences,
      employeeId,
      fromDate,
      toDate,
      vacHpdDefaultCombined,
      federalState,
      employmentType,
      employmentRoleCombined,
    )
    const otherPaidByYmdCombined = mergeOtherPaidAbsenceHoursByBerlinYmd(
      absences,
      employeeId,
      fromDate,
      toDate,
      vacHpdDefaultCombined,
      federalState,
      employmentType,
      employmentRoleCombined,
    )
    const vacByYmdAll = mergePaidAbsenceHoursMapsForPayroll(vacByYmd, otherPaidByYmdCombined)
    for (const ymd of vacByYmdAll.keys()) {
      ensurePack(ymd)
    }

    const details: PayrollCombinedDayDetail[] = []
    let supplementsTotal = 0
    let scheduleHoursTotal = 0
    let timeTrackingHoursTotal = 0
    let usedHoursTotal = 0
    let missingTimeEntriesDayCount = 0
    let unplannedWorkDayCount = 0
    let extraUnplannedHours = 0

    const sortedYmd = [...new Set([...byYmd.keys(), ...vacByYmdAll.keys()])].sort()
    for (const ymd of sortedYmd) {
      const pack = ensurePack(ymd)
      const sh = Math.round(pack.sh * 100) / 100
      const tr = Math.round(pack.tr * 100) / 100
      const vhVac = Math.round((vacByYmd.get(ymd) ?? 0) * 100) / 100
      const vhOther = Math.round((otherPaidByYmdCombined.get(ymd) ?? 0) * 100) / 100
      const vh = Math.round((vacByYmdAll.get(ymd) ?? 0) * 100) / 100
      scheduleHoursTotal += sh
      if (vh > 0 && sh <= 0 && tr <= 0) scheduleHoursTotal += vh
      timeTrackingHoursTotal += tr

      let used = 0
      let source: PayrollCombinedDaySource = 'none'
      const hasOpen = pack.openConflict

      if (!hasOpen) {
        if (sh <= 0 && tr <= 0) {
          used = 0
          source = 'none'
        } else if (sh <= 0 && tr > 0) {
          used = tr
          source = 'time_tracking_extra'
        } else if (tr <= 0 && sh > 0) {
          used = sh
          source = 'schedule_fallback'
        } else if (tr < sh) {
          used = sh
          source = 'schedule_fallback'
        } else if (tr > sh) {
          used = tr
          source = 'time_tracking'
        } else {
          used = tr
          source = 'time_tracking'
        }
      } else {
        used = Math.max(sh, tr)
        if (tr > sh) source = 'time_tracking'
        else if (sh > 0) source = 'schedule_fallback'
        else if (tr > 0) source = 'time_tracking_extra'
        else source = 'none'
      }

      if (!hasOpen && vh > 0) {
        if (sh <= 0 && tr <= 0) {
          used = vh
          source = vhVac > 0 ? 'paid_vacation' : 'paid_other_absence'
        } else {
          used = Math.max(used, vh)
        }
      }

      usedHoursTotal += used
      extraUnplannedHours += Math.max(0, Math.round((tr - sh) * 100) / 100)
      if (sh > 0 && tr <= 0 && !hasOpen) missingTimeEntriesDayCount += 1
      if (sh <= 0 && tr > 0) unplannedWorkDayCount += 1

      let note = ''
      let highlight: PayrollCombinedDetailHighlight = 'neutral'
      if (hasOpen) {
        note =
          'Offene laufende Zeiterfassung – bitte prüfen. Zuschläge an diesem Tag nicht automatisch ermittelt.'
        highlight = 'red'
      } else if (source === 'schedule_fallback' && tr <= 0 && sh > 0) {
        note = 'Keine Zeiterfassung vorhanden – Schichtplanzeit verwendet.'
        highlight = 'yellow'
      } else if (source === 'schedule_fallback' && tr > 0 && tr < sh) {
        const documented = pack.entries.some((e) => e.earlyLeaveDoc === 'documented')
        const missingDoc = pack.entries.some((e) => e.earlyLeaveDoc === 'missing')
        if (documented) {
          const parts: string[] = []
          for (const te of myEntries) {
            if (te.end_deviation_type !== 'early' || (te.end_deviation_minutes ?? 0) <= 30) continue
            if (!te.early_leave_reason) continue
            const m = te.end_deviation_minutes ?? 0
            const lab = earlyLeaveReasonLabelDe(String(te.early_leave_reason))
            const note = te.early_leave_note ? String(te.early_leave_note).trim() : ''
            parts.push(`${m} Min. früher – ${lab}${note ? ` (${note})` : ''}`)
          }
          note =
            parts.length > 0
              ? `Zeiterfassung kürzer als Schichtplan – Schichtplanzeit wird für den Lohn noch verwendet. Früheres Ende mit Grund: ${parts.join(' · ')} — bitte Plan- vs. Ist-Zeit manuell prüfen.`
              : 'Zeiterfassung kürzer als Schichtplan – Schichtplanzeit verwendet; früheres Ende mit dokumentiertem Grund.'
          highlight = 'orange'
        } else if (missingDoc) {
          note =
            'Zeiterfassung kürzer als Schichtplan – Schichtplanzeit verwendet. Früheres Ende ohne dokumentierten Grund (oder unvollständig) — Prüfen erforderlich.'
          highlight = 'red'
        } else {
          note = 'Zeiterfassung kürzer als Schichtplan – Schichtplanzeit verwendet.'
          highlight = 'yellow'
        }
      } else if (source === 'time_tracking_extra') {
        note = 'Zusätzliche Arbeit ohne geplante Schicht.'
        highlight = 'orange'
      } else if (source === 'time_tracking' && tr > sh) {
        const diffMin = Math.round((tr - sh) * 60)
        const h = Math.floor(diffMin / 60)
        const m = diffMin % 60
        note =
          m > 0
            ? `+${h > 0 ? `${h} Std. ` : ''}${m} Min. länger gearbeitet als geplant.`
            : `+${(tr - sh).toFixed(2).replace('.', ',')} Std. länger gearbeitet als geplant.`
        highlight = 'green'
      } else if (source === 'time_tracking' && tr === sh && sh > 0) {
        note = 'Zeiterfassung entspricht dem Schichtplan.'
        highlight = 'green'
      } else if (source === 'paid_vacation') {
        note = 'Bezahlter Urlaub (Abwesenheit).'
        highlight = 'neutral'
      } else if (source === 'paid_other_absence') {
        note = 'Bezahlte Abwesenheit (z. B. Krankheit, Sonderurlaub).'
        highlight = 'neutral'
      }

      if (!hasOpen && vhVac > 0 && tr > 0) {
        const warn =
          'Urlaub und Zeiterfassung am selben Tag – bitte prüfen (Lohn: je Kalendertag max. aus Arbeit oder Abwesenheit, keine Doppelzahlung).'
        note = note ? `${note} ${warn}` : warn
        if (highlight === 'neutral' || highlight === 'green') highlight = 'orange'
      }

      let daySup = 0
      if (!hasOpen) {
        if (source === 'schedule_fallback') {
          for (const s of myShifts) {
            if (!s.date || !s.startTime || !s.endTime) continue
            const { startIso, endIso } = shiftToIsoEndpoints(s.date, s.startTime, s.endTime)
            const m = netHoursByBerlinYmdInRange(startIso, endIso, s.breakMinutes ?? 0, fromDate, toDate)
            if (!m.has(ymd) || (m.get(ymd) ?? 0) <= 0) continue
            daySup += computeScheduleShiftSupplementEuros({
              emp: empFields,
              hourlyWage: Math.max(0, wageForSupplements),
              shiftDate: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              breakMinutes: s.breakMinutes ?? 0,
              federalState,
              holidayOverlay,
              onlyBerlinYmd: ymd,
            })
          }
        } else if (source === 'time_tracking' || source === 'time_tracking_extra') {
          for (const te of myEntries) {
            if (!te.start_at || !te.end_at) continue
            const m = netHoursByBerlinYmdInRange(te.start_at, te.end_at, te.break_minutes ?? 0, fromDate, toDate)
            if (!m.has(ymd) || (m.get(ymd) ?? 0) <= 0) continue
            daySup += computeSupplementEurosForTimeEntry({
              employmentType,
              emp: empFields,
              hourlyWage: Math.max(0, wageForSupplements),
              startIso: te.start_at,
              endIso: te.end_at,
              breakMinutes: te.break_minutes ?? 0,
              federalState,
              holidayOverlay,
              onlyBerlinYmd: ymd,
            })
          }
        }
      }

      daySup = Math.round(daySup * 100) / 100
      supplementsTotal += daySup

      const diffDay = Math.round((used - sh) * 100) / 100
      details.push({
        date: ymd,
        weekdayDe: weekdayDeLongEuropeBerlin(ymd),
        scheduleShifts: pack.shifts,
        scheduledHours: sh,
        plannedPaidVacationHours: vhVac,
        plannedOtherPaidAbsenceHours: vhOther,
        timeEntries: pack.entries,
        trackedHours: tr,
        usedHours: Math.round(used * 100) / 100,
        differenceHours: diffDay,
        source,
        note,
        highlight,
        daySupplementsEuro: daySup,
        hasConflict: hasOpen,
      })
    }

    scheduleHoursTotal = Math.round(scheduleHoursTotal * 100) / 100
    timeTrackingHoursTotal = Math.round(timeTrackingHoursTotal * 100) / 100
    usedHoursTotal = Math.round(usedHoursTotal * 100) / 100
    extraUnplannedHours = Math.round(extraUnplannedHours * 100) / 100
    supplementsTotal = Math.round(supplementsTotal * 100) / 100

    const differenceHours = Math.round((usedHoursTotal - scheduleHoursTotal) * 100) / 100

    const workByYmd = new Map<string, number>()
    for (const d of details) {
      if (d.usedHours > 0) workByYmd.set(d.date, (workByYmd.get(d.date) ?? 0) + d.usedHours)
    }

    const money = computePayrollMoneyBlock({
      db,
      R,
      employeeId,
      fromDate,
      toDate,
      federalState,
      absences,
      adjByEmployee,
      workHoursByBerlinYmd: workByYmd,
      supplementsTotal,
      totalWorkHoursForDisplay: usedHoursTotal,
    })

    const {
      basePay,
      vacationDays,
      paidVacationHours,
      paidOtherAbsenceHours,
      overtimeHours,
      hourlyWageDisplay: effDisplay,
      minimumWageNote,
      messages: moneyMessages,
      mankogeld,
      vl,
      cashDifference,
      bonus,
      advance,
      total,
    } = money

    const messages = [...moneyMessages]
    if (hasOpenRunningTimeEntries && myOpen.length) {
      messages.push('Hinweis: Mindestens eine offene Zeiterfassung (ohne Ende) im Zeitraum – bitte prüfen.')
    }

    const includeRow =
      usedHoursTotal > 0 ||
      paidVacationHours > 0 ||
      (paidOtherAbsenceHours ?? 0) > 0 ||
      vacationDays > 0 ||
      basePay > 0 ||
      supplementsTotal !== 0 ||
      mankogeld !== 0 ||
      vl !== 0 ||
      cashDifference !== 0 ||
      bonus !== 0 ||
      advance !== 0 ||
      scheduleHoursTotal > 0 ||
      timeTrackingHoursTotal > 0 ||
      details.some((d) => d.hasConflict)

    if (!includeRow) continue

    rows.push({
      employeeId,
      employeeName: emp.display_name,
      employmentType,
      hourlyWage: Math.round(effDisplay * 100) / 100,
      ...(!monthlyRecipient ? { registeredHourlyWage: Math.round(rawHourly * 100) / 100 } : {}),
      ...(minimumWageNote ? { minimumWageNote } : {}),
      scheduleHoursTotal,
      timeTrackingHoursTotal,
      usedHoursTotal,
      differenceHours,
      extraUnplannedHours,
      missingTimeEntriesDayCount,
      unplannedWorkDayCount,
      vacationDays,
      paidVacationHours,
      ...((paidOtherAbsenceHours ?? 0) > 0 ? { paidOtherAbsenceHours } : {}),
      overtimeHours,
      basePay,
      supplementsTotal,
      mankogeld,
      vl,
      cashDifference,
      bonus,
      advance,
      total,
      ...(messages.length ? { messages } : {}),
      details,
    })
  }

  const totals: PayrollCombinedTotals = rows.reduce(
    (acc, r) => ({
      scheduleHours: acc.scheduleHours + r.scheduleHoursTotal,
      timeTrackingHours: acc.timeTrackingHours + r.timeTrackingHoursTotal,
      usedHours: acc.usedHours + r.usedHoursTotal,
      differenceHours: acc.differenceHours + r.differenceHours,
      extraUnplannedHours: acc.extraUnplannedHours + r.extraUnplannedHours,
      missingTimeEntriesDayCount: acc.missingTimeEntriesDayCount + r.missingTimeEntriesDayCount,
      unplannedWorkDayCount: acc.unplannedWorkDayCount + r.unplannedWorkDayCount,
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
      scheduleHours: 0,
      timeTrackingHours: 0,
      usedHours: 0,
      differenceHours: 0,
      extraUnplannedHours: 0,
      missingTimeEntriesDayCount: 0,
      unplannedWorkDayCount: 0,
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

  ;(Object.keys(totals) as (keyof PayrollCombinedTotals)[]).forEach((key) => {
    totals[key] = Math.round(totals[key] * 100) / 100
  })

  return {
    stationId,
    stationName: station.name,
    federalState,
    fromDate,
    toDate,
    hasPendingApprovedTime,
    hasOpenRunningTimeEntries,
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
    const earlyMin = te.end_deviation_type === 'early' ? Number(te.end_deviation_minutes ?? 0) : 0
    let earlyLeaveSummary: string | undefined
    if (earlyMin > 30) {
      if (te.early_leave_reason) {
        const lab = earlyLeaveReasonLabelDe(String(te.early_leave_reason))
        const note = te.early_leave_note ? String(te.early_leave_note).trim() : ''
        earlyLeaveSummary = `${earlyMin} Min. früher – ${lab}${note ? ` — ${note}` : ''}`
      } else {
        earlyLeaveSummary = `${earlyMin} Min. früher — ohne dokumentierten Grund`
      }
    }
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
      ...(earlyLeaveSummary ? { earlyLeaveSummary } : {}),
    })
  }

  const station = db
    .prepare(`SELECT federal_state FROM stations WHERE id = ?`)
    .get(stationId) as { federal_state: string | null } | undefined
  const federalState = String(station?.federal_state ?? 'BW').toUpperCase() as GermanState
  const holidayOverlay = buildStationHolidayOverlay(db, stationId)

  const absences = db
    .prepare(`SELECT * FROM absences WHERE station_id = ? AND start_date <= ? AND end_date >= ?`)
    .all(stationId, toDate, fromDate) as AbsenceRow[]

  const entriesByEmp = new Map<string, TimeEntryRow[]>()
  for (const te of list) {
    const eid = String(te.employee_id ?? '').trim()
    if (!eid) continue
    const arr = entriesByEmp.get(eid) ?? []
    arr.push(te)
    entriesByEmp.set(eid, arr)
  }

  const empSet = new Set<string>()
  if (employeeId?.trim()) {
    empSet.add(employeeId.trim())
  } else {
    for (const k of entriesByEmp.keys()) empSet.add(k)
    const extra = db
      .prepare(
        `SELECT DISTINCT employee_id FROM absences WHERE station_id = ? AND start_date <= ? AND end_date >= ?`,
      )
      .all(stationId, toDate, fromDate) as { employee_id: string }[]
    for (const x of extra) {
      const id = String(x.employee_id ?? '').trim()
      if (id) empSet.add(id)
    }
  }

  const lineToSyntheticRow = (
    ln: PayrollScheduleDetailLine,
    eid: string,
    displayName: string,
  ): PayrollTimeEntryDetailRow => {
    const dash = '—'
    const sid =
      ln.lineSource === 'paid_vacation_auto'
        ? `paid_vacation_auto:${eid}:${ln.date}`
        : `absence_line:${eid}:${ln.date}:${ln.lineType}`
    const src = ln.lineSource ?? ln.lineType
    return {
      id: sid,
      employeeId: eid,
      employeeName: displayName,
      date: ln.date,
      startAt: dash,
      endAt: dash,
      breakMinutes: 0,
      hours: ln.hours,
      source: src,
      status: 'calculated',
      approvalStatus: '—',
      synthetic: true,
    }
  }

  const syntheticOut: PayrollTimeEntryDetailRow[] = []
  for (const eid of empSet) {
    const emp = db.prepare(`SELECT * FROM employees WHERE id = ? AND station_id = ?`).get(eid, stationId) as
      | (EmployeeRow & Record<string, unknown>)
      | undefined
    if (!emp) continue
    const R = emp as Record<string, unknown>
    const myT = entriesByEmp.get(eid) ?? []
    const lines = buildTimeTrackingPayrollDetailLines({
      employeeId: eid,
      fromDate,
      toDate,
      federalState,
      holidayOverlay,
      employmentType: String(emp.employment_type ?? ''),
      employmentRole: String(R.employment_role ?? ''),
      vacHpdDefault: rNum(R, 'vacation_hours_per_day', NaN) || null,
      absences,
      timeEntries: myT,
    })
    for (const ln of lines) {
      if (ln.lineSource === 'time_entry') continue
      syntheticOut.push(lineToSyntheticRow(ln, eid, emp.display_name))
    }
  }

  return [...out, ...syntheticOut].sort((a, b) => {
    const da = a.date.localeCompare(b.date)
    if (da !== 0) return da
    const ns = Number(Boolean(a.synthetic)) - Number(Boolean(b.synthetic))
    if (ns !== 0) return ns
    return a.startAt.localeCompare(b.startAt)
  })
}
