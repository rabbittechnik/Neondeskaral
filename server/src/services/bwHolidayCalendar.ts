/**
 * Gesetzliche Feiertage Baden-Württemberg (Kalendertag Europe/Berlin).
 * 2026: synchron zu `germanHolidays2026.ts`. Weitere Jahre: feste Liste, erweiterbar.
 */
import { addDaysToYmd } from '../utils/europeBerlinWallTime.js'
import { GERMAN_HOLIDAYS_2026, holidayAppliesToState, type GermanState } from '../data/germanHolidays2026.js'

const BW: GermanState = 'BW'

/** YYYY-MM-DD → BW-Feiertag (gesetzlich / in BW gültig). */
export function isBadenWuerttembergPublicHolidayYmd(ymd: string): boolean {
  const y = Number(ymd.slice(0, 4))
  if (y === 2026) {
    return GERMAN_HOLIDAYS_2026.some((h) => h.date === ymd && holidayAppliesToState(h, BW))
  }
  const set = BW_HOLIDAY_YMD_BY_YEAR[y]
  return set ? set.has(ymd) : false
}

/** Samstag/Sonntag in Europe/Berlin (über Mittags-Berlin-Zeitpunkt). */
export function isWeekendBerlinYmd(ymd: string): boolean {
  const w = berlinWeekdayLongDe(ymd)
  return w === 'Samstag' || w === 'Sonntag'
}

function berlinWeekdayLongDe(ymd: string): string {
  const [yy, mm, dd] = ymd.split('-').map(Number)
  const utcNoon = Date.UTC(yy!, mm! - 1, dd!, 11, 0, 0)
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'Europe/Berlin' }).format(new Date(utcNoon))
}

/** Montag der Kalenderwoche (Europe/Berlin), zu der `ymd` gehört. */
export function mondayOfCalendarWeekBerlin(ymd: string): string {
  const w = berlinWeekdayLongDe(ymd)
  const delta: Record<string, number> = {
    Montag: 0,
    Dienstag: -1,
    Mittwoch: -2,
    Donnerstag: -3,
    Freitag: -4,
    Samstag: -5,
    Sonntag: -6,
  }
  return addDaysToYmd(ymd, delta[w] ?? 0)
}

/** Mo–Fr ohne BW-Feiertag → „Werktags-Backplan“, sonst Kurzplan (Wochenende/Feiertag). */
export function isBakingWeekdayPlanYmd(ymd: string): boolean {
  const w = berlinWeekdayLongDe(ymd)
  if (w === 'Samstag' || w === 'Sonntag') return false
  if (isBadenWuerttembergPublicHolidayYmd(ymd)) return false
  return true
}

const BW_HOLIDAY_YMD_BY_YEAR: Record<number, Set<string>> = {
  2025: new Set([
    '2025-01-01',
    '2025-01-06',
    '2025-04-18',
    '2025-04-21',
    '2025-05-01',
    '2025-05-29',
    '2025-06-09',
    '2025-06-19',
    '2025-10-03',
    '2025-11-01',
    '2025-12-25',
    '2025-12-26',
  ]),
  2027: new Set([
    '2027-01-01',
    '2027-01-06',
    '2027-04-02',
    '2027-04-05',
    '2027-05-01',
    '2027-05-13',
    '2027-05-24',
    '2027-06-03',
    '2027-10-03',
    '2027-11-01',
    '2027-12-25',
    '2027-12-26',
  ]),
  2028: new Set([
    '2028-01-01',
    '2028-01-06',
    '2028-04-14',
    '2028-04-17',
    '2028-05-01',
    '2028-05-25',
    '2028-06-05',
    '2028-06-15',
    '2028-10-03',
    '2028-11-01',
    '2028-12-25',
    '2028-12-26',
  ]),
}
