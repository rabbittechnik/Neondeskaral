import type { GermanState } from '../data/germanHolidays2026.js'
import { getHolidayBadgeForDate } from '../data/germanHolidays2026.js'

export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number]

export type WeekdayAvailabilityLevel = 'available' | 'preferred' | 'only_if_needed' | 'unavailable'

export type WeekdayAvailabilityMap = Record<WeekdayKey, WeekdayAvailabilityLevel>

export type PreferredShiftPolicy =
  | 'any'
  | 'early_preferred'
  | 'late_preferred'
  | 'early_only'
  | 'late_only'
  | 'weekend_preferred'

export type WeekendDayPreference = 'either' | 'saturday' | 'sunday'

export type ReserveConditions = {
  staffShortage?: boolean
  monthHoursFree?: boolean
  mainStaffAbsent?: boolean
  manualConfirmOnly?: boolean
  warnNotAuto?: boolean
}

export type EmployeePlanningRules = {
  desiredShiftsPerMonth?: number | null
  minShiftsPerMonth?: number | null
  maxShiftsPerMonth?: number | null
  desiredWeekendsPerMonth?: number | null
  weekendDayPreference?: WeekendDayPreference
  preferredShiftPolicy?: PreferredShiftPolicy
  weekdayAvailability: WeekdayAvailabilityMap
  reserveEnabled: boolean
  reserveConditions: ReserveConditions
  planningNotes?: string
  /** Legacy-Felder (weiterhin unterstützt) */
  preferredShiftTypes: string[]
  preferredWorkDays: string[]
  notPreferredWorkDays: string[]
  canWorkWeekends: boolean
  canWorkHolidays: boolean
  maxPreferredDaysPerWeek?: number | null
  maxWeeklyHours?: number | null
}

export type AssistantSlotKind = 'early' | 'late' | 'night' | 'middle' | 'short' | 'school'

const DEFAULT_WEEKDAY: WeekdayAvailabilityMap = {
  monday: 'available',
  tuesday: 'available',
  wednesday: 'available',
  thursday: 'available',
  friday: 'available',
  saturday: 'available',
  sunday: 'available',
}

export function defaultWeekdayAvailability(): WeekdayAvailabilityMap {
  return { ...DEFAULT_WEEKDAY }
}

export function parseWeekdayAvailabilityJson(raw: string | null | undefined): WeekdayAvailabilityMap | null {
  if (!raw?.trim()) return null
  try {
    const o = JSON.parse(raw) as Record<string, string>
    const out = defaultWeekdayAvailability()
    for (const k of WEEKDAY_KEYS) {
      const v = o[k]
      if (v === 'available' || v === 'preferred' || v === 'only_if_needed' || v === 'unavailable') {
        out[k] = v
      }
    }
    return out
  } catch {
    return null
  }
}

export function parseReserveConditionsJson(raw: string | null | undefined): ReserveConditions {
  if (!raw?.trim()) return {}
  try {
    return JSON.parse(raw) as ReserveConditions
  } catch {
    return {}
  }
}

export function parsePreferredShiftPolicy(raw: string | null | undefined): PreferredShiftPolicy {
  const v = String(raw ?? 'any').trim() as PreferredShiftPolicy
  const allowed: PreferredShiftPolicy[] = [
    'any',
    'early_preferred',
    'late_preferred',
    'early_only',
    'late_only',
    'weekend_preferred',
  ]
  return allowed.includes(v) ? v : 'any'
}

export function parseWeekendDayPreference(raw: string | null | undefined): WeekendDayPreference {
  const v = String(raw ?? 'either').trim() as WeekendDayPreference
  return v === 'saturday' || v === 'sunday' ? v : 'either'
}

/** Bestehende einfache Wünsche in Tages-Stufen übernehmen (nur wenn noch kein JSON gespeichert). */
export function deriveWeekdayAvailabilityFromLegacy(emp: {
  preferredWorkDays?: string[]
  notPreferredWorkDays?: string[]
  canWorkWeekends?: boolean
}): WeekdayAvailabilityMap {
  const map = defaultWeekdayAvailability()
  for (const k of WEEKDAY_KEYS) {
    if ((emp.notPreferredWorkDays ?? []).includes(k)) {
      map[k] = 'unavailable'
    } else if ((emp.preferredWorkDays ?? []).includes(k)) {
      map[k] = 'preferred'
    }
  }
  if (emp.canWorkWeekends === false) {
    map.saturday = 'unavailable'
    map.sunday = 'unavailable'
  }
  return map
}

export function buildPlanningRulesFromRow(row: Record<string, unknown>): EmployeePlanningRules {
  const parsed =
    parseWeekdayAvailabilityJson(row.weekday_availability_json as string | undefined) ??
    deriveWeekdayAvailabilityFromLegacy({
      preferredWorkDays: parseJsonArray(row.preferred_work_days_json),
      notPreferredWorkDays: parseJsonArray(row.not_preferred_work_days_json),
      canWorkWeekends: (row.can_work_weekends ?? 1) !== 0,
    })

  return {
    desiredShiftsPerMonth: optInt(row.desired_shifts_per_month),
    minShiftsPerMonth: optInt(row.min_shifts_per_month),
    maxShiftsPerMonth: optInt(row.max_shifts_per_month),
    desiredWeekendsPerMonth: optInt(row.desired_weekends_per_month),
    weekendDayPreference: parseWeekendDayPreference(row.weekend_day_preference as string),
    preferredShiftPolicy: parsePreferredShiftPolicy(row.preferred_shift_policy as string),
    weekdayAvailability: parsed,
    reserveEnabled: (row.reserve_enabled ?? 0) === 1,
    reserveConditions: parseReserveConditionsJson(row.reserve_conditions_json as string),
    planningNotes: String(row.planning_notes ?? ''),
    preferredShiftTypes: parseJsonArray(row.preferred_shift_types_json),
    preferredWorkDays: parseJsonArray(row.preferred_work_days_json),
    notPreferredWorkDays: parseJsonArray(row.not_preferred_work_days_json),
    canWorkWeekends: (row.can_work_weekends ?? 1) !== 0,
    canWorkHolidays: (row.can_work_holidays ?? 1) !== 0,
    maxPreferredDaysPerWeek: optNum(row.max_preferred_days_per_week),
    maxWeeklyHours: optNum(row.max_weekly_hours),
  }
}

function parseJsonArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const a = JSON.parse(raw)
    return Array.isArray(a) ? a.map(String) : []
  } catch {
    return []
  }
}

function optInt(v: unknown): number | null | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? Math.floor(n) : undefined
}

function optNum(v: unknown): number | null | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function isoWeekdayKey(dateIso: string): WeekdayKey {
  const d = new Date(`${dateIso}T12:00:00`)
  const map: WeekdayKey[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]
  return map[d.getDay()]!
}

export function isWeekendKey(k: WeekdayKey): boolean {
  return k === 'saturday' || k === 'sunday'
}

function kindMatchesPolicy(kind: AssistantSlotKind, policy: PreferredShiftPolicy): boolean {
  if (policy === 'any' || policy === 'weekend_preferred') return true
  if (policy === 'early_only' || policy === 'early_preferred') {
    return kind === 'early' || kind === 'school' || kind === 'short'
  }
  if (policy === 'late_only' || policy === 'late_preferred') {
    return kind === 'late' || kind === 'night' || kind === 'middle'
  }
  return true
}

function legacyPrefKindMatches(pref: string[], kind: AssistantSlotKind, date: string, federalState: GermanState): boolean {
  if (pref.includes('weekend') && isWeekendKey(isoWeekdayKey(date))) return true
  if (pref.includes('holiday') || pref.includes('feiertag')) {
    if (getHolidayBadgeForDate(date, federalState).severity === 'strong') return true
  }
  const map: Record<AssistantSlotKind, string> = {
    early: 'early',
    late: 'late',
    night: 'night',
    middle: 'middle',
    short: 'short',
    school: 'school',
  }
  return pref.includes(map[kind])
}

export type PlanningEvaluateInput = {
  rules: EmployeePlanningRules
  slot: { date: string; kind: AssistantSlotKind; workAreaId: string }
  federalState: GermanState
  /** Arbeitstage im Monat nach Zuweisung */
  monthShiftDaysAfter: number
  /** Geplante Monatsstunden nach Zuweisung */
  monthHoursAfter: number
  maxHoursPerMonth?: number | null
  weekendDaysInMonthAfter: number
  weeklyMinutesAfter: number
  weeklyContractMinutes: number
  maxWeeklyMinutes?: number
  assignedDaysThisWeek: number
  isOpenShiftFill: boolean
  mainStaffAbsentOnDay: boolean
  hasWorkArea: boolean
}

export type PlanningEvaluateResult = {
  allowed: boolean
  score: number
  level: 'good' | 'warn' | 'bad'
  hints: string[]
  warnings: string[]
  isReserve: boolean
}

function reserveAllowed(rules: EmployeePlanningRules, ctx: Omit<PlanningEvaluateInput, 'rules'>): boolean {
  if (!rules.reserveEnabled) return false
  const c = rules.reserveConditions
  if (c.manualConfirmOnly) return false
  let ok = true
  if (c.staffShortage && !ctx.isOpenShiftFill) ok = false
  if (c.mainStaffAbsent && !ctx.mainStaffAbsentOnDay) ok = false
  if (c.monthHoursFree && ctx.maxHoursPerMonth != null && ctx.maxHoursPerMonth > 0) {
    if (ctx.monthHoursAfter > ctx.maxHoursPerMonth * 0.98) ok = false
  }
  return ok
}

export function evaluatePlanningAssignment(input: PlanningEvaluateInput): PlanningEvaluateResult {
  const { rules } = input
  const wd = isoWeekdayKey(input.slot.date)
  const weekend = isWeekendKey(wd)
  const hints: string[] = []
  const warnings: string[] = []
  let score = 0
  let isReserve = false

  const dayLevel = rules.weekdayAvailability[wd] ?? 'available'

  if (dayLevel === 'unavailable') {
    if (!reserveAllowed(rules, input)) {
      return {
        allowed: false,
        score: -1000,
        level: 'bad',
        hints: ['Tag nicht verfügbar'],
        warnings: [],
        isReserve: false,
      }
    }
    isReserve = true
    score -= 35
    hints.push('Reserve: normalerweise nicht verfügbar')
    warnings.push(
      `Reserve-Einsatz an ${wd}: Mitarbeiter ist an diesem Wochentag als nicht verfügbar markiert.`,
    )
  }

  if (dayLevel === 'only_if_needed') {
    if (reserveAllowed(rules, input) && (input.isOpenShiftFill || input.mainStaffAbsentOnDay)) {
      isReserve = true
      score -= 15
      hints.push('Reserve: nur wenn nötig')
      if (input.mainStaffAbsentOnDay) {
        warnings.push('Reserve-Einsatz, weil Hauptpersonal abwesend ist.')
      } else if (input.isOpenShiftFill) {
        warnings.push('Reserve-Einsatz wegen offener Schicht / Personalmangel.')
      }
    } else {
      score -= 30
      hints.push('nur wenn nötig (nicht bevorzugt)')
    }
  }

  if (dayLevel === 'preferred') {
    score += 20
    hints.push('bevorzugter Tag')
  }

  const policy = rules.preferredShiftPolicy ?? 'any'
  if (policy === 'weekend_preferred' && weekend) {
    score += 15
    hints.push('Wochenende bevorzugt (Richtlinie)')
  }
  if (kindMatchesPolicy(input.slot.kind, policy)) {
    score += policy.includes('preferred') ? 20 : 0
    if (policy.includes('early')) hints.push('Frühschicht passt zur Richtlinie')
    if (policy.includes('late')) hints.push('Spätschicht passt zur Richtlinie')
  } else if (policy === 'early_only' || policy === 'late_only') {
    if (!isReserve || !reserveAllowed(rules, input)) {
      return {
        allowed: false,
        score: -1000,
        level: 'bad',
        hints: [`Schichtart ${input.slot.kind} nicht erlaubt (Richtlinie ${policy})`],
        warnings: [],
        isReserve: false,
      }
    }
    isReserve = true
    score -= 25
    hints.push('Reserve: andere Schichtart')
    warnings.push(`Reserve-Einsatz mit abweichender Schichtart (${input.slot.kind}).`)
  } else if (policy === 'early_preferred' || policy === 'late_preferred') {
    score -= 10
    hints.push('Schichtart nicht bevorzugt')
  }

  if (legacyPrefKindMatches(rules.preferredShiftTypes, input.slot.kind, input.slot.date, input.federalState)) {
    score += 15
    hints.push('bevorzugte Schichtart (Profil)')
  }
  if ((rules.preferredWorkDays ?? []).includes(wd)) {
    score += 10
  }
  if ((rules.notPreferredWorkDays ?? []).includes(wd)) {
    score -= 25
    hints.push('nicht bevorzugter Tag (Profil)')
  }

  if (weekend && rules.canWorkWeekends) score += 8
  if (weekend && !rules.canWorkWeekends) {
    if (!isReserve || !reserveAllowed(rules, input)) {
      score -= 40
      hints.push('Wochenende nicht freigegeben')
    }
  }

  const desired = rules.desiredShiftsPerMonth
  const maxShifts = rules.maxShiftsPerMonth ?? desired
  if (maxShifts != null && maxShifts > 0 && input.monthShiftDaysAfter > maxShifts) {
    return {
      allowed: false,
      score: -1000,
      level: 'bad',
      hints: [`Max. ${maxShifts} Arbeitstage/Monat überschritten`],
      warnings: [],
      isReserve: false,
    }
  }
  if (desired != null && desired > 0 && input.monthShiftDaysAfter > desired) {
    score -= 50
    hints.push(`über Wunsch-Arbeitstage (${input.monthShiftDaysAfter}/${desired})`)
    warnings.push(
      `Mitarbeiter wurde über die gewünschte Monats-Häufigkeit geplant: ${input.monthShiftDaysAfter} statt ${desired} Arbeitstag(e).`,
    )
  }

  const desiredWe = rules.desiredWeekendsPerMonth
  if (desiredWe != null && desiredWe > 0 && weekend && input.weekendDaysInMonthAfter > desiredWe) {
    score -= 20
    hints.push('viele Wochenend-Tage im Monat')
  }

  if (rules.weekendDayPreference === 'saturday' && wd === 'sunday') score -= 8
  if (rules.weekendDayPreference === 'sunday' && wd === 'saturday') score -= 8

  if (input.maxHoursPerMonth != null && input.maxHoursPerMonth > 0 && input.monthHoursAfter > input.maxHoursPerMonth + 1e-6) {
    return {
      allowed: false,
      score: -1000,
      level: 'bad',
      hints: ['Monatsstunden-Limit überschritten'],
      warnings: [],
      isReserve: false,
    }
  }

  if (input.maxHoursPerMonth != null && input.maxHoursPerMonth > 0 && isReserve) {
    const remaining = input.maxHoursPerMonth - input.monthHoursAfter
    if (remaining < 0) {
      return {
        allowed: false,
        score: -1000,
        level: 'bad',
        hints: ['Monatsstunden für Reserve nicht mehr frei'],
        warnings: [],
        isReserve: false,
      }
    }
    if (rules.reserveConditions.monthHoursFree && remaining < 2) {
      score -= 10
      hints.push('wenig Monatsstunden frei')
    }
  }

  const cap = input.maxWeeklyMinutes ?? input.weeklyContractMinutes * 1.05
  if (input.weeklyMinutesAfter > cap) {
    score -= 50
    hints.push('Wochenstunden überschritten')
  } else if (input.weeklyMinutesAfter <= input.weeklyContractMinutes * 0.9) {
    score += 10
  }

  const maxDaysWeek = rules.maxPreferredDaysPerWeek
  if (maxDaysWeek != null && input.assignedDaysThisWeek > maxDaysWeek) {
    score -= 15
    hints.push('viele Arbeitstage in der Woche')
  }

  if (input.hasWorkArea) score += 5
  else score -= 5

  if (rules.reserveConditions.warnNotAuto && isReserve) {
    score -= 5
    hints.push('Reserve (Hinweis im Profil)')
  }

  let level: 'good' | 'warn' | 'bad' = 'good'
  if (score < 0 || isReserve) level = 'warn'
  if (score < -40) level = 'bad'

  const allowed = score > -500

  return { allowed, score, level, hints, warnings, isReserve }
}

export function countWeekendDaysInMonth(
  monthShiftRows: { employee_id: string | null; date: string }[],
  employeeId: string,
  proposed: { employeeId: string; date: string }[],
): number {
  const days = new Set<string>()
  for (const r of monthShiftRows) {
    if (r.employee_id !== employeeId) continue
    if (isWeekendKey(isoWeekdayKey(r.date))) days.add(r.date)
  }
  for (const p of proposed) {
    if (p.employeeId !== employeeId) continue
    if (isWeekendKey(isoWeekdayKey(p.date))) days.add(p.date)
  }
  return days.size
}

export function buildPlanningRulesFromEmployee(emp: {
  preferredShiftTypes?: string[]
  preferredWorkDays?: string[]
  notPreferredWorkDays?: string[]
  canWorkWeekends?: boolean
  canWorkHolidays?: boolean
  maxPreferredDaysPerWeek?: number | null
  maxWeeklyHours?: number | null
  planningNotes?: string
  desiredShiftsPerMonth?: number | null
  minShiftsPerMonth?: number | null
  maxShiftsPerMonth?: number | null
  desiredWeekendsPerMonth?: number | null
  weekendDayPreference?: WeekendDayPreference
  preferredShiftPolicy?: PreferredShiftPolicy
  weekdayAvailability?: WeekdayAvailabilityMap | null
  reserveEnabled?: boolean
  reserveConditions?: ReserveConditions
}): EmployeePlanningRules {
  const weekdayAvailability =
    emp.weekdayAvailability ?? deriveWeekdayAvailabilityFromLegacy(emp)
  return {
    desiredShiftsPerMonth: emp.desiredShiftsPerMonth,
    minShiftsPerMonth: emp.minShiftsPerMonth,
    maxShiftsPerMonth: emp.maxShiftsPerMonth,
    desiredWeekendsPerMonth: emp.desiredWeekendsPerMonth,
    weekendDayPreference: emp.weekendDayPreference ?? 'either',
    preferredShiftPolicy: emp.preferredShiftPolicy ?? 'any',
    weekdayAvailability,
    reserveEnabled: Boolean(emp.reserveEnabled),
    reserveConditions: emp.reserveConditions ?? {},
    planningNotes: emp.planningNotes ?? '',
    preferredShiftTypes: emp.preferredShiftTypes ?? [],
    preferredWorkDays: emp.preferredWorkDays ?? [],
    notPreferredWorkDays: emp.notPreferredWorkDays ?? [],
    canWorkWeekends: emp.canWorkWeekends !== false,
    canWorkHolidays: emp.canWorkHolidays !== false,
    maxPreferredDaysPerWeek: emp.maxPreferredDaysPerWeek,
    maxWeeklyHours: emp.maxWeeklyHours,
  }
}

export function countMonthShiftDays(
  monthShiftRows: { employee_id: string | null; date: string; shift_type?: string | null }[],
  employeeId: string,
  proposed: { employeeId: string; date: string }[],
): number {
  const days = new Set<string>()
  for (const r of monthShiftRows) {
    if (r.employee_id !== employeeId) continue
    if (String(r.shift_type ?? '').trim() === 'frei') continue
    days.add(r.date)
  }
  for (const p of proposed) {
    if (p.employeeId !== employeeId) days.add(p.date)
  }
  return days.size
}
