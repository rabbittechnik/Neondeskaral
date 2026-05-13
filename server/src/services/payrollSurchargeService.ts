import type { GermanState } from '../data/germanHolidays2026.js'
import { GERMAN_HOLIDAYS_2026, holidayAppliesToState } from '../data/germanHolidays2026.js'

export type EmployeeSurchargeFields = {
  surcharge_mode: string | null
  night_surcharge_percent: number | null
  night_surcharge_start: string | null
  night_surcharge_end: string | null
  saturday_surcharge_percent: number | null
  sunday_surcharge_percent: number | null
  holiday_surcharge_percent: number | null
  special_holiday_surcharge_percent: number | null
  night_0_4_surcharge_percent: number | null
  night_0_4_after_sunday_percent: number | null
  night_0_4_after_holiday_percent: number | null
  night_0_4_after_special_holiday_percent: number | null
  surcharge_calculation_mode: string | null
}

function numOr0(v: number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function parseHm(s: string | null | undefined): { h: number; m: number } | null {
  if (!s || !String(s).trim()) return null
  const p = String(s).trim().split(':')
  const h = Number(p[0])
  const m = Number(p[1] ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return { h, m }
}

function toMinuteOfDay(h: number, m: number): number {
  return h * 60 + m
}

/** [start, end) im Minutenring; Nacht z. B. 22:00–06:00 */
function minuteInSpan(mod: number, startM: number, endM: number): boolean {
  if (startM === endM) return false
  if (startM < endM) return mod >= startM && mod < endM
  return mod >= startM || mod < endM
}

/** Nur Kalenderjahr 2026 in Datenbasis — andere Jahre: kein Feiertag (keine erfundenen Daten). */
function isPublicHolidayYmd(ymd: string, state: GermanState): boolean {
  if (!ymd.startsWith('2026-')) return false
  return GERMAN_HOLIDAYS_2026.some((h) => h.date === ymd && holidayAppliesToState(h, state))
}

const berlinWeekday = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
})

const berlinParts = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function berlinWallClock(isoMs: number): { ymd: string; hour: number; minute: number; weekday0Sun: number } {
  const d = new Date(isoMs)
  const wdStr = berlinWeekday.format(d)
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday0Sun = wdMap[wdStr] ?? 0
  const ps = berlinParts.formatToParts(d)
  const get = (t: Intl.DateTimeFormatPartTypes) => ps.find((x) => x.type === t)?.value ?? '0'
  const ymd = `${get('year')}-${get('month')}-${get('day')}`
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))
  return { ymd, hour, minute, weekday0Sun }
}

function maxPercentForInstant(emp: EmployeeSurchargeFields, isoMs: number, state: GermanState): number {
  const { ymd, hour, minute, weekday0Sun } = berlinWallClock(isoMs)
  const mod = toMinuteOfDay(hour, minute)
  const percents: number[] = []

  const satPct = numOr0(emp.saturday_surcharge_percent)
  const sunPct = numOr0(emp.sunday_surcharge_percent)
  const holPct = numOr0(emp.holiday_surcharge_percent)
  const specHolPct = numOr0(emp.special_holiday_surcharge_percent)
  const nightPct = numOr0(emp.night_surcharge_percent)
  const n04 = numOr0(emp.night_0_4_surcharge_percent)
  const n04Sun = numOr0(emp.night_0_4_after_sunday_percent)
  const n04Hol = numOr0(emp.night_0_4_after_holiday_percent)
  const n04Spec = numOr0(emp.night_0_4_after_special_holiday_percent)

  const isHoliday = isPublicHolidayYmd(ymd, state)
  const isDec31Afternoon = ymd.endsWith('-12-31') && hour >= 14

  if (weekday0Sun === 6 && satPct > 0) percents.push(satPct)
  if (weekday0Sun === 0 && sunPct > 0) percents.push(sunPct)
  if (isHoliday && holPct > 0) percents.push(holPct)
  if (isDec31Afternoon && specHolPct > 0) percents.push(specHolPct)

  const ns = parseHm(emp.night_surcharge_start)
  const ne = parseHm(emp.night_surcharge_end)
  if (ns && ne && nightPct > 0) {
    const startM = toMinuteOfDay(ns.h, ns.m)
    const endM = toMinuteOfDay(ne.h, ne.m)
    if (minuteInSpan(mod, startM, endM)) percents.push(nightPct)
  }

  if (hour >= 0 && hour < 4 && n04 > 0) {
    let p = n04
    if (weekday0Sun === 0 && n04Sun > p) p = n04Sun
    if (isHoliday && n04Hol > p) p = n04Hol
    if (isDec31Afternoon && n04Spec > p) p = n04Spec
    percents.push(p)
  }

  if (percents.length === 0) return 0
  const mode = String(emp.surcharge_calculation_mode ?? 'higher').toLowerCase()
  if (mode === 'stack' || mode === 'add' || mode === 'summe') return percents.reduce((a, b) => a + b, 0)
  return Math.max(...percents)
}

/**
 * Zuschläge in EUR für einen freigegebenen Zeiteintrag (Stundenlohn × Prozentsatz je Zeitscheibe).
 * Aushilfen: immer 0. Modus „Keine Zuschläge“ (none): 0. Sonst Profil-Prozente (individual / tax_free …).
 */
export function computeSupplementEurosForTimeEntry(opts: {
  employmentType: string
  emp: EmployeeSurchargeFields
  hourlyWage: number
  startIso: string
  endIso: string
  breakMinutes: number
  federalState: GermanState
}): number {
  const et = String(opts.employmentType ?? '').toLowerCase().trim()
  if (et === 'aushilfe') return 0
  const mode = String(opts.emp.surcharge_mode ?? 'none').toLowerCase()
  if (mode === 'none') return 0

  const wage = Number(opts.hourlyWage)
  if (!Number.isFinite(wage) || wage <= 0) return 0

  const start = new Date(opts.startIso).getTime()
  const end = new Date(opts.endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0

  const breakMs = Math.max(0, Number(opts.breakMinutes) || 0) * 60_000
  const workSpan = end - start - breakMs
  if (workSpan <= 0) return 0
  const workEnd = start + workSpan

  const STEP_MS = 5 * 60 * 1000
  let supplement = 0
  for (let t = start; t < workEnd; t += STEP_MS) {
    const sliceEnd = Math.min(t + STEP_MS, workEnd)
    const hours = (sliceEnd - t) / 3_600_000
    const mid = (t + sliceEnd) / 2
    const pct = maxPercentForInstant(opts.emp, mid, opts.federalState)
    if (pct > 0) supplement += hours * wage * (pct / 100)
  }
  return Math.round(supplement * 100) / 100
}
