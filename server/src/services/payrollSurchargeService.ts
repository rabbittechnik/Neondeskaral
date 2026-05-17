import type { GermanState } from '../data/germanHolidays2026.js'
import { GERMAN_HOLIDAYS_2026, holidayAppliesToState } from '../data/germanHolidays2026.js'
import {
  holidayNameAtMoment,
  resolveHolidayTierAtMoment,
  type StationHolidayOverlay,
} from '../types/stationHolidayOverlay.js'
import {
  DEFAULT_STATION_PAYROLL_SURCHARGE_RULES,
  type StationPayrollSurchargeRules,
} from '../types/stationPayrollSurchargeRules.js'
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

function overlayHasPayrollRules(overlay?: StationHolidayOverlay | null): boolean {
  return (overlay?.rules?.length ?? 0) > 0
}

/** Gesetzliche / verwaltete Feiertage (Stations-Feiertagsverwaltung hat Vorrang). */
export function isGermanPublicHolidayYmd(ymd: string, state: GermanState, overlay?: StationHolidayOverlay | null): boolean {
  if (overlayHasPayrollRules(overlay)) {
    return resolveHolidayTierAtMoment(ymd, 12, 0, overlay) !== 'none'
  }
  if (overlay?.extraPublicDates.has(ymd)) return true
  return GERMAN_HOLIDAYS_2026.some((h) => h.date === ymd && holidayAppliesToState(h, state))
}

export function publicHolidayNameDe(ymd: string, state: GermanState, overlay?: StationHolidayOverlay | null): string {
  if (overlayHasPayrollRules(overlay)) {
    const fromRules = holidayNameAtMoment(ymd, 12, 0, overlay)
    if (fromRules) return fromRules
  }
  const parts: string[] = []
  for (const h of GERMAN_HOLIDAYS_2026) {
    if (h.date !== ymd || !holidayAppliesToState(h, state)) continue
    parts.push(h.name)
  }
  const extra = overlay?.extraNames.get(ymd)
  if (extra && !parts.includes(extra)) parts.push(extra)
  return parts.join(' · ')
}

/** Ganztägige gesetzliche B-Feiertage (150-%-Zuschlag / special_holiday_surcharge_percent). */
const STATUTORY_SPECIAL_HOLIDAY_MD = new Set(['01-01', '05-01', '12-25', '12-26'])

/**
 * Besondere Feiertage / B-Feiertage: Neujahr, Tag der Arbeit, Weihnachten, Silvester ab 14 Uhr.
 * Station: `specialAllDayDates` aus Zusatz-Feiertagen (`counts_as_special`).
 */
export function isSpecialHolidayCalendarMoment(ymd: string, hour: number, minute: number): boolean {
  const md = ymd.slice(5)
  if (STATUTORY_SPECIAL_HOLIDAY_MD.has(md)) return true
  if (md === '12-31' && (hour > 14 || (hour === 14 && minute >= 0))) return true
  return false
}

export function isSpecialHolidayYmd(
  ymd: string,
  overlay?: StationHolidayOverlay | null,
  hour = 12,
  minute = 0,
): boolean {
  if (overlayHasPayrollRules(overlay)) {
    return resolveHolidayTierAtMoment(ymd, hour, minute, overlay) === 'special'
  }
  if (overlay?.specialAllDayDates.has(ymd)) return true
  return isSpecialHolidayCalendarMoment(ymd, hour, minute)
}

export type HolidayPayrollTier = 'none' | 'regular' | 'special'

/** Feiertagsart für Lohnabrechnung / Debug (regular = 125 %, special = B-Feiertag / 150 %). */
export function resolveHolidayPayrollTier(
  ymd: string,
  state: GermanState,
  overlay?: StationHolidayOverlay | null,
  hour = 12,
  minute = 0,
): HolidayPayrollTier {
  if (overlayHasPayrollRules(overlay)) {
    return resolveHolidayTierAtMoment(ymd, hour, minute, overlay)
  }
  if (isSpecialHolidayYmd(ymd, overlay, hour, minute)) return 'special'
  if (isGermanPublicHolidayYmd(ymd, state, overlay)) return 'regular'
  return 'none'
}

export type PayrollSupplementLineDebug = {
  kind: 'special_holiday' | 'holiday' | 'sunday' | 'saturday' | 'night' | 'night04'
  kindLabelDe: string
  percent: number
  hours: number
  hourlyWage: number
  amountEuro: number
}

export type PayrollDaySupplementAudit = {
  date: string
  weekdayDe: string
  workHoursUsed: number
  vacationHours: number
  hourlyWage: number
  appliedBasis: 'schedule' | 'time_tracking' | 'none'
  scheduleBasisEuro: number
  timeTrackingBasisEuro: number
  isPublicHoliday: boolean
  isSpecialHoliday: boolean
  holidayNameDe: string
  holidayType: HolidayPayrollTier
  lines: PayrollSupplementLineDebug[]
  dayTotalEuro: number
  /** Summe der Einzelzeilen (Cent-gerundet) – zur Rundungsprüfung. */
  linesSumEuro: number
  notInOriginalSystem: boolean
  formulaSummary: string
}

const SUPPLEMENT_KIND_LABEL: Record<PayrollSupplementLineDebug['kind'], string> = {
  special_holiday: 'Besonderer Feiertag (B-Feiertag)',
  holiday: 'Feiertag',
  sunday: 'Sonntag',
  saturday: 'Samstag',
  night: 'Nachtzuschlag',
  night04: '0–4-Uhr-Zuschlag',
}

type SupplementBreakdownBuckets = Record<PayrollSupplementLineDebug['kind'], { hours: number; amount: number; percent: number }>

function emptyBreakdownBuckets(): SupplementBreakdownBuckets {
  return {
    special_holiday: { hours: 0, amount: 0, percent: 0 },
    holiday: { hours: 0, amount: 0, percent: 0 },
    sunday: { hours: 0, amount: 0, percent: 0 },
    saturday: { hours: 0, amount: 0, percent: 0 },
    night: { hours: 0, amount: 0, percent: 0 },
    night04: { hours: 0, amount: 0, percent: 0 },
  }
}

function bucketsToLines(buckets: SupplementBreakdownBuckets, wage: number): PayrollSupplementLineDebug[] {
  const lines: PayrollSupplementLineDebug[] = []
  for (const kind of Object.keys(buckets) as PayrollSupplementLineDebug['kind'][]) {
    const b = buckets[kind]
    if (b.hours <= 0 && b.amount <= 0) continue
    lines.push({
      kind,
      kindLabelDe: SUPPLEMENT_KIND_LABEL[kind],
      percent: Math.round(b.percent * 100) / 100,
      hours: Math.round(b.hours * 100) / 100,
      hourlyWage: Math.round(wage * 100) / 100,
      amountEuro: Math.round(b.amount * 100) / 100,
    })
  }
  return lines
}

function mergeBreakdownBuckets(a: SupplementBreakdownBuckets, b: SupplementBreakdownBuckets): SupplementBreakdownBuckets {
  const out = emptyBreakdownBuckets()
  for (const kind of Object.keys(out) as PayrollSupplementLineDebug['kind'][]) {
    out[kind].hours = a[kind].hours + b[kind].hours
    out[kind].amount = a[kind].amount + b[kind].amount
    out[kind].percent = Math.max(a[kind].percent, b[kind].percent)
  }
  return out
}

function rulesOrDefault(r?: StationPayrollSurchargeRules | null): StationPayrollSurchargeRules {
  return r ?? DEFAULT_STATION_PAYROLL_SURCHARGE_RULES
}

/** Mo–Fr ohne gesetzlichen / B-Feiertag (Kalendertag Europe/Berlin). */
function isNormalPayrollWeekday(
  weekday0Sun: number,
  ymd: string,
  state: GermanState,
  overlay?: StationHolidayOverlay | null,
): boolean {
  if (weekday0Sun === 0 || weekday0Sun === 6) return false
  if (isGermanPublicHolidayYmd(ymd, state, overlay)) return false
  if (isSpecialHolidayYmd(ymd, overlay)) return false
  return true
}

function allowNightTimeBonusOnInstant(
  weekday0Sun: number,
  ymd: string,
  hour: number,
  minute: number,
  state: GermanState,
  overlay: StationHolidayOverlay | null | undefined,
  rules: StationPayrollSurchargeRules,
): boolean {
  if (rules.onlySundayAndHolidaySupplements) return false

  const isHol =
    isGermanPublicHolidayYmd(ymd, state, overlay) ||
    isSpecialHolidayYmd(ymd, overlay, hour, minute)
  if (isHol) return false

  if (isNormalPayrollWeekday(weekday0Sun, ymd, state, overlay)) {
    return rules.normalWeekdayNightBonusEnabled && rules.normalWeekdayEveningBonusEnabled
  }
  return true
}

function allowSaturdayBonus(weekday0Sun: number, rules: StationPayrollSurchargeRules): boolean {
  if (rules.onlySundayAndHolidaySupplements) return false
  if (weekday0Sun !== 6) return true
  return rules.saturdaySurchargeEnabled
}

function allowSundayBonus(weekday0Sun: number, rules: StationPayrollSurchargeRules): boolean {
  if (weekday0Sun !== 0) return true
  return rules.sundaySurchargeEnabled
}

/** Prozentsatz nur aus dem Mitarbeiterprofil (Feiertagsverwaltung liefert die Kategorie). */
function resolveHolidaySlicePercent(
  holidayTier: 'none' | 'regular' | 'special',
  emp: EmployeeSurchargeFields,
): { percent: number; kind: 'special_holiday' | 'holiday' | null } {
  if (holidayTier === 'special') {
    const pct = numOr0(emp.special_holiday_surcharge_percent)
    if (pct > 0) return { percent: pct, kind: 'special_holiday' }
    return { percent: 0, kind: null }
  }
  if (holidayTier === 'regular') {
    const pct = numOr0(emp.holiday_surcharge_percent)
    if (pct > 0) return { percent: pct, kind: 'holiday' }
  }
  return { percent: 0, kind: null }
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
  stationRules?: StationPayrollSurchargeRules | null,
): number[] {
  const rules = rulesOrDefault(stationRules)
  const { ymd, hour, minute, weekday0Sun } = berlinWallClock(isoMs)
  const mod = toMinuteOfDay(hour, minute)
  const percents: number[] = []

  const satPct = numOr0(emp.saturday_surcharge_percent)
  const sunPct = numOr0(emp.sunday_surcharge_percent)
  const nightPct = numOr0(emp.night_surcharge_percent)
  const n04 = numOr0(emp.night_0_4_surcharge_percent)
  const n04Sun = numOr0(emp.night_0_4_after_sunday_percent)
  const n04Hol = numOr0(emp.night_0_4_after_holiday_percent)
  const n04Spec = numOr0(emp.night_0_4_after_special_holiday_percent)

  const holidayTier = resolveHolidayPayrollTier(ymd, state, overlay, hour, minute)
  const isPublicHol = holidayTier !== 'none'
  const isSpecialMoment = holidayTier === 'special'
  const isDec31Afternoon = ymd.endsWith('-12-31') && hour >= 14

  if (weekday0Sun === 6 && satPct > 0 && allowSaturdayBonus(weekday0Sun, rules)) percents.push(satPct)
  if (weekday0Sun === 0 && sunPct > 0 && allowSundayBonus(weekday0Sun, rules)) percents.push(sunPct)

  const holSlice = resolveHolidaySlicePercent(holidayTier, emp)
  if (holSlice.percent > 0) percents.push(holSlice.percent)

  const ns = parseHm(emp.night_surcharge_start)
  const ne = parseHm(emp.night_surcharge_end)
  if (
    ns &&
    ne &&
    nightPct > 0 &&
    allowNightTimeBonusOnInstant(weekday0Sun, ymd, hour, minute, state, overlay, rules)
  ) {
    const startM = toMinuteOfDay(ns.h, ns.m)
    const endM = toMinuteOfDay(ne.h, ne.m)
    if (minuteInSpan(mod, startM, endM)) percents.push(nightPct)
  }

  if (
    hour >= 0 &&
    hour < 4 &&
    n04 > 0 &&
    allowNightTimeBonusOnInstant(weekday0Sun, ymd, hour, minute, state, overlay, rules)
  ) {
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
  stationRules?: StationPayrollSurchargeRules | null,
): number {
  return combinePercents(collectSurchargePercentsForInstant(emp, isoMs, state, overlay, stationRules), emp)
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

type ScheduleShiftSupplementOpts = {
  emp: EmployeeSurchargeFields
  hourlyWage: number
  shiftDate: string
  startTime: string
  endTime: string
  breakMinutes: number
  federalState: GermanState
  holidayOverlay?: StationHolidayOverlay | null
  stationRules?: StationPayrollSurchargeRules | null
  onlyBerlinYmd?: string
}

function accumulateScheduleShiftSupplement(
  opts: ScheduleShiftSupplementOpts,
): { supplement: number; buckets: SupplementBreakdownBuckets } {
  const mode = String(opts.emp.surcharge_mode ?? 'none').toLowerCase()
  if (mode === 'none') return { supplement: 0, buckets: emptyBreakdownBuckets() }

  const wage = Number(opts.hourlyWage)
  if (!Number.isFinite(wage) || wage <= 0) return { supplement: 0, buckets: emptyBreakdownBuckets() }

  const dateStr = String(opts.shiftDate).trim()
  const st = padHHMM(opts.startTime)
  const en = padHHMM(opts.endTime)
  const endYmd = shiftEndYmd(dateStr, st, en)
  const startMs = berlinWallClockToUtcMs(dateStr, st)
  const endMs = berlinWallClockToUtcMs(endYmd, en)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { supplement: 0, buckets: emptyBreakdownBuckets() }
  }

  const breakMs = Math.max(0, Number(opts.breakMinutes) || 0) * 60_000
  const workSpan = endMs - startMs - breakMs
  if (workSpan <= 0) return { supplement: 0, buckets: emptyBreakdownBuckets() }
  const workEnd = startMs + workSpan

  const STEP_MS = 5 * 60 * 1000
  let supplement = 0
  const buckets = emptyBreakdownBuckets()
  const ymdFilter = opts.onlyBerlinYmd?.trim()
  const holOv = opts.holidayOverlay ?? null
  const rules = rulesOrDefault(opts.stationRules)

  for (let t = startMs; t < workEnd; t += STEP_MS) {
    const sliceEnd = Math.min(t + STEP_MS, workEnd)
    const hours = (sliceEnd - t) / 3_600_000
    const mid = (t + sliceEnd) / 2
    const { ymd } = berlinWallClock(mid)
    if (ymdFilter && ymd !== ymdFilter) continue

    const pct = maxPercentForInstant(opts.emp, mid, opts.federalState, holOv, rules)
    if (pct <= 0) continue
    const { kind } = dominantSurchargeKindForInstant(opts.emp, mid, opts.federalState, holOv, rules)
    if (!kind) continue
    const a = hours * wage * (pct / 100)
    buckets[kind].hours += hours
    buckets[kind].amount += a
    buckets[kind].percent = Math.max(buckets[kind].percent, pct)
    supplement += a
  }

  return { supplement: Math.round(supplement * 100) / 100, buckets }
}

/** Schichtplan-Zuschläge mit Aufschlüsselung je Kategorie (Debug / Vergleich). */
export function computeScheduleShiftSupplementBreakdown(
  opts: ScheduleShiftSupplementOpts,
): { totalEuro: number; lines: PayrollSupplementLineDebug[]; buckets: SupplementBreakdownBuckets } {
  const { supplement, buckets } = accumulateScheduleShiftSupplement(opts)
  const wage = Math.max(0, Number(opts.hourlyWage) || 0)
  return {
    totalEuro: supplement,
    lines: bucketsToLines(buckets, wage),
    buckets,
  }
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
  stationRules?: StationPayrollSurchargeRules | null
  employeeId?: string
  employeeName?: string
  /** Nur Zuschlagsminuten, deren Europe/Berlin-Kalendertag dieser YYYY-MM-DD ist (Kombi-Lohn). */
  onlyBerlinYmd?: string
  /** Nur für PAYROLL_SCHEDULE_DEBUG=1: eine Zeile pro Schicht (ungefähre Aufteilung). */
  debug?: Partial<ScheduleShiftSurchargeDebug>
}): number {
  const { supplement, buckets } = accumulateScheduleShiftSupplement(opts)
  const holOv = opts.holidayOverlay ?? null

  if (opts.debug && process.env.PAYROLL_SCHEDULE_DEBUG === '1') {
    const dateStr = String(opts.shiftDate).trim()
    const st = padHHMM(opts.startTime)
    const en = padHHMM(opts.endTime)
    const endYmd = shiftEndYmd(dateStr, st, en)
    const startMs = berlinWallClockToUtcMs(dateStr, st)
    const endMs = berlinWallClockToUtcMs(endYmd, en)
    const wage = Number(opts.hourlyWage)
    const wall0 = berlinWallClock(startMs)
    const isPH = isGermanPublicHolidayYmd(wall0.ymd, opts.federalState, holOv)
    const grossH = (endMs - startMs) / 3_600_000
    const netH = Math.max(0, grossH - (Number(opts.breakMinutes) || 0) / 60)
    const maxHolPct = Math.max(buckets.special_holiday.percent, buckets.holiday.percent)
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
      holidayBonusPercentApplied: maxHolPct,
      holidayBonusAmount: Math.round((buckets.special_holiday.amount + buckets.holiday.amount) * 100) / 100,
      sundayBonusAmount: Math.round(buckets.sunday.amount * 100) / 100,
      saturdayBonusAmount: Math.round(buckets.saturday.amount * 100) / 100,
      nightBonusAmount: Math.round(buckets.night.amount * 100) / 100,
      night04BonusAmount: Math.round(buckets.night04.amount * 100) / 100,
      totalBonuses: Math.round(supplement * 100) / 100,
    })
  }

  return supplement
}

type TimeEntrySupplementOpts = {
  employmentType: string
  emp: EmployeeSurchargeFields
  hourlyWage: number
  startIso: string
  endIso: string
  breakMinutes: number
  federalState: GermanState
  holidayOverlay?: StationHolidayOverlay | null
  stationRules?: StationPayrollSurchargeRules | null
  onlyBerlinYmd?: string
}

function dominantSurchargeKindForInstant(
  emp: EmployeeSurchargeFields,
  isoMs: number,
  state: GermanState,
  overlay?: StationHolidayOverlay | null,
  stationRules?: StationPayrollSurchargeRules | null,
): { kind: PayrollSupplementLineDebug['kind'] | null; percent: number } {
  const rules = rulesOrDefault(stationRules)
  const { ymd, hour, minute, weekday0Sun } = berlinWallClock(isoMs)
  const mod = toMinuteOfDay(hour, minute)
  const candidates: { kind: PayrollSupplementLineDebug['kind']; pct: number }[] = []

  const satPct = numOr0(emp.saturday_surcharge_percent)
  const sunPct = numOr0(emp.sunday_surcharge_percent)
  const nightPct = numOr0(emp.night_surcharge_percent)
  const n04 = numOr0(emp.night_0_4_surcharge_percent)
  const n04Sun = numOr0(emp.night_0_4_after_sunday_percent)
  const n04Hol = numOr0(emp.night_0_4_after_holiday_percent)
  const n04Spec = numOr0(emp.night_0_4_after_special_holiday_percent)

  const holidayTier = resolveHolidayPayrollTier(ymd, state, overlay, hour, minute)
  const isPublicHol = holidayTier !== 'none'
  const isDec31Afternoon = ymd.endsWith('-12-31') && hour >= 14

  if (weekday0Sun === 6 && satPct > 0 && allowSaturdayBonus(weekday0Sun, rules)) {
    candidates.push({ kind: 'saturday', pct: satPct })
  }
  if (weekday0Sun === 0 && sunPct > 0 && allowSundayBonus(weekday0Sun, rules)) {
    candidates.push({ kind: 'sunday', pct: sunPct })
  }
  const holSlice = resolveHolidaySlicePercent(holidayTier, emp)
  if (holSlice.percent > 0 && holSlice.kind) candidates.push({ kind: holSlice.kind, pct: holSlice.percent })

  const ns = parseHm(emp.night_surcharge_start)
  const ne = parseHm(emp.night_surcharge_end)
  if (
    ns &&
    ne &&
    nightPct > 0 &&
    allowNightTimeBonusOnInstant(weekday0Sun, ymd, hour, minute, state, overlay, rules)
  ) {
    const startM = toMinuteOfDay(ns.h, ns.m)
    const endM = toMinuteOfDay(ne.h, ne.m)
    if (minuteInSpan(mod, startM, endM)) candidates.push({ kind: 'night', pct: nightPct })
  }

  if (
    hour >= 0 &&
    hour < 4 &&
    n04 > 0 &&
    allowNightTimeBonusOnInstant(weekday0Sun, ymd, hour, minute, state, overlay, rules)
  ) {
    let p = n04
    if (weekday0Sun === 0 && n04Sun > p) p = n04Sun
    if (isPublicHol && n04Hol > p) p = n04Hol
    if (isDec31Afternoon && n04Spec > p) p = n04Spec
    candidates.push({ kind: 'night04', pct: p })
  }

  if (candidates.length === 0) return { kind: null, percent: 0 }
  const mode = String(emp.surcharge_calculation_mode ?? 'higher').toLowerCase()
  if (mode === 'stack' || mode === 'add' || mode === 'summe') {
    return { kind: candidates[0]!.kind, percent: candidates.reduce((s, c) => s + c.pct, 0) }
  }
  const best = candidates.reduce((a, b) => (b.pct > a.pct ? b : a))
  return { kind: best.kind, percent: best.pct }
}

function accumulateTimeEntrySupplement(opts: TimeEntrySupplementOpts): {
  supplement: number
  buckets: SupplementBreakdownBuckets
} {
  const et = String(opts.employmentType ?? '').toLowerCase().trim()
  if (et === 'aushilfe' || et === 'minijob' || et.includes('gering')) {
    return { supplement: 0, buckets: emptyBreakdownBuckets() }
  }
  const mode = String(opts.emp.surcharge_mode ?? 'none').toLowerCase()
  if (mode === 'none') return { supplement: 0, buckets: emptyBreakdownBuckets() }

  const wage = Number(opts.hourlyWage)
  if (!Number.isFinite(wage) || wage <= 0) return { supplement: 0, buckets: emptyBreakdownBuckets() }

  const start = new Date(opts.startIso).getTime()
  const end = new Date(opts.endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { supplement: 0, buckets: emptyBreakdownBuckets() }
  }

  const breakMs = Math.max(0, Number(opts.breakMinutes) || 0) * 60_000
  const workSpan = end - start - breakMs
  if (workSpan <= 0) return { supplement: 0, buckets: emptyBreakdownBuckets() }
  const workEnd = start + workSpan

  const STEP_MS = 5 * 60 * 1000
  let supplement = 0
  const buckets = emptyBreakdownBuckets()
  const ymdFilter = opts.onlyBerlinYmd?.trim()
  const holOv = opts.holidayOverlay ?? null

  for (let t = start; t < workEnd; t += STEP_MS) {
    const sliceEnd = Math.min(t + STEP_MS, workEnd)
    const hours = (sliceEnd - t) / 3_600_000
    const mid = (t + sliceEnd) / 2
    if (ymdFilter && berlinWallClock(mid).ymd !== ymdFilter) continue
    const pct = maxPercentForInstant(opts.emp, mid, opts.federalState, holOv, opts.stationRules)
    if (pct <= 0) continue
    const { kind } = dominantSurchargeKindForInstant(opts.emp, mid, opts.federalState, holOv, opts.stationRules)
    if (!kind) continue
    const a = hours * wage * (pct / 100)
    buckets[kind].hours += hours
    buckets[kind].amount += a
    buckets[kind].percent = Math.max(buckets[kind].percent, pct)
    supplement += a
  }

  return { supplement: Math.round(supplement * 100) / 100, buckets }
}

/** Zeiterfassungs-Zuschläge mit Aufschlüsselung (dominanter Satz je Scheibe). */
export function computeTimeEntrySupplementBreakdown(
  opts: TimeEntrySupplementOpts,
): { totalEuro: number; lines: PayrollSupplementLineDebug[]; buckets: SupplementBreakdownBuckets } {
  const { supplement, buckets } = accumulateTimeEntrySupplement(opts)
  const wage = Math.max(0, Number(opts.hourlyWage) || 0)
  return { totalEuro: supplement, lines: bucketsToLines(buckets, wage), buckets }
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
export function computeSupplementEurosForTimeEntry(opts: TimeEntrySupplementOpts): number {
  return accumulateTimeEntrySupplement(opts).supplement
}

/** Referenz-Tage mit Zuschlägen im Originalsystem (Aral Bodelshausen-Vergleich). */
export const ORIGINAL_SYSTEM_SUPPLEMENT_DATES = new Set(['2026-05-01', '2026-05-14'])

export function buildPayrollDaySupplementAudit(p: {
  date: string
  weekdayDe: string
  workHoursUsed: number
  vacationHours: number
  hourlyWage: number
  appliedBasis: 'schedule' | 'time_tracking' | 'none'
  scheduleLines: PayrollSupplementLineDebug[]
  timeTrackingLines: PayrollSupplementLineDebug[]
  scheduleTotalEuro: number
  timeTrackingTotalEuro: number
  federalState: GermanState
  holidayOverlay?: StationHolidayOverlay | null
}): PayrollDaySupplementAudit {
  const lines =
    p.appliedBasis === 'schedule'
      ? p.scheduleLines
      : p.appliedBasis === 'time_tracking'
        ? p.timeTrackingLines
        : []
  const dayTotalEuro =
    p.appliedBasis === 'schedule'
      ? p.scheduleTotalEuro
      : p.appliedBasis === 'time_tracking'
        ? p.timeTrackingTotalEuro
        : 0
  const linesSumEuro = Math.round(lines.reduce((s, l) => s + l.amountEuro, 0) * 100) / 100
  const isPH = isGermanPublicHolidayYmd(p.date, p.federalState, p.holidayOverlay)
  const isSpec = isSpecialHolidayYmd(p.date, p.holidayOverlay)
  const tier = resolveHolidayPayrollTier(p.date, p.federalState, p.holidayOverlay)
  const holName = isPH || isSpec ? publicHolidayNameDe(p.date, p.federalState, p.holidayOverlay) : ''

  const formulaParts = lines.map(
    (l) => `${l.hours.toFixed(2).replace('.', ',')} Std. × ${l.hourlyWage.toFixed(2).replace('.', ',')} € × ${l.percent} % = ${l.amountEuro.toFixed(2).replace('.', ',')} €`,
  )
  const notInOriginalSystem = dayTotalEuro > 0.001 && !ORIGINAL_SYSTEM_SUPPLEMENT_DATES.has(p.date)

  return {
    date: p.date,
    weekdayDe: p.weekdayDe,
    workHoursUsed: p.workHoursUsed,
    vacationHours: p.vacationHours,
    hourlyWage: Math.round(p.hourlyWage * 100) / 100,
    appliedBasis: p.appliedBasis,
    scheduleBasisEuro: Math.round(p.scheduleTotalEuro * 100) / 100,
    timeTrackingBasisEuro: Math.round(p.timeTrackingTotalEuro * 100) / 100,
    isPublicHoliday: isPH,
    isSpecialHoliday: isSpec,
    holidayNameDe: holName,
    holidayType: tier,
    lines,
    dayTotalEuro: Math.round(dayTotalEuro * 100) / 100,
    linesSumEuro,
    notInOriginalSystem,
    formulaSummary: formulaParts.length ? formulaParts.join(' · ') : '—',
  }
}
