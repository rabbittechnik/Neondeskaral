/** Kurzlabels für Chips & Listen. */
export const SHIFT_PREF_IDS = [
  'early',
  'middle',
  'late',
  'night',
  'short',
  'school',
  'special',
] as const

export type ShiftPrefId = (typeof SHIFT_PREF_IDS)[number]

export const SHIFT_PREF_LABELS: Record<ShiftPrefId, string> = {
  early: 'Früh',
  middle: 'Mittel',
  late: 'Spät',
  night: 'Nacht',
  short: 'Kurz',
  school: 'Schule',
  special: 'Sonder',
}

export const WEEKDAY_IDS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type WeekdayPrefId = (typeof WEEKDAY_IDS)[number]

export const WEEKDAY_SHORT: Record<WeekdayPrefId, string> = {
  monday: 'Mo',
  tuesday: 'Di',
  wednesday: 'Mi',
  thursday: 'Do',
  friday: 'Fr',
  saturday: 'Sa',
  sunday: 'So',
}

export function formatShiftPrefList(ids: string[]): string {
  return ids
    .map((id) => SHIFT_PREF_LABELS[id as ShiftPrefId] ?? id)
    .filter(Boolean)
    .join(', ')
}

export function formatWeekdayPrefList(ids: string[]): string {
  return ids.map((id) => WEEKDAY_SHORT[id as WeekdayPrefId] ?? id).join(', ')
}
