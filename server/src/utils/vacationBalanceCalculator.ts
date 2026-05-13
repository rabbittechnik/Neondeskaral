import { calculateAbsenceDaysInYear, type AbsenceCountMode } from './absenceYearCalculator.js'
import { normalizeAbsenceDbType } from './vacationImpactCalculator.js'

export type AbsenceBalanceRow = {
  id: string
  employee_id: string
  type: string
  start_date: string
  end_date: string
  half_day: number | null
  status: string
  counts_against_vacation?: number | null
}

export function calendarYearFromStartDate(startDate: string): number {
  const y = Number(String(startDate).slice(0, 4))
  return Number.isFinite(y) ? y : new Date().getFullYear()
}

/** Genehmigter bezahlter Urlaub im Jahr (Urlaubsanspruch). */
export function sumApprovedPaidVacationDaysInYear(
  rows: AbsenceBalanceRow[],
  employeeId: string,
  year: number,
  mode: AbsenceCountMode,
  workCodes: string[] | null,
  excludeAbsenceId?: string,
): number {
  let sum = 0
  for (const r of rows) {
    if (r.employee_id !== employeeId) continue
    if (excludeAbsenceId && r.id === excludeAbsenceId) continue
    if (r.status !== 'approved') continue
    const t = normalizeAbsenceDbType(r.type)
    if (t !== 'paid_vacation') continue
    const c = r.counts_against_vacation
    if (c === 0) continue
    sum += calculateAbsenceDaysInYear(
      { startDate: r.start_date, endDate: r.end_date, halfDay: (r.half_day ?? 0) === 1 },
      year,
      mode,
      workCodes,
    )
  }
  return Math.round(sum * 100) / 100
}

/** Ausstehende bezahlte Urlaubsanträge im Jahr (optional für Hinweise). */
export function sumPendingPaidVacationDaysInYear(
  rows: AbsenceBalanceRow[],
  employeeId: string,
  year: number,
  mode: AbsenceCountMode,
  workCodes: string[] | null,
  excludeAbsenceId?: string,
): number {
  let sum = 0
  for (const r of rows) {
    if (r.employee_id !== employeeId) continue
    if (excludeAbsenceId && r.id === excludeAbsenceId) continue
    if (r.status !== 'requested') continue
    const t = normalizeAbsenceDbType(r.type)
    if (t !== 'paid_vacation') continue
    const c = r.counts_against_vacation
    if (c === 0) continue
    sum += calculateAbsenceDaysInYear(
      { startDate: r.start_date, endDate: r.end_date, halfDay: (r.half_day ?? 0) === 1 },
      year,
      mode,
      workCodes,
    )
  }
  return Math.round(sum * 100) / 100
}

export function paidVacationDaysOfAbsenceInYear(
  startDate: string,
  endDate: string,
  halfDay: boolean,
  year: number,
  mode: AbsenceCountMode,
  workCodes: string[] | null,
): number {
  return (
    Math.round(
      calculateAbsenceDaysInYear({ startDate, endDate, halfDay }, year, mode, workCodes) * 100,
    ) / 100
  )
}
