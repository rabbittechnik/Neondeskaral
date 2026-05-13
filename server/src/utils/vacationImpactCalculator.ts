/**
 * Zentrale Logik: bezahlter vs. unbezahlter Urlaub, Stunden, Urlaubsanspruch.
 */

export type AbsenceDbType =
  | 'paid_vacation'
  | 'unpaid_vacation'
  | 'day_off'
  | 'sick'
  | 'special_leave'
  | 'child_sick'
  | 'other'
  | 'school'

const LEGACY_DB_TYPES = new Set(['vacation', 'unpaid'])

/** Kalendertage der Abwesenheit (wie Mitarbeiter-App countAbsenceDays). */
export function countAbsenceSpanDaysCalendar(startDate: string, endDate: string, halfDay: boolean): number {
  if (!startDate || !endDate || endDate < startDate) return 0
  if (startDate === endDate && halfDay) return 0.5
  const s = new Date(`${startDate}T12:00:00`)
  const e = new Date(`${endDate}T12:00:00`)
  const diffDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  return Math.max(0, diffDays)
}

export function normalizeAbsenceDbType(raw: string): AbsenceDbType {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  const map: Record<string, AbsenceDbType> = {
    paid_vacation: 'paid_vacation',
    vacation: 'paid_vacation',
    urlaub: 'paid_vacation',
    unpaid_vacation: 'unpaid_vacation',
    unpaid: 'unpaid_vacation',
    unbezahlt: 'unpaid_vacation',
    day_off: 'day_off',
    frei: 'day_off',
    sick: 'sick',
    krankheit: 'sick',
    special_leave: 'special_leave',
    sonderurlaub: 'special_leave',
    child_sick: 'child_sick',
    kind_krank: 'child_sick',
    other: 'other',
    sonstiges: 'other',
    school: 'school',
    berufsschule: 'school',
  }
  return map[s] ?? 'other'
}

export function defaultPaidHoursPerDayFromEmployee(vacationHoursPerDay: number | null | undefined): number {
  const n = Number(vacationHoursPerDay)
  if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100
  return 8
}

export type VacationImpactResult = {
  absenceDays: number
  paidHoursPerDay: number
  paidHoursTotal: number
  countsAgainstVacation: boolean
  paid: boolean
  affectsRemainingVacation: boolean
}

export function calculateVacationImpact(
  absence: {
    type: string
    startDate: string
    endDate: string
    halfDay: boolean
    paidHoursPerDay?: number | null
  },
  employee: { vacation_hours_per_day?: number | null | undefined },
): VacationImpactResult {
  const t = normalizeAbsenceDbType(absence.type)
  const absenceDays = countAbsenceSpanDaysCalendar(absence.startDate, absence.endDate, absence.halfDay)

  const round2 = (x: number) => Math.round(x * 100) / 100

  if (t === 'paid_vacation') {
    const phpd = defaultPaidHoursPerDayFromEmployee(employee?.vacation_hours_per_day as number | null | undefined)
    const paidHoursTotal = round2(absenceDays * phpd)
    return {
      absenceDays: round2(absenceDays),
      paidHoursPerDay: phpd,
      paidHoursTotal,
      countsAgainstVacation: true,
      paid: true,
      affectsRemainingVacation: true,
    }
  }

  if (t === 'unpaid_vacation') {
    return {
      absenceDays: round2(absenceDays),
      paidHoursPerDay: 0,
      paidHoursTotal: 0,
      countsAgainstVacation: false,
      paid: false,
      affectsRemainingVacation: false,
    }
  }

  // sick, day_off, special_leave, child_sick, other, school
  return {
    absenceDays: round2(absenceDays),
    paidHoursPerDay: 0,
    paidHoursTotal: 0,
    countsAgainstVacation: false,
    paid: false,
    affectsRemainingVacation: false,
  }
}

export function isLegacyDbTypeForMigration(t: string): boolean {
  return LEGACY_DB_TYPES.has(String(t).trim().toLowerCase())
}
