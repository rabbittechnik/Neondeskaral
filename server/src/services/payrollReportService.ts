import type { Database } from 'better-sqlite3'
import type { GermanState } from '../data/germanHolidays2026.js'
import { todayIso } from '../utils/timestamps.js'
import type { AbsenceRow } from './absenceService.js'
import type { EmployeeRow } from './employeeService.js'
import type { TimeEntryRow } from './timeTrackingService.js'
import {
  computeSupplementEurosForTimeEntry,
  computeScheduleShiftSupplementEuros,
  computeScheduleShiftSupplementBreakdown,
  computeTimeEntrySupplementBreakdown,
  buildPayrollDaySupplementAudit,
  isGermanPublicHolidayYmd,
  publicHolidayNameDe,
  type EmployeeSurchargeFields,
  type PayrollDaySupplementAudit,
  type PayrollSupplementLineDebug,
  type ScheduleShiftSurchargeDebug,
} from './payrollSurchargeService.js'
import { buildStationHolidayOverlay } from './stationExtraHolidayService.js'
import { loadStationPayrollSurchargeRules } from './stationPayrollSurchargeRulesService.js'
import type { StationPayrollSurchargeRules } from '../types/stationPayrollSurchargeRules.js'
import type { StationHolidayOverlay } from '../types/stationHolidayOverlay.js'
import { employmentTypeSubjectToStatutoryMinimum, getEffectiveHourlyRate } from './statutoryMinWageService.js'
import { listShifts } from './shiftService.js'
import {
  eachYmdInRangeInclusive,
  hoursToMinutes,
  minutesToHours2,
  netHoursByBerlinYmdInRange,
  netMinutesByBerlinYmdFromUtc,
  shiftMinutesByBerlinYmd,
  shiftNetMinutesFromPlan,
  berlinYmdFromMs,
} from '../utils/berlinCalendarWorkHours.js'
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
import { preloadMinimumWageRates } from './minimumWageCache.js'
import {
  effectiveTimeBounds,
  loadLatestCorrectionsMapForIds,
  timeCorrectionReasonLabelDe,
  type TimeEntryCorrectionRow,
} from './timeEntryCorrectionService.js'

function effectiveTimeEntryForPayroll(te: TimeEntryRow, corrMap: Map<string, TimeEntryCorrectionRow>) {
  const eff = effectiveTimeBounds(te, corrMap.get(te.id))
  return { start_at: eff.startAt, end_at: eff.endAt ?? te.end_at, break_minutes: eff.breakMinutes }
}

/** Freigegebene Ist-Minuten pro Kalendertag (ohne Urlaub). */
export function resolvePayrollWorkUsedMinutes(
  shMin: number,
  trMin: number,
  hasOpen: boolean,
): { usedMin: number; source: PayrollCombinedDaySource } {
  if (hasOpen) {
    if (shMin > 0) return { usedMin: shMin, source: 'schedule_fallback' }
    if (trMin > 0) return { usedMin: trMin, source: 'time_tracking_extra' }
    return { usedMin: 0, source: 'none' }
  }
  if (shMin <= 0 && trMin <= 0) return { usedMin: 0, source: 'none' }
  if (shMin <= 0 && trMin > 0) return { usedMin: trMin, source: 'time_tracking_extra' }
  if (trMin <= 0 && shMin > 0) return { usedMin: shMin, source: 'schedule_fallback' }
  return { usedMin: trMin, source: 'time_tracking' }
}

function minHm(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null
  if (!b) return a
  return a <= b ? a : b
}

function maxHm(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null
  if (!b) return a
  return a >= b ? a : b
}

function mergeDayHmRanges(
  ranges: { start: string; end: string }[],
): { start: string | null; end: string | null } {
  let start: string | null = null
  let end: string | null = null
  for (const r of ranges) {
    start = minHm(start, r.start)
    end = maxHm(end, r.end)
  }
  return { start, end }
}

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

export type PayrollCombinedShiftDetail = {
  id: string
  label: string
  hours: number
  plannedStart: string
  plannedEnd: string
}

export type PayrollCombinedTimeDetail = {
  id: string
  startAt: string
  endAt: string | null
  hours: number
  open: boolean
  startTime?: string
  endTime?: string
  approvalStatus?: string
  pendingApproval?: boolean
  earlyLeaveReason?: string
  earlyLeaveNote?: string
  earlyLeaveMinutes?: number
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
  scheduledMinutes: number
  trackedMinutes: number
  usedMinutes: number
  plannedPaidVacationMinutes: number
  plannedOtherPaidAbsenceMinutes: number
  plannedStart?: string | null
  plannedEnd?: string | null
  actualStart?: string | null
  actualEnd?: string | null
  usedStart?: string | null
  usedEnd?: string | null
  deviationReason?: string | null
  isPublicHoliday?: boolean
  holidayNameDe?: string
  /** Zuschlags-Debug: Aufschlüsselung je Tag (Vergleich Originalsystem). */
  supplementDebug?: PayrollDaySupplementAudit
}

export type { PayrollDaySupplementAudit } from './payrollSurchargeService.js'

export type PayrollEmployeeRangeAudit = {
  detailUsedMinutes: number
  summaryUsedMinutes: number
  detailScheduleMinutes: number
  summaryScheduleMinutes: number
  deviationUsedMinutes: number
  deviationScheduleMinutes: number
  hints: string[]
}

export type PayrollEmployeeRangeDetail = {
  stationId: string
  stationName: string
  federalState: GermanState
  fromDate: string
  toDate: string
  hasPendingApprovedTime: boolean
  hasOpenRunningTimeEntries: boolean
  employee: PayrollCombinedRow
  audit: PayrollEmployeeRangeAudit
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
  /** Original-Stempel, falls eine Korrektur für die Abrechnung gilt. */
  stampedStartAt?: string
  stampedEndAt?: string
  timeCorrectionNote?: string
}

export function calculatePayrollTimeTrackingReport(
  db: Database,
  opts: {
    stationId: string
    fromDate: string
    toDate: string
    employmentFilter?: string
    employeeIds?: string
    /** Detailzeilen pro Mitarbeiter (langsam) – Standard: false */
    includeDetailLines?: boolean
  },
): PayrollTimeTrackingReport {
  const includeDetailLines = opts.includeDetailLines === true
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
  const stationSurchargeRules = loadStationPayrollSurchargeRules(db, stationId)
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

  const entryCorrMap = loadLatestCorrectionsMapForIds(db, approvedEntries.map((e) => e.id))

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
      const t = effectiveTimeEntryForPayroll(te, entryCorrMap)
      if (!t.start_at || !t.end_at) continue
      const h = entryNetHoursInRange(t.start_at, t.end_at, t.break_minutes ?? 0, fromDate, toDate)
      totalHours += h
      supplementsTotal += computeSupplementEurosForTimeEntry({
        employmentType,
        emp: surchargeFieldsFromEmployee(R),
        hourlyWage: Math.max(0, wageForSupplements),
        startIso: t.start_at,
        endIso: t.end_at,
        breakMinutes: t.break_minutes ?? 0,
        federalState,
        holidayOverlay,
        stationRules: stationSurchargeRules,
      })
    }
    totalHours = Math.round(totalHours * 100) / 100
    supplementsTotal = Math.round(supplementsTotal * 100) / 100

    const workByYmd = new Map<string, number>()
    for (const te of myEntries) {
      const t = effectiveTimeEntryForPayroll(te, entryCorrMap)
      if (!t.start_at || !t.end_at) continue
      const m = netHoursByBerlinYmdInRange(t.start_at, t.end_at, t.break_minutes ?? 0, fromDate, toDate)
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

    const timeTrackingDetailLines = includeDetailLines
      ? buildTimeTrackingPayrollDetailLines({
          db,
          employeeId,
          fromDate,
          toDate,
          federalState,
          holidayOverlay,
          employmentType,
          employmentRole: String(R.employment_role ?? ''),
          vacHpdDefault: rNum(R, 'vacation_hours_per_day', NaN) || null,
          absences,
          timeEntries: myEntries,
        })
      : undefined

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
    employeeIds?: string
    includeDetailLines?: boolean
  },
): PayrollTimeTrackingReport {
  const includeDetailLines = opts.includeDetailLines === true
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
  const stationSurchargeRules = loadStationPayrollSurchargeRules(db, stationId)
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
        stationRules: stationSurchargeRules,
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
      const netMin = shiftNetMinutesFromPlan(s.date, s.startTime, s.endTime, s.breakMinutes ?? 0)
      if (netMin <= 0) continue
      const hx = minutesToHours2(netMin)
      workByYmd.set(s.date, (workByYmd.get(s.date) ?? 0) + hx)
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

    const scheduleLines = includeDetailLines
      ? buildSchedulePayrollDetailLines({
          employeeId,
          fromDate,
          toDate,
          federalState,
          holidayOverlay,
          employmentType,
          employmentRole: String(R.employment_role ?? ''),
          vacHpdDefault: rNum(R, 'vacation_hours_per_day', NaN) || null,
          myShifts,
          absences,
          workAreaNameById,
        })
      : undefined

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

function mergeSupplementLines(batches: PayrollSupplementLineDebug[][]): PayrollSupplementLineDebug[] {
  const map = new Map<string, PayrollSupplementLineDebug>()
  for (const lines of batches) {
    for (const l of lines) {
      const key = `${l.kind}:${l.percent}`
      const ex = map.get(key)
      if (ex) {
        ex.hours = Math.round((ex.hours + l.hours) * 100) / 100
        ex.amountEuro = Math.round((ex.amountEuro + l.amountEuro) * 100) / 100
      } else {
        map.set(key, { ...l })
      }
    }
  }
  return [...map.values()]
}

function computeDaySupplementSides(p: {
  ymd: string
  myShifts: Array<{ date?: string; startTime?: string; endTime?: string; breakMinutes?: number }>
  myEntries: TimeEntryRow[]
  entryCorrMap: Map<string, TimeEntryCorrectionRow>
  empFields: EmployeeSurchargeFields
  employmentType: string
  wageForSupplements: number
  federalState: GermanState
  holidayOverlay: StationHolidayOverlay
  stationRules: StationPayrollSurchargeRules
  fromDate: string
  toDate: string
}): {
  scheduleTotalEuro: number
  scheduleLines: PayrollSupplementLineDebug[]
  timeTrackingTotalEuro: number
  timeTrackingLines: PayrollSupplementLineDebug[]
} {
  const wage = Math.max(0, p.wageForSupplements)
  const schedBatches: PayrollSupplementLineDebug[][] = []
  let scheduleTotalEuro = 0

  for (const s of p.myShifts) {
    if (!s.date || !s.startTime || !s.endTime) continue
    const { startIso, endIso } = shiftToIsoEndpoints(s.date, s.startTime, s.endTime)
    const m = netHoursByBerlinYmdInRange(startIso, endIso, s.breakMinutes ?? 0, p.fromDate, p.toDate)
    if (!m.has(p.ymd) || (m.get(p.ymd) ?? 0) <= 0) continue
    const br = computeScheduleShiftSupplementBreakdown({
      emp: p.empFields,
      hourlyWage: wage,
      shiftDate: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: s.breakMinutes ?? 0,
      federalState: p.federalState,
      holidayOverlay: p.holidayOverlay,
      stationRules: p.stationRules,
      onlyBerlinYmd: p.ymd,
    })
    scheduleTotalEuro += br.totalEuro
    schedBatches.push(br.lines)
  }

  const timeBatches: PayrollSupplementLineDebug[][] = []
  let timeTrackingTotalEuro = 0
  for (const te of p.myEntries) {
    const t = effectiveTimeEntryForPayroll(te, p.entryCorrMap)
    if (!t.start_at || !t.end_at) continue
    const m = netHoursByBerlinYmdInRange(t.start_at, t.end_at, t.break_minutes ?? 0, p.fromDate, p.toDate)
    if (!m.has(p.ymd) || (m.get(p.ymd) ?? 0) <= 0) continue
    const br = computeTimeEntrySupplementBreakdown({
      employmentType: p.employmentType,
      emp: p.empFields,
      hourlyWage: wage,
      startIso: t.start_at,
      endIso: t.end_at,
      breakMinutes: t.break_minutes ?? 0,
      federalState: p.federalState,
      holidayOverlay: p.holidayOverlay,
      stationRules: p.stationRules,
      onlyBerlinYmd: p.ymd,
    })
    timeTrackingTotalEuro += br.totalEuro
    timeBatches.push(br.lines)
  }

  return {
    scheduleTotalEuro: Math.round(scheduleTotalEuro * 100) / 100,
    scheduleLines: mergeSupplementLines(schedBatches),
    timeTrackingTotalEuro: Math.round(timeTrackingTotalEuro * 100) / 100,
    timeTrackingLines: mergeSupplementLines(timeBatches),
  }
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
  db: Database
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
  const corrMap = loadLatestCorrectionsMapForIds(p.db, p.timeEntries.map((t) => t.id))

  for (const te of p.timeEntries) {
    if (te.employee_id !== p.employeeId) continue
    if (te.status !== 'completed' || String(te.approval_status ?? '').trim() !== 'approved') continue
    const t = effectiveTimeEntryForPayroll(te, corrMap)
    if (!t.start_at || !t.end_at) continue
    const m = netHoursByBerlinYmdInRange(t.start_at, t.end_at, t.break_minutes ?? 0, p.fromDate, p.toDate)
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
      const corrRow = corrMap.get(te.id)
      if (corrRow?.correction_kind === 'manual') {
        hinweis += ` · Abrechnung mit korrigierter Zeit (${timeCorrectionReasonLabelDe(corrRow.reason)})`
      } else if (corrRow?.correction_kind === 'auto_clock_out') {
        hinweis += ' · Automatisch ausgestempelt (Sicherheitsregel) — bitte prüfen'
      }
      if (ymKeys.length === 1) {
        const sMs = new Date(t.start_at).getTime()
        const eMs = new Date(t.end_at).getTime()
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
 * Lohnabrechnung **Zusammenfassung**: pro Kalendertag (Europe/Berlin) freigegebene Stempelzeit wenn vorhanden,
 * sonst Schichtplan; Plan/Ist/verwendet bleiben in den Details nachvollziehbar.
 */
export function calculatePayrollCombinedReport(
  db: Database,
  opts: {
    stationId: string
    fromDate: string
    toDate: string
    employmentFilter?: string
    employeeIds?: string
    /** Tagesdetails + Supplement-Debug (langsam). Übersicht: false */
    includeDetails?: boolean
  },
): PayrollCombinedReport {
  const stationId = opts.stationId.trim()
  const fromDate = opts.fromDate.trim()
  const toDate = opts.toDate.trim()
  const employmentFilter = parseEmploymentFilter(opts.employmentFilter)
  const employeeIdFilter = parseEmployeeIdFilter(opts.employeeIds)
  const includeDetails = opts.includeDetails === true
  const includeSupplementDebug = process.env.PAYROLL_SUPPLEMENT_DEBUG === '1'
  const perfLog = process.env.PAYROLL_PERF_LOG !== '0'

  if (!stationId) throw new Error('stationId erforderlich')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) throw new Error('from/to als YYYY-MM-DD')
  if (fromDate > toDate) throw new Error('from darf nicht nach to liegen')

  preloadMinimumWageRates(db)
  if (perfLog) console.time('[Payroll] load employees')
  const station = db.prepare(`SELECT name, federal_state FROM stations WHERE id = ?`).get(stationId) as
    | { name: string; federal_state: string | null }
    | undefined
  if (!station) throw new Error('Station nicht gefunden')

  const federalState = String(station.federal_state ?? 'BW').toUpperCase() as GermanState
  if (perfLog) console.time('[Payroll] load holidays')
  const holidayOverlay = buildStationHolidayOverlay(db, stationId)
  if (perfLog) console.timeEnd('[Payroll] load holidays')
  const stationSurchargeRules = loadStationPayrollSurchargeRules(db, stationId)
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
  if (perfLog) console.timeEnd('[Payroll] load employees')

  if (perfLog) console.time('[Payroll] load time entries')
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

  const pendingCompletedEntries = db
    .prepare(
      `SELECT te.* FROM time_entries te
       WHERE te.station_id = ?
         AND te.status = 'completed'
         AND (te.approval_status IS NULL OR trim(te.approval_status) = '' OR te.approval_status NOT IN ('approved', 'rejected'))
         AND te.end_at IS NOT NULL AND trim(te.end_at) != ''
         AND date(te.start_at) <= date(?)
         AND date(te.end_at) >= date(?)`,
    )
    .all(stationId, toDate, fromDate) as TimeEntryRow[]

  const entryCorrMap = loadLatestCorrectionsMapForIds(
    db,
    [...approvedEntries, ...pendingCompletedEntries].map((e) => e.id),
  )

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
  if (perfLog) console.timeEnd('[Payroll] load time entries')

  if (perfLog) console.time('[Payroll] load shifts')
  const shiftList = listShifts(db, { stationId, from: fromDate, to: toDate }).filter(
    (s) =>
      Boolean(s.employeeId) &&
      String(s.shiftType ?? '')
        .toLowerCase()
        .trim() !== 'frei',
  )
  if (perfLog) console.timeEnd('[Payroll] load shifts')

  if (perfLog) console.time('[Payroll] load absences')
  const absences = db
    .prepare(
      `SELECT * FROM absences WHERE station_id = ?
       AND start_date <= ? AND end_date >= ?`,
    )
    .all(stationId, toDate, fromDate) as AbsenceRow[]
  if (perfLog) console.timeEnd('[Payroll] load absences')

  if (perfLog) console.time('[Payroll] load wages')
  const adjustments = db
    .prepare(
      `SELECT employee_id, type, amount FROM payroll_adjustments
       WHERE station_id = ? AND date >= ? AND date <= ?`,
    )
    .all(stationId, fromDate, toDate) as { employee_id: string; type: string; amount: number }[]

  const adjByEmployee = accumulatePayrollAdjustments(adjustments)
  mergeChecklistCashIntoBuckets(db, stationId, fromDate, toDate, adjByEmployee)
  if (perfLog) console.timeEnd('[Payroll] load wages')

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

  const pendingByEmployee = new Map<string, TimeEntryRow[]>()
  for (const te of pendingCompletedEntries) {
    const list = pendingByEmployee.get(te.employee_id) ?? []
    list.push(te)
    pendingByEmployee.set(te.employee_id, list)
  }

  const openByEmployee = new Map<string, TimeEntryRow[]>()
  for (const te of openRunning) {
    const list = openByEmployee.get(te.employee_id) ?? []
    list.push(te)
    openByEmployee.set(te.employee_id, list)
  }

  type YmdPack = {
    shMinutes: number
    trMinutes: number
    shifts: PayrollCombinedShiftDetail[]
    entries: PayrollCombinedTimeDetail[]
    openConflict: boolean
  }

  const rows: PayrollCombinedRow[] = []

  if (perfLog) console.time('[Payroll] calculate')
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
    const myPendingEntries = pendingByEmployee.get(employeeId) ?? []
    const myOpen = openByEmployee.get(employeeId) ?? []

    const byYmd = new Map<string, YmdPack>()
    const ensurePack = (ymd: string): YmdPack => {
      const p = byYmd.get(ymd) ?? { shMinutes: 0, trMinutes: 0, shifts: [], entries: [], openConflict: false }
      byYmd.set(ymd, p)
      return p
    }

    for (const s of myShifts) {
      if (!s.date || !s.startTime || !s.endTime) continue
      if (s.date < fromDate || s.date > toDate) continue
      const m = shiftMinutesByBerlinYmd(s.date, s.startTime, s.endTime, s.breakMinutes ?? 0, fromDate, toDate)
      const plannedStart = String(s.startTime).slice(0, 5)
      const plannedEnd = String(s.endTime).slice(0, 5)
      const label = `${plannedStart}–${plannedEnd}`
      for (const [ymd, netMin] of m) {
        if (netMin <= 0) continue
        const p = ensurePack(ymd)
        p.shMinutes += netMin
        p.shifts.push({ id: s.id, label, hours: minutesToHours2(netMin), plannedStart, plannedEnd })
      }
    }

    const pushTimeEntryDetail = (
      te: TimeEntryRow,
      ymd: string,
      netMin: number,
      t: { start_at: string; end_at: string | null; break_minutes: number },
      opts: { open: boolean; pendingApproval: boolean },
    ) => {
      const p = ensurePack(ymd)
      const startTime = t.start_at ? formatTimeHmBerlin(new Date(t.start_at).getTime()) : undefined
      const endTime =
        t.end_at && !opts.open ? formatTimeHmBerlin(new Date(t.end_at).getTime()) : undefined
      const earlyMin = te.end_deviation_type === 'early' ? Number(te.end_deviation_minutes ?? 0) : 0
      if (!p.entries.some((e) => e.id === te.id && e.open === opts.open)) {
        p.entries.push({
          id: te.id,
          startAt: t.start_at,
          endAt: t.end_at,
          hours: minutesToHours2(netMin),
          open: opts.open,
          startTime,
          endTime,
          approvalStatus: opts.pendingApproval
            ? 'pending'
            : String(te.approval_status ?? 'approved'),
          pendingApproval: opts.pendingApproval,
          earlyLeaveReason: te.early_leave_reason ? String(te.early_leave_reason) : undefined,
          earlyLeaveNote: te.early_leave_note ? String(te.early_leave_note) : undefined,
          earlyLeaveMinutes: earlyMin > 0 ? earlyMin : undefined,
          earlyLeaveDoc:
            !opts.pendingApproval &&
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

    for (const te of myEntries) {
      const t = effectiveTimeEntryForPayroll(te, entryCorrMap)
      if (!t.start_at || !t.end_at) continue
      const m = netMinutesByBerlinYmdFromUtc(
        new Date(t.start_at).getTime(),
        new Date(t.end_at).getTime(),
        t.break_minutes ?? 0,
        fromDate,
        toDate,
      )
      for (const [ymd, netMin] of m) {
        if (netMin <= 0) continue
        const p = ensurePack(ymd)
        p.trMinutes += netMin
        pushTimeEntryDetail(te, ymd, netMin, t, { open: false, pendingApproval: false })
      }
    }

    for (const te of myPendingEntries) {
      const t = effectiveTimeEntryForPayroll(te, entryCorrMap)
      if (!t.start_at || !t.end_at) continue
      const m = netMinutesByBerlinYmdFromUtc(
        new Date(t.start_at).getTime(),
        new Date(t.end_at).getTime(),
        t.break_minutes ?? 0,
        fromDate,
        toDate,
      )
      for (const [ymd, netMin] of m) {
        if (netMin <= 0) continue
        pushTimeEntryDetail(te, ymd, netMin, t, { open: false, pendingApproval: true })
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
        pushTimeEntryDetail(
          te,
          ymd,
          0,
          { start_at: te.start_at, end_at: null, break_minutes: te.break_minutes ?? 0 },
          { open: true, pendingApproval: false },
        )
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
    const workByYmd = new Map<string, number>()
    let employeeHasOpenConflict = false
    let supplementsTotal = 0
    let scheduleMinutesTotal = 0
    let timeTrackingMinutesTotal = 0
    let usedMinutesTotal = 0
    let missingTimeEntriesDayCount = 0
    let unplannedWorkDayCount = 0
    let extraUnplannedMinutes = 0

    if (!includeDetails) {
      for (const s of myShifts) {
        if (!s.date || !s.startTime || !s.endTime) continue
        if (s.date < fromDate || s.date > toDate) continue
        supplementsTotal += computeScheduleShiftSupplementEuros({
          emp: empFields,
          hourlyWage: Math.max(0, wageForSupplements),
          shiftDate: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          breakMinutes: s.breakMinutes ?? 0,
          federalState,
          holidayOverlay,
          stationRules: stationSurchargeRules,
        })
      }
      supplementsTotal = Math.round(supplementsTotal * 100) / 100
    }

    const sortedYmd = [...new Set([...byYmd.keys(), ...vacByYmdAll.keys()])].sort()
    for (const ymd of sortedYmd) {
      const pack = ensurePack(ymd)
      const shMin = pack.shMinutes
      const trMin = pack.trMinutes
      const sh = minutesToHours2(shMin)
      const tr = minutesToHours2(trMin)
      const vhVac = Math.round((vacByYmd.get(ymd) ?? 0) * 100) / 100
      const vhOther = Math.round((otherPaidByYmdCombined.get(ymd) ?? 0) * 100) / 100
      const vh = Math.round((vacByYmdAll.get(ymd) ?? 0) * 100) / 100
      const vhVacMin = hoursToMinutes(vhVac)
      const vhOtherMin = hoursToMinutes(vhOther)
      const vhMin = hoursToMinutes(vh)
      scheduleMinutesTotal += shMin
      if (vhMin > 0 && shMin <= 0 && trMin <= 0) scheduleMinutesTotal += vhMin
      timeTrackingMinutesTotal += trMin

      const hasOpen = pack.openConflict
      const hasPendingOnly =
        !hasOpen &&
        trMin <= 0 &&
        pack.entries.some((e) => e.pendingApproval && !e.open)

      let { usedMin, source } = resolvePayrollWorkUsedMinutes(shMin, trMin, hasOpen)

      if (!hasOpen && vhMin > 0) {
        if (shMin <= 0 && trMin <= 0) {
          usedMin = vhMin
          source = vhVacMin > 0 ? 'paid_vacation' : 'paid_other_absence'
        } else {
          usedMin = Math.max(usedMin, vhMin)
        }
      }

      const plannedRange = mergeDayHmRanges(
        pack.shifts.map((s) => ({ start: s.plannedStart, end: s.plannedEnd })),
      )
      const approvedEntryRanges = pack.entries
        .filter((e) => !e.open && !e.pendingApproval && e.startTime && e.endTime)
        .map((e) => ({ start: e.startTime!, end: e.endTime! }))
      const actualRange = mergeDayHmRanges(approvedEntryRanges)
      const plannedStart = plannedRange.start
      const plannedEnd = plannedRange.end
      const actualStart = actualRange.start
      const actualEnd = actualRange.end
      const usedStart = trMin > 0 && !hasOpen ? actualStart : plannedStart
      const usedEnd = trMin > 0 && !hasOpen ? actualEnd : plannedEnd

      let deviationReason: string | null = null
      for (const e of pack.entries) {
        if (e.open || e.pendingApproval || !e.earlyLeaveReason) continue
        if ((e.earlyLeaveMinutes ?? 0) <= 30) continue
        const lab = earlyLeaveReasonLabelDe(e.earlyLeaveReason)
        const extra = e.earlyLeaveNote ? ` (${e.earlyLeaveNote.trim()})` : ''
        deviationReason = `Früher beendet – Grund: ${lab}${extra}`
        break
      }

      usedMinutesTotal += usedMin
      const usedH = minutesToHours2(usedMin)
      if (usedH > 0) workByYmd.set(ymd, usedH)
      if (hasOpen) employeeHasOpenConflict = true
      extraUnplannedMinutes += Math.max(0, trMin - shMin)
      if (shMin > 0 && trMin <= 0 && !hasOpen && !hasPendingOnly) missingTimeEntriesDayCount += 1
      if (shMin <= 0 && trMin > 0) unplannedWorkDayCount += 1

      let note = ''
      let highlight: PayrollCombinedDetailHighlight = 'neutral'
      if (hasOpen) {
        note =
          'Offene laufende Zeiterfassung – bitte prüfen. Zuschläge an diesem Tag nicht automatisch ermittelt.'
        highlight = 'red'
      } else if (hasPendingOnly) {
        note =
          'Zeiterfassung vorhanden, aber noch nicht freigegeben – für die Abrechnung wird vorerst der Schichtplan verwendet.'
        highlight = 'orange'
      } else if (source === 'schedule_fallback' && tr <= 0 && sh > 0) {
        note = 'Keine freigegebene Zeiterfassung – Schichtplanzeit verwendet.'
        highlight = 'yellow'
      } else if (source === 'time_tracking' && tr > 0 && tr < sh) {
        const documented = pack.entries.some((e) => e.earlyLeaveDoc === 'documented')
        const missingDoc = pack.entries.some((e) => e.earlyLeaveDoc === 'missing')
        if (deviationReason) {
          note = `${deviationReason} — Istzeit für Lohn verwendet (${actualStart ?? '—'}–${actualEnd ?? '—'}).`
          highlight = documented ? 'orange' : 'red'
        } else if (missingDoc) {
          note = `Zeiterfassung kürzer als Schichtplan – Istzeit verwendet. Früheres Ende ohne dokumentierten Grund — Prüfen erforderlich.`
          highlight = 'red'
        } else {
          note = 'Zeiterfassung kürzer als Schichtplan – Istzeit für Lohn verwendet.'
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
      if (!hasOpen && includeDetails) {
        const useScheduleSupplements = trMin <= 0 && shMin > 0

        if (useScheduleSupplements) {
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
              stationRules: stationSurchargeRules,
              onlyBerlinYmd: ymd,
            })
          }
        } else if (source === 'time_tracking' || source === 'time_tracking_extra') {
          for (const te of myEntries) {
            const t = effectiveTimeEntryForPayroll(te, entryCorrMap)
            if (!t.start_at || !t.end_at) continue
            const m = netHoursByBerlinYmdInRange(t.start_at, t.end_at, t.break_minutes ?? 0, fromDate, toDate)
            if (!m.has(ymd) || (m.get(ymd) ?? 0) <= 0) continue
            daySup += computeSupplementEurosForTimeEntry({
              employmentType,
              emp: empFields,
              hourlyWage: Math.max(0, wageForSupplements),
              startIso: t.start_at,
              endIso: t.end_at,
              breakMinutes: t.break_minutes ?? 0,
              federalState,
              holidayOverlay,
              stationRules: stationSurchargeRules,
              onlyBerlinYmd: ymd,
            })
          }
        }
      }

      daySup = Math.round(daySup * 100) / 100
      supplementsTotal += daySup

      const diffDay = minutesToHours2(usedMin - shMin)
      const isHol = isGermanPublicHolidayYmd(ymd, federalState, holidayOverlay)

      const appliedBasis: 'schedule' | 'time_tracking' | 'none' = hasOpen
        ? 'none'
        : trMin > 0
          ? 'time_tracking'
          : source === 'schedule_fallback' && shMin > 0
            ? 'schedule'
            : 'none'

      let supplementDebug: PayrollDaySupplementAudit | undefined
      if (includeDetails) {
        if (includeSupplementDebug) {
          const sides = computeDaySupplementSides({
            ymd,
            myShifts,
            myEntries,
            entryCorrMap,
            empFields,
            employmentType,
            wageForSupplements,
            federalState,
            holidayOverlay,
            stationRules: stationSurchargeRules,
            fromDate,
            toDate,
          })
          supplementDebug = buildPayrollDaySupplementAudit({
            date: ymd,
            weekdayDe: weekdayDeLongEuropeBerlin(ymd),
            workHoursUsed: minutesToHours2(usedMin),
            vacationHours: vh,
            hourlyWage: Math.max(0, wageForSupplements),
            appliedBasis,
            scheduleLines: sides.scheduleLines,
            timeTrackingLines: sides.timeTrackingLines,
            scheduleTotalEuro: sides.scheduleTotalEuro,
            timeTrackingTotalEuro: sides.timeTrackingTotalEuro,
            federalState,
            holidayOverlay,
          })
          if (supplementDebug.dayTotalEuro > 0) {
            console.info('[PAYROLL_SUPPLEMENT_DEBUG]', JSON.stringify(supplementDebug))
          }
        }

        details.push({
        date: ymd,
        weekdayDe: weekdayDeLongEuropeBerlin(ymd),
        scheduleShifts: pack.shifts,
        scheduledHours: sh,
        plannedPaidVacationHours: vhVac,
        plannedOtherPaidAbsenceHours: vhOther,
        timeEntries: pack.entries,
        trackedHours: tr,
        usedHours: minutesToHours2(usedMin),
        differenceHours: diffDay,
        source,
        note,
        highlight,
        daySupplementsEuro: daySup,
        hasConflict: hasOpen,
        scheduledMinutes: shMin,
        trackedMinutes: trMin,
        usedMinutes: usedMin,
        plannedPaidVacationMinutes: vhVacMin,
        plannedOtherPaidAbsenceMinutes: vhOtherMin,
        plannedStart,
        plannedEnd,
        actualStart,
        actualEnd,
        usedStart,
        usedEnd,
        deviationReason,
        isPublicHoliday: isHol,
        holidayNameDe: isHol ? publicHolidayNameDe(ymd, federalState, holidayOverlay) : undefined,
        ...(supplementDebug ? { supplementDebug } : {}),
        })
      }
    }

    const scheduleHoursTotal = minutesToHours2(scheduleMinutesTotal)
    const timeTrackingHoursTotal = minutesToHours2(timeTrackingMinutesTotal)
    const usedHoursTotal = minutesToHours2(usedMinutesTotal)
    const extraUnplannedHours = minutesToHours2(extraUnplannedMinutes)
    supplementsTotal = Math.round(supplementsTotal * 100) / 100

    const differenceHours = minutesToHours2(usedMinutesTotal - scheduleMinutesTotal)

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
      employeeHasOpenConflict

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
      details: includeDetails ? details : [],
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

  if (perfLog) {
    console.timeEnd('[Payroll] calculate')
    console.info(
      '[Payroll] counts',
      JSON.stringify({
        stationId,
        from: fromDate,
        to: toDate,
        employeeCount: filteredEmployees.length,
        shiftCount: shiftList.length,
        timeEntryCount: approvedEntries.length + pendingCompletedEntries.length,
        absenceCount: absences.length,
        daysCount: eachYmdInRangeInclusive(fromDate, toDate).length,
        resultRowsCount: rows.length,
        includeDetails,
      }),
    )
  }

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

/**
 * Zentrale Detailauswertung für einen Mitarbeiter (gleiche Logik wie Lohnabrechnung Zusammenfassung).
 */
export function calculatePayrollForEmployeeRange(
  db: Database,
  opts: {
    stationId: string
    employeeId: string
    fromDate: string
    toDate: string
  },
): PayrollEmployeeRangeDetail | null {
  const report = calculatePayrollCombinedReport(db, {
    stationId: opts.stationId,
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    employmentFilter: 'all_with_exited',
    employeeIds: opts.employeeId,
    includeDetails: true,
  })
  const employee = report.rows.find((r) => r.employeeId === opts.employeeId) ?? null
  if (!employee) return null

  const detailUsedMinutes = employee.details.reduce((s, d) => s + d.usedMinutes, 0)
  const detailScheduleMinutes = employee.details.reduce((s, d) => {
    let m = d.scheduledMinutes
    const vacMin = d.plannedPaidVacationMinutes + d.plannedOtherPaidAbsenceMinutes
    if (vacMin > 0 && m <= 0 && d.trackedMinutes <= 0) m += vacMin
    return s + m
  }, 0)
  const summaryUsedMinutes = hoursToMinutes(employee.usedHoursTotal)
  const summaryScheduleMinutes = hoursToMinutes(employee.scheduleHoursTotal)

  const hints: string[] = []
  const deviationUsedMinutes = detailUsedMinutes - summaryUsedMinutes
  const deviationScheduleMinutes = detailScheduleMinutes - summaryScheduleMinutes
  if (deviationUsedMinutes !== 0) {
    hints.push(
      `Summe Tagesdetails (verwendet): ${minutesToHours2(detailUsedMinutes)} Std. · Kopfzeile: ${employee.usedHoursTotal.toFixed(2).replace('.', ',')} Std. · Abweichung: ${deviationUsedMinutes > 0 ? '+' : ''}${minutesToHours2(deviationUsedMinutes)} Std.`,
    )
  } else {
    hints.push(`Summe verwendete Stunden aus Tagesdetails: ${minutesToHours2(detailUsedMinutes)} Std. (stimmt mit Kopfzeile überein).`)
  }
  if (deviationScheduleMinutes !== 0) {
    hints.push(
      `Summe Plan/Urlaub aus Tagesdetails: ${minutesToHours2(detailScheduleMinutes)} Std. · Kopfzeile Plan: ${employee.scheduleHoursTotal.toFixed(2).replace('.', ',')} Std. · Abweichung: ${deviationScheduleMinutes > 0 ? '+' : ''}${minutesToHours2(deviationScheduleMinutes)} Std.`,
    )
  } else {
    hints.push(`Summe Planstunden (inkl. reiner Urlaubstage): ${minutesToHours2(detailScheduleMinutes)} Std.`)
  }
  if (report.hasPendingApprovedTime) {
    hints.push('Hinweis: Es gibt abgeschlossene, aber noch nicht freigegebene Zeiten – diese fließen nicht in „verwendet“ ein.')
  }
  if (report.hasOpenRunningTimeEntries) {
    hints.push('Hinweis: Offene Zeiterfassungen ohne Ende im Zeitraum.')
  }
  hints.push('Berechnung: Minuten-genau aus Start/Ende minus Pause; Anzeige mit 2 Nachkommastellen.')

  for (const d of employee.details) {
    const vacMin = d.plannedPaidVacationMinutes + d.plannedOtherPaidAbsenceMinutes
    let expectedMin = 0
    if (d.trackedMinutes > 0) expectedMin = d.trackedMinutes
    else if (d.scheduledMinutes > 0) expectedMin = d.scheduledMinutes
    if (vacMin > 0 && d.scheduledMinutes <= 0 && d.trackedMinutes <= 0) expectedMin = vacMin
    else if (vacMin > 0) expectedMin = Math.max(expectedMin, vacMin)
    if (expectedMin > 0 && Math.abs(d.usedMinutes - expectedMin) > 1) {
      hints.push(`${d.date}: verwendete Minuten (${d.usedMinutes}) weichen von der erwarteten Regel ab – prüfen.`)
    }
  }

  return {
    stationId: report.stationId,
    stationName: report.stationName,
    federalState: report.federalState,
    fromDate: report.fromDate,
    toDate: report.toDate,
    hasPendingApprovedTime: report.hasPendingApprovedTime,
    hasOpenRunningTimeEntries: report.hasOpenRunningTimeEntries,
    employee,
    audit: {
      detailUsedMinutes,
      summaryUsedMinutes,
      detailScheduleMinutes,
      summaryScheduleMinutes,
      deviationUsedMinutes,
      deviationScheduleMinutes,
      hints,
    },
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
  const detailCorrMap = loadLatestCorrectionsMapForIds(db, list.map((r) => r.id))
  const out: PayrollTimeEntryDetailRow[] = []
  for (const te of list) {
    if (!te.end_at) continue
    const eff = effectiveTimeEntryForPayroll(te, detailCorrMap)
    if (!eff.end_at) continue
    const h = entryNetHoursInRange(eff.start_at, eff.end_at, eff.break_minutes ?? 0, fromDate, toDate)
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
    const corrRow = detailCorrMap.get(te.id)
    let timeCorrectionNote: string | undefined
    let stampedStartAt: string | undefined
    let stampedEndAt: string | undefined
    if (corrRow) {
      stampedStartAt = te.start_at
      stampedEndAt = te.end_at ?? undefined
      if (corrRow.correction_kind === 'manual') {
        timeCorrectionNote = `Korrigiert: ${timeCorrectionReasonLabelDe(corrRow.reason)}`
      } else if (corrRow.correction_kind === 'auto_clock_out') {
        timeCorrectionNote = 'Automatisch ausgestempelt — bitte prüfen'
      }
    }
    out.push({
      id: te.id,
      employeeId: te.employee_id,
      employeeName: String(te.employee_display_name ?? '').trim() || te.employee_id,
      date: eff.start_at.slice(0, 10),
      startAt: eff.start_at,
      endAt: eff.end_at,
      breakMinutes: eff.break_minutes ?? 0,
      hours: h,
      source: te.source ?? '',
      status: te.status ?? '',
      approvalStatus: approval,
      ...(earlyLeaveSummary ? { earlyLeaveSummary } : {}),
      ...(corrRow ? { stampedStartAt, stampedEndAt, timeCorrectionNote } : {}),
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

  const employeeRows =
    empSet.size > 0
      ? (db
          .prepare(
            `SELECT * FROM employees WHERE station_id = ? AND id IN (${[...empSet].map(() => '?').join(',')})`,
          )
          .all(stationId, ...empSet) as (EmployeeRow & Record<string, unknown>)[])
      : []
  const empById = new Map(employeeRows.map((e) => [e.id, e]))

  const syntheticOut: PayrollTimeEntryDetailRow[] = []
  for (const eid of empSet) {
    const emp = empById.get(eid)
    if (!emp) continue
    const R = emp as Record<string, unknown>
    const myT = entriesByEmp.get(eid) ?? []
    const lines = buildTimeTrackingPayrollDetailLines({
      db,
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
