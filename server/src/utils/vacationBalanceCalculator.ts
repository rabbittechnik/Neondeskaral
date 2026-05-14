import { calculateAbsenceDaysInYear, type AbsenceCountMode } from './absenceYearCalculator.js'
import { isAbsenceStatusApprovedForPayrollDb } from './absencePayrollStatus.js'
import { normalizeAbsenceDbType } from './vacationImpactCalculator.js'
import { calculateVacationDaysForRequest } from './vacationRequestCalculator.js'

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

/** Für bezahlten Urlaub: Feiertagskorrektur wie bei calculateVacationDaysForRequest (Anteil pro Jahr). */
export type PaidVacationBalanceCtx = {
  employmentType: string
  employmentRole: string
  federalState: string
  vacationHoursPerDay: number | null | undefined
}

export function paidVacationDeductibleInCalendarYear(
  r: AbsenceBalanceRow,
  year: number,
  mode: AbsenceCountMode,
  workCodes: string[] | null,
  ctx: PaidVacationBalanceCtx,
): number {
  const t = normalizeAbsenceDbType(r.type)
  if (t !== 'paid_vacation') return 0
  const c = r.counts_against_vacation
  if (c === 0) return 0
  const halfDay = (r.half_day ?? 0) === 1
  const fullCalc = calculateVacationDaysForRequest({
    employmentType: ctx.employmentType,
    employmentRole: ctx.employmentRole,
    federalState: ctx.federalState,
    vacationHoursPerDay: ctx.vacationHoursPerDay,
    startDate: r.start_date,
    endDate: r.end_date,
    halfDay,
    absenceTypeRaw: 'paid_vacation',
  })
  const totalCal = fullCalc.calendarDays
  if (totalCal <= 0) return 0
  const gal = calculateAbsenceDaysInYear(
    { startDate: r.start_date, endDate: r.end_date, halfDay },
    year,
    mode,
    workCodes,
  )
  if (gal <= 0) return 0
  return Math.round(fullCalc.vacationDaysToDeduct * (gal / totalCal) * 100) / 100
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
  paidCtx?: PaidVacationBalanceCtx,
): number {
  let sum = 0
  for (const r of rows) {
    if (r.employee_id !== employeeId) continue
    if (excludeAbsenceId && r.id === excludeAbsenceId) continue
    if (!isAbsenceStatusApprovedForPayrollDb(r.status)) continue
    const t = normalizeAbsenceDbType(r.type)
    if (t !== 'paid_vacation') continue
    const c = r.counts_against_vacation
    if (c === 0) continue
    if (paidCtx) {
      sum += paidVacationDeductibleInCalendarYear(r, year, mode, workCodes, paidCtx)
    } else {
      sum += calculateAbsenceDaysInYear(
        { startDate: r.start_date, endDate: r.end_date, halfDay: (r.half_day ?? 0) === 1 },
        year,
        mode,
        workCodes,
      )
    }
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
  paidCtx?: PaidVacationBalanceCtx,
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
    if (paidCtx) {
      sum += paidVacationDeductibleInCalendarYear(r, year, mode, workCodes, paidCtx)
    } else {
      sum += calculateAbsenceDaysInYear(
        { startDate: r.start_date, endDate: r.end_date, halfDay: (r.half_day ?? 0) === 1 },
        year,
        mode,
        workCodes,
      )
    }
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
