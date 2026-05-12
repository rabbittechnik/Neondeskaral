/** Mirrors client `mockSchedule` templates for deterministic DB seed (ISO week). */

export type WeekDayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type ShiftTypeId =
  | 'frueh'
  | 'spaet'
  | 'nacht'
  | 'schule'
  | 'sonderdienst'
  | 'frei'
  | 'konflikt'
  | 'mittel'
  | 'kurz'

export type ShiftBlockTemplate = {
  employeeId: string
  dayIndex: WeekDayIndex
  type: ShiftTypeId
  start: string
  end: string
  workAreaCode: string
  status?: 'Entwurf' | 'Veröffentlicht'
  conflict?: boolean
}

export const shiftBlockTemplates: ShiftBlockTemplate[] = [
  { employeeId: 'e1', dayIndex: 0, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'B', status: 'Veröffentlicht' },
  { employeeId: 'e1', dayIndex: 1, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K', status: 'Veröffentlicht' },
  { employeeId: 'e1', dayIndex: 2, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K', status: 'Veröffentlicht' },
  { employeeId: 'e1', dayIndex: 3, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e1', dayIndex: 4, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e1', dayIndex: 5, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e1', dayIndex: 6, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e2', dayIndex: 0, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'Ba', status: 'Veröffentlicht' },
  { employeeId: 'e2', dayIndex: 1, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e2', dayIndex: 2, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e2', dayIndex: 3, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e2', dayIndex: 4, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'W' },
  { employeeId: 'e2', dayIndex: 5, type: 'kurz', start: '07:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e2', dayIndex: 6, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e3', dayIndex: 0, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e3', dayIndex: 1, type: 'schule', start: '08:00', end: '14:00', workAreaCode: 'Sch' },
  { employeeId: 'e3', dayIndex: 2, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e3', dayIndex: 3, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K', conflict: true },
  { employeeId: 'e3', dayIndex: 3, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'Ba', conflict: true },
  { employeeId: 'e3', dayIndex: 4, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e3', dayIndex: 5, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e3', dayIndex: 6, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e4', dayIndex: 0, type: 'nacht', start: '22:00', end: '06:00', workAreaCode: 'K' },
  { employeeId: 'e4', dayIndex: 1, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e4', dayIndex: 2, type: 'nacht', start: '22:00', end: '06:00', workAreaCode: 'K' },
  { employeeId: 'e4', dayIndex: 3, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e4', dayIndex: 4, type: 'nacht', start: '22:00', end: '06:00', workAreaCode: 'L' },
  { employeeId: 'e4', dayIndex: 5, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e4', dayIndex: 6, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'A' },
  { employeeId: 'e5', dayIndex: 0, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e5', dayIndex: 1, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e5', dayIndex: 2, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'Ba' },
  { employeeId: 'e5', dayIndex: 3, type: 'schule', start: '08:00', end: '14:00', workAreaCode: 'Sch' },
  { employeeId: 'e5', dayIndex: 4, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e5', dayIndex: 5, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e5', dayIndex: 6, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e6', dayIndex: 0, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e6', dayIndex: 1, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e6', dayIndex: 2, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e6', dayIndex: 3, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'W' },
  { employeeId: 'e6', dayIndex: 4, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e6', dayIndex: 5, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e6', dayIndex: 6, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e7', dayIndex: 0, type: 'mittel', start: '08:00', end: '14:15', workAreaCode: 'K' },
  { employeeId: 'e7', dayIndex: 1, type: 'mittel', start: '08:00', end: '14:15', workAreaCode: 'Ba' },
  { employeeId: 'e7', dayIndex: 2, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e7', dayIndex: 3, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e7', dayIndex: 4, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e7', dayIndex: 5, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e7', dayIndex: 6, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'A' },
  { employeeId: 'e8', dayIndex: 0, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
  { employeeId: 'e8', dayIndex: 1, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'L' },
  { employeeId: 'e8', dayIndex: 2, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e8', dayIndex: 3, type: 'spaet', start: '14:00', end: '21:15', workAreaCode: 'K' },
  { employeeId: 'e8', dayIndex: 4, type: 'frueh', start: '05:30', end: '14:00', workAreaCode: 'K' },
  { employeeId: 'e8', dayIndex: 5, type: 'nacht', start: '22:00', end: '06:00', workAreaCode: 'K' },
  { employeeId: 'e8', dayIndex: 6, type: 'frei', start: '00:00', end: '00:00', workAreaCode: '' },
]

export const openShiftSlots: {
  dayIndex: WeekDayIndex
  shiftType: ShiftTypeId
  start: string
  end: string
  code: string
}[] = [
  { dayIndex: 4, shiftType: 'spaet', start: '14:00', end: '21:15', code: 'W' },
  { dayIndex: 5, shiftType: 'frueh', start: '05:30', end: '14:00', code: 'K' },
  { dayIndex: 6, shiftType: 'nacht', start: '22:00', end: '06:00', code: 'K' },
]

const SHORT_TO_AREA: Record<string, string> = {
  B: 'buero',
  K: 'kasse',
  Ba: 'backshop',
  L: 'lager',
  W: 'wasch',
  A: 'aussen',
  Sch: 'schule',
  Re: 'reinigung',
}

export function workAreaIdFromShortCode(code: string): string {
  if (!code) return 'reinigung'
  return SHORT_TO_AREA[code] ?? 'reinigung'
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}
