import type { GermanHoliday, GermanState } from '../data/germanHolidays'
import { GERMAN_HOLIDAYS } from '../data/germanHolidays'

export function getHolidaysForDate(date: string): GermanHoliday[] {
  return GERMAN_HOLIDAYS.filter((h) => h.date === date)
}

export function holidayAppliesToState(h: GermanHoliday, state: GermanState): boolean {
  if (h.scope === 'nationwide' || h.states === 'ALL') return true
  return Array.isArray(h.states) && h.states.includes(state)
}

export type RelevantHolidayResult = {
  hasHoliday: boolean
  relevantHolidays: GermanHoliday[]
  otherStateHolidays: GermanHoliday[]
}

export function getRelevantHolidayForState(
  date: string,
  state: GermanState,
): RelevantHolidayResult {
  const all = getHolidaysForDate(date)
  const relevantHolidays = all.filter((h) => holidayAppliesToState(h, state))
  const otherStateHolidays = all.filter((h) => !holidayAppliesToState(h, state))
  return {
    hasHoliday: relevantHolidays.length > 0,
    relevantHolidays,
    otherStateHolidays,
  }
}

function uniqueSortedStates(holidays: GermanHoliday[]): GermanState[] {
  const set = new Set<GermanState>()
  for (const h of holidays) {
    if (Array.isArray(h.states)) {
      for (const s of h.states) set.add(s)
    }
  }
  return [...set].sort()
}

function formatStateList(states: GermanState[], compact: boolean): string {
  if (states.length === 0) return ''
  return compact ? states.join('/') : states.join(', ')
}

export type HolidayBadgeSeverity = 'strong' | 'soft' | 'none'

export type HolidayBadge = {
  label: string
  subLabel: string
  severity: HolidayBadgeSeverity
  /** Legacy / semantische Tailwind-Hilfsklasse */
  colorClass: string
  /** Hinweis aus erstem relevanten Feiertag mit note (optional) */
  note?: string
}

export type FormatHolidayBadgeOptions = {
  variant?: 'full' | 'compact'
}

/**
 * Text + Schwere für die UI (Feiertag für Station vs. nur andere Länder).
 */
export function formatHolidayBadge(
  date: string,
  state: GermanState,
  options?: FormatHolidayBadgeOptions,
): HolidayBadge {
  const compact = options?.variant === 'compact'
  const { relevantHolidays, otherStateHolidays } = getRelevantHolidayForState(date, state)

  if (relevantHolidays.length > 0) {
    const subLabel = relevantHolidays.map((h) => h.name).join(' · ')
    const note = relevantHolidays.find((h) => h.note)?.note
    return {
      label: 'Feiertag',
      subLabel,
      severity: 'strong',
      colorClass: 'holiday-badge-strong',
      note,
    }
  }

  if (otherStateHolidays.length > 0) {
    const states = uniqueSortedStates(otherStateHolidays)
    const stateStr = formatStateList(states, compact)
    const names = otherStateHolidays.map((h) => h.name).join(' · ')
    const label = compact
      ? `Nur ${stateStr}`
      : `Feiertag nur in ${stateStr}`
    return {
      label,
      subLabel: names,
      severity: 'soft',
      colorClass: 'holiday-badge-soft',
    }
  }

  return {
    label: '',
    subLabel: '',
    severity: 'none',
    colorClass: '',
  }
}
