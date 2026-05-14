import type { GermanState } from '../data/germanHolidays2026.js'
import { GERMAN_HOLIDAYS_2026, holidayAppliesToState } from '../data/germanHolidays2026.js'
import type { StationHolidayOverlay } from '../types/stationHolidayOverlay.js'
import { addDaysToYmd, berlinWallClockToUtcMs, padHHMM } from '../utils/europeBerlinWallTime.js'

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

export type ScheduleShiftSurchargeDebug = {
  employeeId?: string
  employeeName?: string
  date: string
  shiftStart: string
  shiftEnd: string
  hoursNet: number
  isSunday: boolean
  isSaturday: boolean
  isPublicHoliday: boolean
  holidayName: string
  isSpecialHolidayTier: boolean
  hourlyRate: number
  holidayBonusPercentApplied: number
  holidayBonusAmount: number
  sundayBonusAmount: number
  saturdayBonusAmount: number
  nightBonusAmount: number
  night04BonusAmount: number
  totalBonuses: number
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

/** Gesetzliche Feiertage laut Stammdatenliste (aktuell Kalender 2026; weitere Jahre: Liste erweitern). */
export function isGermanPublicHolidayYmd(ymd: string, state: GermanState, overlay?: StationHolidayOverlay | null): boolean {
  if (overlay?.extraPublicDates.has(ymd)) return true
  return GERMAN_HOLIDAYS_2026.some((h) => h.date === ymd && holidayAppliesToState(h, state))
}

export function publicHolidayNameDe(ymd: string, state: GermanState, overlay?: StationHolidayOverlay | null): string {
  const parts: string[] = []
  for (const h of GERMAN_HOLIDAYS_2026) {
    if (h.date !== ymd || !holidayAppliesToState(h, state)) continue
    parts.push(h.name)
  }
  const extra = overlay?.extraNames.get(ymd)
  if (extra && !parts.includes(extra)) parts.push(extra)
  return parts.join(' · ')
}

/** Besondere Feiertage / Brückentage: Silvester ab 14 Uhr, Neujahr, Weihnachten (Profil „besondere Feiertage“). */
function isSpecialHolidayCalendarMoment(ymd: string, hour: number, minute: number): boolean {
  const md = ymd.slice(5)
  if (md === '12-25' || md === '12-26' || md === '01-01') return true
  if (md === '12-31' && (hour > 14 || (hour === 14 && minute >= 0))) return true
  return false
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

/** Alle anwendbaren Zuschlags-Prozente für einen Zeitpunkt (Europe/Berlin), ohne Kombinationslogik. */
function collectSurchargePercentsForInstant(
  emp: EmployeeSurchargeFields,
  isoMs: number,
  state: GermanState,
  overlay?: StationHolidayOverlay | null,
): number[] {
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

  const isPublicHol = isGermanPublicHolidayYmd(ymd, state, overlay)
  const isCustomSpecialAllDay = overlay?.specialAllDayDates.has(ymd) ?? false
  const isSpecialMoment = isSpecialHolidayCalendarMoment(ymd, hour, minute) || isCustomSpecialAllDay
  const isDec31Afternoon = ymd.endsWith('-12-31') && hour >= 14

  if (weekday0Sun === 6 && satPct > 0) percents.push(satPct)
  if (weekday0Sun === 0 && sunPct > 0) percents.push(sunPct)

  if (isSpecialMoment) {
    if (specHolPct > 0) percents.push(specHolPct)
    else if (isPublicHol && holPct > 0) percents.push(holPct)
  } else if (isPublicHol && holPct > 0) {
    percents.push(holPct)
  }

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
    if (isPublicHol && n04Hol > p) p = n04Hol
    if (isDec31Afternoon && n04Spec > p) p = n04Spec
    percents.push(p)
  }

  return percents
}

function combinePercents(percents: number[], emp: EmployeeSurchargeFields): number {
  if (percents.length === 0) return 0
  const mode = String(emp.surcharge_calculation_mode ?? 'higher').toLowerCase()
  if (mode === 'stack' || mode === 'add' || mode === 'summe') return percents.reduce((a, b) => a + b, 0)
  return Math.max(...percents)
}

function maxPercentForInstant(
  emp: EmployeeSurchargeFields,
  isoMs: number,
  state: GermanState,
  overlay?: StationHolidayOverlay | null,
): number {
  return combinePercents(collectSurchargePercentsForInstant(emp, isoMs, state, overlay), emp)
}

function shiftEndYmd(shiftDate: string, startTime: string, endTime: string): string {
  const st = padHHMM(startTime)
  const en = padHHMM(endTime)
  const [sh, sm] = st.split(':').map(Number)
  const [eh, em] = en.split(':').map(Number)
  const sMin = (sh ?? 0) * 60 + (sm ?? 0)
  const eMin = (eh ?? 0) * 60 + (em ?? 0)
  if (eMin <= sMin) return addDaysToYmd(shiftDate, 1)
  return shiftDate
}

/**
 * Zuschläge für eine **geplante** Schicht: Uhrzeit immer als Europe/Berlin (nicht Server-TZ).
 *
 * **Sonntag + gesetzlicher Feiertag:** Samstags-, Sonntags-, Feiertags- und Nachtanteile werden hier
 * **additiv** je 5-Minuten-Scheibe aufsummiert (Feiertag ersetzt den Sonntagssatz dabei nicht automatisch).
 * Das weicht von der Zeiterfassungslogik ab und ist bewusst so dokumentiert.
 *
 * Nachtzuschlag und 0–4-Uhr-Zuschläge werden zusätzlich berechnet, sofern Profilwerte > 0.
 */
export function computeScheduleShiftSupplementEuros(opts: {
  emp: EmployeeSurchargeFields
  hourlyWage: number
  shiftDate: string
  startTime: string
  endTime: string
  breakMinutes: number
  federalState: GermanState
  /** Stationsspezifische Zusatz-Feiertage (Lohn). */
  holidayOverlay?: StationHolidayOverlay | null
  employeeId?: string
  employeeName?: string
  /** Nur Zuschlagsminuten, deren Europe/Berlin-Kalendertag dieser YYYY-MM-DD ist (Kombi-Lohn). */
  onlyBerlinYmd?: string
  /** Nur für PAYROLL_SCHEDULE_DEBUG=1: eine Zeile pro Schicht (ungefähre Aufteilung). */
  debug?: Partial<ScheduleShiftSurchargeDebug>
}): number {
  const mode = String(opts.emp.surcharge_mode ?? 'none').toLowerCase()
  if (mode === 'none') return 0

  const wage = Number(opts.hourlyWage)
  if (!Number.isFinite(wage) || wage <= 0) return 0

  const dateStr = String(opts.shiftDate).trim()
  const st = padHHMM(opts.startTime)
  const en = padHHMM(opts.endTime)
  const endYmd = shiftEndYmd(dateStr, st, en)
  const startMs = berlinWallClockToUtcMs(dateStr, st)
  const endMs = berlinWallClockToUtcMs(endYmd, en)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0

  const breakMs = Math.max(0, Number(opts.breakMinutes) || 0) * 60_000
  const workSpan = endMs - startMs - breakMs
  if (workSpan <= 0) return 0
  const workEnd = startMs + workSpan

  const STEP_MS = 5 * 60 * 1000
  let supplement = 0
  let holAmt = 0
  let sunAmt = 0
  let satAmt = 0
  let nightAmt = 0
  let n04Amt = 0
  let maxHolPctApplied = 0

  const ymdFilter = opts.onlyBerlinYmd?.trim()
  const holOv = opts.holidayOverlay ?? null

  for (let t = startMs; t < workEnd; t += STEP_MS) {
    const sliceEnd = Math.min(t + STEP_MS, workEnd)
    const hours = (sliceEnd - t) / 3_600_000
    const mid = (t + sliceEnd) / 2
    const { ymd, hour, minute, weekday0Sun } = berlinWallClock(mid)
    if (ymdFilter && ymd !== ymdFilter) continue
    const mod = toMinuteOfDay(hour, minute)
    const satPct = numOr0(opts.emp.saturday_surcharge_percent)
    const sunPct = numOr0(opts.emp.sunday_surcharge_percent)
    const holPct = numOr0(opts.emp.holiday_surcharge_percent)
    const specHolPct = numOr0(opts.emp.special_holiday_surcharge_percent)
    const nightPct = numOr0(opts.emp.night_surcharge_percent)
    const n04 = numOr0(opts.emp.night_0_4_surcharge_percent)
    const n04Sun = numOr0(opts.emp.night_0_4_after_sunday_percent)
    const n04Hol = numOr0(opts.emp.night_0_4_after_holiday_percent)
    const n04Spec = numOr0(opts.emp.night_0_4_after_special_holiday_percent)
    const isPublicHol = isGermanPublicHolidayYmd(ymd, opts.federalState, holOv)
    const isCustomSpecialAllDay = holOv?.specialAllDayDates.has(ymd) ?? false
    const isSpecialMoment = isSpecialHolidayCalendarMoment(ymd, hour, minute) || isCustomSpecialAllDay
    const isDec31Afternoon = ymd.endsWith('-12-31') && hour >= 14

    if (weekday0Sun === 6 && satPct > 0) {
      const a = hours * wage * (satPct / 100)
      satAmt += a
      supplement += a
    }
    if (weekday0Sun === 0 && sunPct > 0) {
      const a = hours * wage * (sunPct / 100)
      sunAmt += a
      supplement += a
    }

    let holP = 0
    if (isSpecialMoment) {
      if (specHolPct > 0) holP = specHolPct
      else if (isPublicHol && holPct > 0) holP = holPct
    } else if (isPublicHol && holPct > 0) {
      holP = holPct
    }
    if (holP > 0) {
      maxHolPctApplied = Math.max(maxHolPctApplied, holP)
      const a = hours * wage * (holP / 100)
      holAmt += a
      supplement += a
    }

    const ns = parseHm(opts.emp.night_surcharge_start)
    const ne = parseHm(opts.emp.night_surcharge_end)
    if (ns && ne && nightPct > 0) {
      const startM = toMinuteOfDay(ns.h, ns.m)
      const endM = toMinuteOfDay(ne.h, ne.m)
      if (minuteInSpan(mod, startM, endM)) {
        const a = hours * wage * (nightPct / 100)
        nightAmt += a
        supplement += a
      }
    }

    if (hour >= 0 && hour < 4 && n04 > 0) {
      let p = n04
      if (weekday0Sun === 0 && n04Sun > p) p = n04Sun
      if (isPublicHol && n04Hol > p) p = n04Hol
      if (isDec31Afternoon && n04Spec > p) p = n04Spec
      const a = hours * wage * (p / 100)
      n04Amt += a
      supplement += a
    }
  }

  if (opts.debug && process.env.PAYROLL_SCHEDULE_DEBUG === '1') {
    const wall0 = berlinWallClock(startMs)
    const isPH = isGermanPublicHolidayYmd(wall0.ymd, opts.federalState, holOv)
    const grossH = (endMs - startMs) / 3_600_000
    const netH = Math.max(0, grossH - (Number(opts.breakMinutes) || 0) / 60)
    Object.assign(opts.debug, {
      employeeId: opts.employeeId,
      employeeName: opts.employeeName,
      date: dateStr,
      shiftStart: st,
      shiftEnd: en,
      hoursNet: Math.round(netH * 100) / 100,
      isSunday: wall0.weekday0Sun === 0,
      isSaturday: wall0.weekday0Sun === 6,
      isPublicHoliday: isPH,
      holidayName: publicHolidayNameDe(wall0.ymd, opts.federalState, holOv),
      isSpecialHolidayTier:
        isSpecialHolidayCalendarMoment(wall0.ymd, wall0.hour, wall0.minute) ||
        (holOv?.specialAllDayDates.has(wall0.ymd) ?? false),
      hourlyRate: wage,
      holidayBonusPercentApplied: maxHolPctApplied,
      holidayBonusAmount: Math.round(holAmt * 100) / 100,
      sundayBonusAmount: Math.round(sunAmt * 100) / 100,
      saturdayBonusAmount: Math.round(satAmt * 100) / 100,
      nightBonusAmount: Math.round(nightAmt * 100) / 100,
      night04BonusAmount: Math.round(n04Amt * 100) / 100,
      totalBonuses: Math.round(supplement * 100) / 100,
    })
  }

  return Math.round(supplement * 100) / 100
}

/**
 * Zuschläge in EUR für einen freigegebenen Zeiteintrag (Stundenlohn × Prozentsatz je Zeitscheibe).
 * Aushilfen, Minijobber und geringfügig Beschäftigte: immer 0. Modus „Keine Zuschläge“ (none): 0. Sonst Profil-Prozente (individual / tax_free …).
 *
 * **Sonntag + Feiertag:** Pro Scheibe werden die anwendbaren Sätze (Samstag, Sonntag, Feiertag, besonderer Feiertag, Nacht, 0–4-Uhr)
 * gesammelt; der effektive Prozentsatz ist standardmäßig **`Math.max(...)`** (`surcharge_calculation_mode` ≠ stack/add/summe),
 * d. h. Feiertag/besonderer Feiertag **verdrängt** den niedrigeren Sonntagssatz, kein Doppelzuschlag aus beiden.
 * Ausnahme: Profil `surcharge_calculation_mode` = stack/add/summe → Summe der Sätze.
 */
export function computeSupplementEurosForTimeEntry(opts: {
  employmentType: string
  emp: EmployeeSurchargeFields
  hourlyWage: number
  startIso: string
  endIso: string
  breakMinutes: number
  federalState: GermanState
  holidayOverlay?: StationHolidayOverlay | null
  /** Nur Zuschlagsminuten mit diesem Europe/Berlin-Kalendertag (Kombi-Lohn). */
  onlyBerlinYmd?: string
}): number {
  const et = String(opts.employmentType ?? '').toLowerCase().trim()
  if (et === 'aushilfe' || et === 'minijob' || et.includes('gering')) return 0
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
  const ymdFilter = opts.onlyBerlinYmd?.trim()
  const holOv = opts.holidayOverlay ?? null

  for (let t = start; t < workEnd; t += STEP_MS) {
    const sliceEnd = Math.min(t + STEP_MS, workEnd)
    const hours = (sliceEnd - t) / 3_600_000
    const mid = (t + sliceEnd) / 2
    if (ymdFilter && berlinWallClock(mid).ymd !== ymdFilter) continue
    const pct = maxPercentForInstant(opts.emp, mid, opts.federalState, holOv)
    if (pct > 0) supplement += hours * wage * (pct / 100)
  }
  return Math.round(supplement * 100) / 100
}
