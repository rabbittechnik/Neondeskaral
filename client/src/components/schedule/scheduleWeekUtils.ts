/** Montag-basierte Woche (DE), ISO-Kalenderwoche. */

export function startOfWeekMonday(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

export function addWeeks(anchor: Date, weeks: number): Date {
  const d = new Date(anchor)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function formatDE(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** ISO 8601 Kalenderwoche (lokales Datum) */
export function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}

export const WEEKDAY_LABELS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export const WEEKDAY_LABELS_LONG = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const

/** z. B. 11.05. */
export function formatDayMonthDot(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}.${m}.`
}

export function weekDayDates(weekMonday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i))
}

/** Erster und letzter Kalendertag des Monats, zu dem `contained` gehört (lokales Datum). */
export function calendarMonthRangeForDate(contained: Date): { fromYmd: string; toYmd: string } {
  const y = contained.getFullYear()
  const m = contained.getMonth()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fromYmd = `${y}-${pad(m + 1)}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const toYmd = `${y}-${pad(m + 1)}-${pad(lastDay)}`
  return { fromYmd, toYmd }
}
