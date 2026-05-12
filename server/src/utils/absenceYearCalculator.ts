/**
 * Kalender- bzw. später Arbeitstage-Anteil einer Abwesenheit innerhalb eines Jahres.
 * Vorbereitet für Umstellung countMode → work_days (employees.work_days_json).
 */

export type AbsenceCountMode = 'calendar_days' | 'work_days'

export type AbsenceDateRange = {
  startDate: string
  endDate: string
  halfDay: boolean
}

function parseYmdUtc(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  return new Date(Date.UTC(y, mo, d))
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b
}

/** ISO-Wochentag: mo, di, … (wie work_days_json) */
function weekdayCodeUtc(d: Date): string {
  const map = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'] as const
  return map[d.getUTCDay()]
}

function parseWorkDaysJson(raw: string | null | undefined): string[] | null {
  if (!raw || !String(raw).trim()) return null
  try {
    const arr = JSON.parse(String(raw)) as unknown
    if (!Array.isArray(arr)) return null
    return arr.map((x) => String(x).toLowerCase().trim()).filter(Boolean)
  } catch {
    return null
  }
}

function countDaysInRangeInclusive(start: Date, end: Date, workDayCodes: string[] | null, mode: AbsenceCountMode): number {
  if (end.getTime() < start.getTime()) return 0
  if (mode === 'calendar_days') {
    const ms = 86400000
    return Math.floor((end.getTime() - start.getTime()) / ms) + 1
  }
  const codes = workDayCodes?.length ? workDayCodes : ['mo', 'di', 'mi', 'do', 'fr']
  const set = new Set(codes)
  let n = 0
  for (let cur = new Date(start.getTime()); cur.getTime() <= end.getTime(); cur = addUtcDays(cur, 1)) {
    if (set.has(weekdayCodeUtc(cur))) n += 1
  }
  return n
}

/**
 * Zählt, wie viele Tage (Kalender oder Arbeit) einer Abwesenheit in das angegebene Jahr fallen.
 * @param workDayCodes optional Codes aus employees.work_days_json; nur bei mode work_days relevant
 */
export function calculateAbsenceDaysInYear(
  absence: AbsenceDateRange,
  year: number,
  mode: AbsenceCountMode = 'calendar_days',
  workDayCodes?: string[] | null,
): number {
  const yStart = parseYmdUtc(`${year}-01-01`)
  const yEnd = parseYmdUtc(`${year}-12-31`)
  const absStart = parseYmdUtc(absence.startDate)
  const absEnd = parseYmdUtc(absence.endDate)
  if (!yStart || !yEnd || !absStart || !absEnd) return 0
  if (absEnd.getTime() < absStart.getTime()) return 0
  const overlapStart = maxDate(absStart, yStart)
  const overlapEnd = minDate(absEnd, yEnd)
  if (overlapEnd.getTime() < overlapStart.getTime()) return 0

  const codes = workDayCodes ?? null
  const days = countDaysInRangeInclusive(overlapStart, overlapEnd, codes, mode)
  if (days <= 0) return 0

  /** Halbtag-Erkennung anhand des gesamten Abwesenheitszeitraums (Kalendertage). */
  const absSpanCalendar = countDaysInRangeInclusive(absStart, absEnd, null, 'calendar_days')
  if (absence.halfDay && absSpanCalendar === 1) return 0.5
  if (absence.halfDay && absSpanCalendar > 1) return Math.max(0.5, days - 0.5)
  return days
}

export { parseWorkDaysJson }

/** Hilfsfunktion für spätere Arbeitstage-Logik aus DB-Rohstring */
export function workDayCodesFromEmployeeRow(workDaysJson: string | null | undefined): string[] | null {
  return parseWorkDaysJson(workDaysJson)
}
