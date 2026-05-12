import type { Database } from 'better-sqlite3'
import { calculateAbsenceDaysInYear, type AbsenceCountMode, workDayCodesFromEmployeeRow } from '../utils/absenceYearCalculator.js'

type EmployeeRow = {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  status: string | null
  active: number | null
  end_date: string | null
  annual_vacation_days: number | null
  work_days_json: string | null
}

type AbsenceRow = {
  employee_id: string
  type: string
  start_date: string
  end_date: string
  half_day: number | null
  status: string
}

export type AbsenceSummaryCohort = 'active' | 'exited_year'

export type AbsenceSummaryRow = {
  employeeId: string
  employeeName: string
  annualVacationDays: number
  vacationTakenDays: number
  remainingVacationDays: number
  sickDays: number
  active: boolean
  vacationNotMaintained: boolean
}

export type AbsenceSummaryTotals = {
  annualVacationDays: number
  vacationTakenDays: number
  remainingVacationDays: number
  sickDays: number
}

export type AbsenceSummaryPayload = {
  year: number
  stationId: string
  cohort: AbsenceSummaryCohort
  countMode: AbsenceCountMode
  rows: AbsenceSummaryRow[]
  totals: AbsenceSummaryTotals
}

function displayNameFromRow(r: EmployeeRow): string {
  const d = (r.display_name ?? '').trim()
  if (d) return d
  const fn = (r.first_name ?? '').trim()
  const ln = (r.last_name ?? '').trim()
  const c = [fn, ln].filter(Boolean).join(' ')
  return c || r.id
}

function isActiveRow(r: EmployeeRow): boolean {
  const a = r.active ?? 1
  const st = (r.status ?? 'active').toLowerCase()
  return a === 1 && st !== 'inactive'
}

function loadEmployees(db: Database, stationId: string, year: number, cohort: AbsenceSummaryCohort): EmployeeRow[] {
  const yStart = `${year}-01-01`
  const yEnd = `${year}-12-31`
  if (cohort === 'exited_year') {
    return db
      .prepare(
        `SELECT id, display_name, first_name, last_name, status, active, end_date, annual_vacation_days, work_days_json
         FROM employees
         WHERE station_id = ?
           AND end_date IS NOT NULL AND TRIM(end_date) != ''
           AND end_date >= ? AND end_date <= ?
         ORDER BY display_name COLLATE NOCASE`,
      )
      .all(stationId, yStart, yEnd) as EmployeeRow[]
  }
  return db
    .prepare(
      `SELECT id, display_name, first_name, last_name, status, active, end_date, annual_vacation_days, work_days_json
       FROM employees
       WHERE station_id = ?
         AND (COALESCE(active, 1) = 1)
         AND (status IS NULL OR LOWER(status) NOT IN ('inactive'))
       ORDER BY display_name COLLATE NOCASE`,
    )
    .all(stationId) as EmployeeRow[]
}

function loadAbsencesOverlappingYear(db: Database, stationId: string, year: number): AbsenceRow[] {
  const yStart = `${year}-01-01`
  const yEnd = `${year}-12-31`
  return db
    .prepare(
      `SELECT employee_id, type, start_date, end_date, half_day, status
       FROM absences
       WHERE station_id = ?
         AND end_date >= ? AND start_date <= ?`,
    )
    .all(stationId, yStart, yEnd) as AbsenceRow[]
}

function sumVacationTakenForEmployee(
  rows: AbsenceRow[],
  employeeId: string,
  year: number,
  mode: AbsenceCountMode,
  workCodes: string[] | null,
): number {
  let sum = 0
  for (const r of rows) {
    if (r.employee_id !== employeeId) continue
    if (r.type !== 'vacation') continue
    if (r.status !== 'approved') continue
    sum += calculateAbsenceDaysInYear(
      { startDate: r.start_date, endDate: r.end_date, halfDay: (r.half_day ?? 0) === 1 },
      year,
      mode,
      workCodes,
    )
  }
  return Math.round(sum * 100) / 100
}

function sumSickForEmployee(
  rows: AbsenceRow[],
  employeeId: string,
  year: number,
  mode: AbsenceCountMode,
  workCodes: string[] | null,
): number {
  let sum = 0
  for (const r of rows) {
    if (r.employee_id !== employeeId) continue
    if (r.type !== 'sick') continue
    if (r.status !== 'approved' && r.status !== 'recorded') continue
    sum += calculateAbsenceDaysInYear(
      { startDate: r.start_date, endDate: r.end_date, halfDay: (r.half_day ?? 0) === 1 },
      year,
      mode,
      workCodes,
    )
  }
  return Math.round(sum * 100) / 100
}

export function buildAbsenceYearSummary(
  db: Database,
  p: { stationId: string; year: number; cohort: AbsenceSummaryCohort; countMode?: AbsenceCountMode },
): AbsenceSummaryPayload {
  const mode: AbsenceCountMode = p.countMode ?? 'calendar_days'
  const employees = loadEmployees(db, p.stationId, p.year, p.cohort)
  const absRows = loadAbsencesOverlappingYear(db, p.stationId, p.year)

  const rows: AbsenceSummaryRow[] = employees.map((emp) => {
    const workCodes = workDayCodesFromEmployeeRow(emp.work_days_json)
    const annualRaw = emp.annual_vacation_days
    const vacationNotMaintained = annualRaw === null || annualRaw === undefined
    const annualVacationDays = vacationNotMaintained ? 0 : Number(annualRaw) || 0
    const vacationTakenDays = sumVacationTakenForEmployee(absRows, emp.id, p.year, mode, workCodes)
    const remainingVacationDays = Math.round((annualVacationDays - vacationTakenDays) * 100) / 100
    const sickDays = sumSickForEmployee(absRows, emp.id, p.year, mode, workCodes)
    return {
      employeeId: emp.id,
      employeeName: displayNameFromRow(emp),
      annualVacationDays,
      vacationTakenDays,
      remainingVacationDays,
      sickDays,
      active: isActiveRow(emp),
      vacationNotMaintained,
    }
  })

  const totals: AbsenceSummaryTotals = rows.reduce(
    (acc, r) => ({
      annualVacationDays: Math.round((acc.annualVacationDays + r.annualVacationDays) * 100) / 100,
      vacationTakenDays: Math.round((acc.vacationTakenDays + r.vacationTakenDays) * 100) / 100,
      remainingVacationDays: Math.round((acc.remainingVacationDays + r.remainingVacationDays) * 100) / 100,
      sickDays: Math.round((acc.sickDays + r.sickDays) * 100) / 100,
    }),
    { annualVacationDays: 0, vacationTakenDays: 0, remainingVacationDays: 0, sickDays: 0 },
  )

  return {
    year: p.year,
    stationId: p.stationId,
    cohort: p.cohort,
    countMode: mode,
    rows,
    totals,
  }
}
