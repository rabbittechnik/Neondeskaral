import type { PayrollHolidayCategory, PayrollHolidaySpecialRuleTier } from './payrollHolidayCategory.js'
import { categoryToPayrollTier } from './payrollHolidayCategory.js'

/** Eine aktive Feiertagsregel aus der Stationsverwaltung. */
export type StationHolidayRule = {
  date: string
  name: string
  payrollCategory: PayrollHolidayCategory
  specialRuleTier: PayrollHolidaySpecialRuleTier | null
  allDay: boolean
  timeStart: string | null
  timeEnd: string | null
  referencePercent: number | null
  active: boolean
}

export type StationHolidayOverlay = {
  rules: StationHolidayRule[]
  /** @deprecated Legacy-Sets – nur noch für Abwärtskompatibilität während Migration */
  extraPublicDates: Set<string>
  extraNames: Map<string, string>
  specialAllDayDates: Set<string>
}

export function emptyStationHolidayOverlay(): StationHolidayOverlay {
  return {
    rules: [],
    extraPublicDates: new Set(),
    extraNames: new Map(),
    specialAllDayDates: new Set(),
  }
}

function parseHm(s: string | null | undefined): number | null {
  if (!s?.trim()) return null
  const [h, m] = s.trim().split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function momentInRuleWindow(rule: StationHolidayRule, hour: number, minute: number): boolean {
  if (!rule.active || rule.payrollCategory === 'none') return false
  if (rule.allDay) return true
  const mod = hour * 60 + minute
  const start = parseHm(rule.timeStart) ?? 0
  const end = parseHm(rule.timeEnd) ?? 24 * 60 - 1
  if (start <= end) return mod >= start && mod <= end
  return mod >= start || mod <= end
}

/** Höchste Feiertagsstufe für einen Zeitpunkt (special > regular > none). */
export function resolveHolidayTierAtMoment(
  ymd: string,
  hour: number,
  minute: number,
  overlay: StationHolidayOverlay | null | undefined,
): 'none' | 'regular' | 'special' {
  const dayRules = overlay?.rules.filter((r) => r.date === ymd) ?? []
  let best: 'none' | 'regular' | 'special' = 'none'
  for (const rule of dayRules) {
    if (!momentInRuleWindow(rule, hour, minute)) continue
    const tier = categoryToPayrollTier(rule.payrollCategory, rule.specialRuleTier)
    if (tier === 'special') return 'special'
    if (tier === 'regular') best = 'regular'
  }
  return best
}

export function holidayNameAtMoment(
  ymd: string,
  hour: number,
  minute: number,
  overlay: StationHolidayOverlay | null | undefined,
): string {
  const names = overlay?.rules
    .filter((r) => r.date === ymd && momentInRuleWindow(r, hour, minute))
    .map((r) => r.name)
  if (names?.length) return [...new Set(names)].join(' · ')
  return overlay?.extraNames.get(ymd) ?? ''
}

export function isActiveHolidayDate(ymd: string, overlay: StationHolidayOverlay | null | undefined): boolean {
  return resolveHolidayTierAtMoment(ymd, 12, 0, overlay) !== 'none'
}
