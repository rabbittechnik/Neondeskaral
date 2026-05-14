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

/**
 * Kalenderdatum oder vollständiger Zeitstempel.
 * Wichtig: ISO-Strings mit Uhrzeit (…T13:59…) dürfen nicht auf Tagesbeginn gekürzt werden,
 * sonst entsteht fälschlich 00:00 Uhr in der Anzeige.
 */
function parseAnyDate(input: string | Date): Date | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  const s = String(input ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseYmd(s)
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return new Date(t)
  return null
}

const DEFAULT_DISPLAY_TZ = 'Europe/Berlin'

function formatHourMinuteInZone(d: Date, timeZone: string): { hh: string; mm: string } {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const hRaw = parts.find((p) => p.type === 'hour')?.value ?? '0'
  const mRaw = parts.find((p) => p.type === 'minute')?.value ?? '0'
  return { hh: hRaw.padStart(2, '0'), mm: mRaw.padStart(2, '0') }
}

/**
 * Uhrzeit in fester Zeitzone (Standard: Europe/Berlin), z. B. für Einstempel-Anzeige.
 * Reine Schichtzeiten „HH:mm“ bleiben unverändert (kein TZ-Bezug).
 */
export function formatTimeLocal(
  timestamp: string | Date | null | undefined,
  timeZone: string = DEFAULT_DISPLAY_TZ,
): string {
  if (timestamp == null) return '—'
  if (timestamp instanceof Date) {
    if (Number.isNaN(timestamp.getTime())) return '—'
    const { hh, mm } = formatHourMinuteInZone(timestamp, timeZone)
    return `${hh}:${mm} Uhr`
  }
  const s = String(timestamp).trim()
  if (!s) return '—'
  const hm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s)
  if (hm) {
    const h = String(Math.min(23, Math.max(0, parseInt(hm[1], 10)))).padStart(2, '0')
    const m = String(Math.min(59, Math.max(0, parseInt(hm[2], 10)))).padStart(2, '0')
    return `${h}:${m} Uhr`
  }
  const d = parseAnyDate(s)
  if (!d || Number.isNaN(d.getTime())) return s
  const { hh, mm } = formatHourMinuteInZone(d, timeZone)
  return `${hh}:${mm} Uhr`
}

/** Einstempelzeit in der Mitarbeiter-App: kein 00:00-Fallback bei fehlender Uhrzeit. */
export function formatEmployeeClockInDE(iso: string | null | undefined): string {
  const s = iso != null ? String(iso).trim() : ''
  if (!s) {
    console.warn('[Mitarbeiter-App] time_entry ohne gültiges startAt/clock_in_at für die Anzeige')
    return 'Einstempelzeit nicht verfügbar'
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    console.warn('[Mitarbeiter-App] time_entry nur mit Datum ohne Uhrzeit (startAt)', { startAt: s })
    return 'Einstempelzeit nicht verfügbar'
  }
  return formatTimeLocal(s, DEFAULT_DISPLAY_TZ)
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

/** HH:mm Uhr (aus ISO-Datetime oder reiner Uhrzeit HH:mm). Datumszeiten: Europe/Berlin. */
export function formatTimeDE(time: string | Date): string {
  return formatTimeLocal(time, DEFAULT_DISPLAY_TZ)
}

/** TT.MM.JJJJ, HH:mm Uhr */
export function formatDateTimeDE(date: string | Date): string {
  const d = parseAnyDate(date)
  if (!d) return typeof date === 'string' && date ? date : '—'
  return `${formatDateDE(d)}, ${formatTimeDE(d)}`
}

/** Nur Wochentag, z. B. „Montag“ */
export function formatWeekdayLongDE(date: string | Date): string {
  const d = parseAnyDate(date)
  if (!d) return typeof date === 'string' && date ? date : '—'
  return WEEKDAY_LONG[d.getDay()]
}

/** z. B. „Montag, 12.05.2026“ */
export function formatWeekdayDateDE(date: string | Date): string {
  const d = parseAnyDate(date)
  if (!d) return typeof date === 'string' && date ? date : '—'
  const long = WEEKDAY_LONG[d.getDay()]
  return `${long}, ${formatDateDE(d)}`
}

/** Lang: Wochentag + Datum (aktuell identisch zu formatWeekdayDateDE) */
export function formatWeekdayLongDateDE(date: string | Date): string {
  return formatWeekdayDateDE(date)
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
