import type { GermanState } from '../data/germanHolidays'
import type { Absence, AbsenceStatus } from '../types/absence'
import type { EmploymentType } from '../types/employee'
import { netPlannedHoursForShift, type ScheduleShift } from '../data/mockSchedule'
import { getRelevantHolidayForState } from './holidayUtils'

/** Genutzt für Wochen-/Monatskarten (Schichtplan, Dashboard). */
export type EmployeePlannedHoursBreakdown = {
  employeeId: string
  employeeName: string
  rangeStart: string
  rangeEnd: string
  /** Geplante Schichtstunden ohne Doppelzählung mit bezahltem Urlaub (Urlaubstag ersetzt Schicht). */
  plannedShiftHours: number
  paidVacationDays: number
  paidVacationHours: number
  /** Nur Info / Debug: genehmigte/erfasste unbezahlte Urlaubstage im Intervall */
  unpaidVacationDays: number
  /** Tage, an denen bezahlter Urlaub wegen Feiertagslogik keine Urlaubsstunden erzeugt (Festangestellte o. ä.). */
  holidayExcludedDays: number
  /** Tage mit bezahltem Urlaub (Stunden > 0) und gleichzeitig geplanter Schicht. */
  shiftDaysWithPaidVacationConflict: number
  totalHours: number
}

export type EmployeePlannedHoursMeta = {
  displayName: string
  employmentType: EmploymentType
}

const STATUSES_WITH_HOUR_CREDIT: AbsenceStatus[] = ['genehmigt', 'erfasst']

function approvedForHourCredit(status: AbsenceStatus): boolean {
  return STATUSES_WITH_HOUR_CREDIT.includes(status)
}

function maxYmd(a: string, b: string): string {
  return a > b ? a : b
}

function minYmd(a: string, b: string): string {
  return a < b ? a : b
}

function enumerateDatesInclusive(fromYmd: string, toYmd: string): string[] {
  const out: string[] = []
  const d = new Date(`${fromYmd}T12:00:00`)
  const end = new Date(`${toYmd}T12:00:00`)
  while (d <= end) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${day}`)
    d.setDate(d.getDate() + 1)
  }
  return out
}

/**
 * Minijob / Aushilfe: Feiertage im Urlaubszeitraum reduzieren die Urlaubsstunden nicht (bestehende Sonderlogik).
 * Alle übrigen Anstellungsarten: gesetzlicher Feiertag im Bundesland zählt nicht als bezahlter Urlaubstag-Stunden.
 */
function excludePublicHolidayFromPaidVacationCredits(employmentType: EmploymentType): boolean {
  return employmentType !== 'minijob' && employmentType !== 'aushilfe'
}

function defaultFullDayVacationHours(a: Absence): number {
  if (a.paidHoursPerDay != null && a.paidHoursPerDay > 0) return a.paidHoursPerDay
  return 8
}

function vacationHoursForCalendarDay(a: Absence, ymd: string): number {
  const full = defaultFullDayVacationHours(a)
  if (a.startDate === a.endDate && a.halfDay) return full / 2
  if (a.halfDay && ymd === a.startDate) return full / 2
  return full
}

function countUnpaidVacationDaysInRange(a: Absence, rangeStart: string, rangeEnd: string): number {
  if (a.type !== 'unpaid_vacation') return 0
  if (!approvedForHourCredit(a.status)) return 0
  const start = maxYmd(a.startDate, rangeStart)
  const end = minYmd(a.endDate, rangeEnd)
  if (start > end) return 0
  if (start === end && a.halfDay) return 0.5
  return enumerateDatesInclusive(start, end).length
}

function logDebugIfEnabled(row: Record<string, string | number>) {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem('debugPlannedHours') !== '1') return
  // eslint-disable-next-line no-console
  console.debug('[plannedHours]', row)
}

/**
 * Geplante Nettostunden inkl. bezahltem Urlaub für ein Intervall [rangeStart, rangeEnd].
 * Bezahlter Urlaub ersetzt Schicht am selben Tag (keine Doppelzählung).
 */
export function calculateEmployeePlannedHours(
  employeeId: string,
  shifts: ScheduleShift[],
  absences: Absence[],
  employeesById: Map<string, EmployeePlannedHoursMeta>,
  rangeStart: string,
  rangeEnd: string,
  federalState: GermanState,
): EmployeePlannedHoursBreakdown {
  const meta = employeesById.get(employeeId)
  const employmentType: EmploymentType = meta?.employmentType ?? 'sonstige'
  const employeeName = meta?.displayName ?? employeeId

  const shiftByDay = new Map<string, number>()
  for (const s of shifts) {
    if (s.employeeId !== employeeId) continue
    if (!s.employeeId) continue
    if (s.shiftType === 'frei') continue
    if (s.date < rangeStart || s.date > rangeEnd) continue
    const h = netPlannedHoursForShift(s)
    if (h <= 0) continue
    shiftByDay.set(s.date, (shiftByDay.get(s.date) ?? 0) + h)
  }

  const vacationByDay = new Map<string, number>()
  const holidayExcludedDates = new Set<string>()

  for (const a of absences) {
    if (a.employeeId !== employeeId) continue
    if (a.type !== 'paid_vacation') continue
    if (!approvedForHourCredit(a.status)) continue
    if (a.paid === false) continue

    const start = maxYmd(a.startDate, rangeStart)
    const end = minYmd(a.endDate, rangeEnd)
    if (start > end) continue

    const dayCap = defaultFullDayVacationHours(a)

    for (const d of enumerateDatesInclusive(start, end)) {
      let hrs = vacationHoursForCalendarDay(a, d)

      if (excludePublicHolidayFromPaidVacationCredits(employmentType)) {
        if (getRelevantHolidayForState(d, federalState).hasHoliday) {
          holidayExcludedDates.add(d)
          continue
        }
      }

      const prev = vacationByDay.get(d) ?? 0
      vacationByDay.set(d, Math.min(dayCap, prev + hrs))
    }
  }

  let unpaidVacationDays = 0
  for (const a of absences) {
    if (a.employeeId !== employeeId) continue
    unpaidVacationDays += countUnpaidVacationDaysInRange(a, rangeStart, rangeEnd)
  }

  const daysInRange = enumerateDatesInclusive(rangeStart, rangeEnd)
  let rawPaidVacation = 0
  let rawPlannedShift = 0
  let shiftDaysWithPaidVacationConflict = 0

  for (const d of daysInRange) {
    const s = shiftByDay.get(d) ?? 0
    const v = vacationByDay.get(d) ?? 0
    if (v > 0 && s > 0) shiftDaysWithPaidVacationConflict += 1
    if (v > 0) {
      rawPaidVacation += v
    } else {
      rawPlannedShift += s
    }
  }

  const plannedShiftHours = Math.round(rawPlannedShift * 10) / 10
  const paidVacationHours = Math.round(rawPaidVacation * 10) / 10
  const totalHours = Math.round((rawPlannedShift + rawPaidVacation) * 10) / 10
  const paidVacationDays = paidVacationHours > 0 ? Math.round((paidVacationHours / 8) * 100) / 100 : 0

  const row = {
    employeeName,
    rangeStart,
    rangeEnd,
    plannedShiftHours,
    paidVacationDays,
    paidVacationHours,
    unpaidVacationDays,
    holidayExcludedDays: holidayExcludedDates.size,
    totalHours,
  }
  logDebugIfEnabled(row)

  return {
    employeeId,
    employeeName,
    rangeStart,
    rangeEnd,
    plannedShiftHours,
    paidVacationDays,
    paidVacationHours,
    unpaidVacationDays,
    holidayExcludedDays: holidayExcludedDates.size,
    shiftDaysWithPaidVacationConflict,
    totalHours,
  }
}

export function buildEmployeePlannedHoursMap(
  employeeIds: string[],
  shifts: ScheduleShift[],
  absences: Absence[],
  employeesById: Map<string, EmployeePlannedHoursMeta>,
  rangeStart: string,
  rangeEnd: string,
  federalState: GermanState,
): Map<string, EmployeePlannedHoursBreakdown> {
  const map = new Map<string, EmployeePlannedHoursBreakdown>()
  for (const id of employeeIds) {
    map.set(
      id,
      calculateEmployeePlannedHours(id, shifts, absences, employeesById, rangeStart, rangeEnd, federalState),
    )
  }
  return map
}
