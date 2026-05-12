/**
 * Deutsche Datums- und Zeitdarstellung (Mitarbeiter-App & gemeinsame Nutzung).
 * Eingaben: ISO-Datum YYYY-MM-DD und/oder ISO-Zeitstempel bzw. Uhrzeit HH:mm.
 */

const WEEKDAY_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const
const WEEKDAY_SHORT = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'] as const

function parseYmd(ymd: string): Date | null {
  const s = String(ymd ?? '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null
  return dt
}

function parseAnyDate(input: string | Date): Date | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  const s = String(input ?? '').trim()
  if (!s) return null
  const ymd = parseYmd(s.slice(0, 10))
  if (ymd) return ymd
  const t = Date.parse(s)
  if (Number.isNaN(t)) return null
  return new Date(t)
}

/** TT.MM.JJJJ */
export function formatDateDE(date: string | Date): string {
  const d = parseAnyDate(date)
  if (!d) return typeof date === 'string' && date ? date : '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

/** HH:mm Uhr (aus ISO-Datetime oder reiner Uhrzeit HH:mm) */
export function formatTimeDE(time: string | Date): string {
  if (time instanceof Date) {
    const hh = String(time.getHours()).padStart(2, '0')
    const mm = String(time.getMinutes()).padStart(2, '0')
    return `${hh}:${mm} Uhr`
  }
  const s = String(time ?? '').trim()
  if (!s) return '—'
  const hm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s)
  if (hm) {
    const h = String(Math.min(23, Math.max(0, parseInt(hm[1], 10)))).padStart(2, '0')
    const m = String(Math.min(59, Math.max(0, parseInt(hm[2], 10)))).padStart(2, '0')
    return `${h}:${m} Uhr`
  }
  const d = parseAnyDate(s)
  if (!d) return s
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm} Uhr`
}

/** TT.MM.JJJJ, HH:mm Uhr */
export function formatDateTimeDE(date: string | Date): string {
  const d = parseAnyDate(date)
  if (!d) return typeof date === 'string' && date ? date : '—'
  return `${formatDateDE(d)}, ${formatTimeDE(d)}`
}

/** Dienstag, 12.05.2026 */
export function formatWeekdayDateDE(date: string | Date): string {
  const d = parseAnyDate(date)
  if (!d) return typeof date === 'string' && date ? date : '—'
  const long = WEEKDAY_LONG[d.getDay()]
  return `${long}, ${formatDateDE(d)}`
}

/** Di., 12.05. */
export function formatWeekdayShortDateDE(date: string | Date): string {
  const d = parseAnyDate(date)
  if (!d) return typeof date === 'string' && date ? date : '—'
  const short = WEEKDAY_SHORT[d.getDay()]
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${short} ${dd}.${mm}.`
}

/** 05:30 – 14:00 Uhr (Schichtbeginn/-ende als HH:mm) */
export function formatShiftTimeRangeDE(startTime: string, endTime: string): string {
  const a = formatTimeDE(startTime).replace(' Uhr', '')
  const b = formatTimeDE(endTime).replace(' Uhr', '')
  return `${a} – ${b} Uhr`
}

/** Mai 2026 */
export function formatMonthYearDE(date: string | Date): string {
  const d = parseAnyDate(date)
  if (!d) return '—'
  const months = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ]
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

/** ISO-Woche (KW) und ISO-Jahr des Montags (YYYY-MM-DD) */
export function getIsoCalendarWeekForMonday(weekMondayYmd: string): { week: number; weekYear: number } {
  const mon = parseYmd(weekMondayYmd)
  if (!mon) return { week: 0, weekYear: 0 }
  const thu = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 3)
  thu.setHours(12, 0, 0, 0)
  const y = thu.getFullYear()
  const firstThursday = new Date(y, 0, 4)
  const offset = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(4 - offset)
  const diffDays = Math.round((thu.getTime() - firstThursday.getTime()) / 86400000)
  const week = 1 + Math.floor(diffDays / 7)
  return { week, weekYear: y }
}

/** Montag dieser Woche (lokal) als YYYY-MM-DD */
export function getMondayOfWeekContaining(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = x.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  x.setDate(x.getDate() + mondayOffset)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmd(ymd)
  if (!d) return ymd
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** z. B. KW 20 · 11.05.2026 – 17.05.2026 */
export function formatWeekRangeKwDE(weekMondayYmd: string, weekSundayYmd: string): string {
  const { week } = getIsoCalendarWeekForMonday(weekMondayYmd)
  return `KW ${week} · ${formatDateDE(weekMondayYmd)} – ${formatDateDE(weekSundayYmd)}`
}

/** Heute (lokal) YYYY-MM-DD */
export function localTodayYmd(): string {
  return toLocalIsoDateString(new Date())
}

export function toLocalIsoDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
