import type { Absence, AbsenceStatus } from '../types/absence'

export function dateInInclusiveRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end
}

export type AbsenceDateFilterOptions = {
  /** Standard: genehmigt + beantragt (Kalender); nur genehmigt für Schichtplan-Hinweise */
  statuses?: AbsenceStatus[]
}

const DEFAULT_CALENDAR_STATUSES: AbsenceStatus[] = ['genehmigt', 'beantragt']

export function getAbsencesForDate(
  absences: Absence[],
  date: string,
  options?: AbsenceDateFilterOptions,
): Absence[] {
  const statuses = options?.statuses ?? DEFAULT_CALENDAR_STATUSES
  return absences.filter(
    (a) =>
      statuses.includes(a.status) &&
      dateInInclusiveRange(date, a.startDate, a.endDate),
  )
}

export function getAbsencesForEmployee(
  absences: Absence[],
  employeeId: string,
  date: string,
  options?: AbsenceDateFilterOptions,
): Absence[] {
  return getAbsencesForDate(absences, date, options).filter((a) => a.employeeId === employeeId)
}

/** Für Schichtplan / spätere Konflikte: nur genehmigte Abwesenheit an diesem Tag */
export function employeeHasAbsenceOnDate(
  absences: Absence[],
  employeeId: string,
  date: string,
): boolean {
  return getAbsencesForDate(absences, date, { statuses: ['genehmigt'] }).some(
    (a) => a.employeeId === employeeId,
  )
}

export function countAbsenceDays(startDate: string, endDate: string, halfDay: boolean): number {
  if (startDate === endDate && halfDay) return 0.5
  const s = new Date(`${startDate}T12:00:00`)
  const e = new Date(`${endDate}T12:00:00`)
  const diffDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  return Math.max(0, diffDays)
}
