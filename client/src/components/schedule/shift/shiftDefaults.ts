import type { ShiftTypeId } from '../../../data/mockSchedule'

/** Schichttypen im Modal (Formular); Legacy-Typen bleiben in Dummy-Daten erlaubt. */
export const FORM_SHIFT_TYPES: ShiftTypeId[] = [
  'frueh',
  'spaet',
  'nacht',
  'schule',
  'frei',
  'sonderdienst',
]

export function suggestedTimesForType(
  type: ShiftTypeId,
): { start: string; end: string } {
  switch (type) {
    case 'frueh':
      return { start: '05:30', end: '14:00' }
    case 'spaet':
      return { start: '14:00', end: '21:15' }
    case 'nacht':
      return { start: '22:00', end: '06:00' }
    case 'schule':
      return { start: '08:00', end: '14:00' }
    case 'frei':
      return { start: '', end: '' }
    case 'sonderdienst':
      return { start: '08:00', end: '16:00' }
    default:
      return { start: '08:00', end: '16:00' }
  }
}
