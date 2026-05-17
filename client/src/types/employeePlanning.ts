export const WEEKDAY_AVAILABILITY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type WeekdayAvailabilityKey = (typeof WEEKDAY_AVAILABILITY_KEYS)[number]

export type WeekdayAvailabilityLevel = 'available' | 'preferred' | 'only_if_needed' | 'unavailable'

export type WeekdayAvailabilityMap = Record<WeekdayAvailabilityKey, WeekdayAvailabilityLevel>

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

export const WEEKDAY_AVAILABILITY_LABELS: Record<WeekdayAvailabilityLevel, string> = {
  available: 'Verfügbar',
  preferred: 'Bevorzugt',
  only_if_needed: 'Nur wenn nötig',
  unavailable: 'Nicht verfügbar',
}

export const PREFERRED_SHIFT_POLICY_OPTIONS: { value: PreferredShiftPolicy; label: string }[] = [
  { value: 'any', label: 'Egal' },
  { value: 'early_preferred', label: 'Frühschicht bevorzugt' },
  { value: 'late_preferred', label: 'Spätschicht bevorzugt' },
  { value: 'early_only', label: 'Nur Frühschicht' },
  { value: 'late_only', label: 'Nur Spätschicht' },
  { value: 'weekend_preferred', label: 'Wochenende bevorzugt' },
]

export const WEEKEND_DAY_PREFERENCE_OPTIONS: { value: WeekendDayPreference; label: string }[] = [
  { value: 'either', label: 'Samstag oder Sonntag' },
  { value: 'saturday', label: 'Nur Samstag' },
  { value: 'sunday', label: 'Nur Sonntag' },
]

export function defaultWeekdayAvailability(): WeekdayAvailabilityMap {
  return {
    monday: 'available',
    tuesday: 'available',
    wednesday: 'available',
    thursday: 'available',
    friday: 'available',
    saturday: 'available',
    sunday: 'available',
  }
}
