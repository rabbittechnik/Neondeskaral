/** Dummy-Daten für das Schichtplan-Frontend (ohne API/DB). */

export const STATION_NAME = 'Aral Bodelshausen'

export type ShiftTypeId =
  | 'frueh'
  | 'spaet'
  | 'nacht'
  | 'schule'
  | 'frei'
  | 'konflikt'
  | 'mittel'
  | 'kurz'

export type ShiftTypeDef = {
  id: ShiftTypeId
  label: string
  legendTime?: string
  cardClass: string
  glowClass: string
}

export const shiftTypes: ShiftTypeDef[] = [
  {
    id: 'frueh',
    label: 'Früh',
    legendTime: '05:30–14:00',
    cardClass: 'bg-emerald-500/25 text-emerald-100 border-emerald-400/50',
    glowClass: 'shadow-[0_0_16px_rgba(52,211,153,0.35)]',
  },
  {
    id: 'spaet',
    label: 'Spät',
    legendTime: '14:00–21:15',
    cardClass: 'bg-sky-600/30 text-sky-50 border-sky-400/50',
    glowClass: 'shadow-[0_0_16px_rgba(56,189,248,0.35)]',
  },
  {
    id: 'nacht',
    label: 'Nacht',
    legendTime: '22:00–06:00',
    cardClass: 'bg-violet-600/35 text-violet-50 border-violet-400/50',
    glowClass: 'shadow-[0_0_16px_rgba(167,139,250,0.35)]',
  },
  {
    id: 'schule',
    label: 'Schule',
    legendTime: '08:00–14:00',
    cardClass: 'bg-cyan-500/25 text-cyan-50 border-cyan-400/55',
    glowClass: 'shadow-[0_0_16px_rgba(34,211,238,0.35)]',
  },
  {
    id: 'mittel',
    label: 'Mittel',
    legendTime: '08:00–14:15',
    cardClass: 'bg-sky-500/25 text-sky-50 border-sky-300/45',
    glowClass: 'shadow-[0_0_14px_rgba(125,211,252,0.3)]',
  },
  {
    id: 'kurz',
    label: 'Kurz',
    legendTime: '07:30–14:00',
    cardClass: 'bg-teal-500/25 text-teal-50 border-teal-400/45',
    glowClass: 'shadow-[0_0_14px_rgba(45,212,191,0.28)]',
  },
  {
    id: 'frei',
    label: 'Frei',
    cardClass: 'bg-white/[0.04] text-[var(--text-faint)] border-white/10',
    glowClass: '',
  },
  {
    id: 'konflikt',
    label: 'Konflikt',
    legendTime: 'Warnung',
    cardClass:
      'bg-gradient-to-br from-red-500/30 to-orange-500/20 text-orange-50 border-orange-400/60',
    glowClass: 'shadow-[0_0_18px_rgba(251,113,133,0.45)]',
  },
]

export function getShiftTypeDef(id: ShiftTypeId): ShiftTypeDef {
  return shiftTypes.find((t) => t.id === id) ?? shiftTypes[0]
}

export type WorkArea = {
  id: string
  shortCode: string
  label: string
}

export const workAreas: WorkArea[] = [
  { id: 'kasse', shortCode: 'K', label: 'Kasse' },
  { id: 'buero', shortCode: 'B', label: 'Büro' },
  { id: 'backshop', shortCode: 'Ba', label: 'Backshop' },
  { id: 'aussen', shortCode: 'A', label: 'Außenbereich' },
  { id: 'wasch', shortCode: 'W', label: 'Waschanlage' },
  { id: 'lager', shortCode: 'L', label: 'Lager' },
  { id: 'schule', shortCode: 'Sch', label: 'Schule' },
  { id: 'sonst', shortCode: 'S', label: 'Sonstiges' },
]

export function workAreaLabel(code: string): string {
  if (!code) return ''
  const w = workAreas.find((a) => a.shortCode === code)
  return w?.label ?? code
}

export type Employee = {
  id: string
  name: string
  role: string
  accentColor: string
}

export const employees: Employee[] = [
  {
    id: 'e1',
    name: 'Mathias Raselowski',
    role: 'Schichtleiter',
    accentColor: '#22d3ee',
  },
  {
    id: 'e2',
    name: 'Bianca Hornung',
    role: 'Verkäufer',
    accentColor: '#a3e635',
  },
  { id: 'e3', name: 'Max Vins', role: 'Verkäufer', accentColor: '#f472b6' },
  {
    id: 'e4',
    name: 'Metin Özgür',
    role: 'Schichtleiter',
    accentColor: '#c084fc',
  },
  { id: 'e5', name: 'Enise A.', role: 'Aushilfe', accentColor: '#fbbf24' },
  { id: 'e6', name: 'Chiara H.', role: 'Verkäufer', accentColor: '#38bdf8' },
  { id: 'e7', name: 'Luca Stöck', role: 'Verkäufer', accentColor: '#34d399' },
  {
    id: 'e8',
    name: 'Valerina Mustafa',
    role: 'Aushilfe',
    accentColor: '#fb923c',
  },
]

export type WeekDayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

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
  {
    employeeId: 'e1',
    dayIndex: 0,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'B',
    status: 'Veröffentlicht',
  },
  {
    employeeId: 'e1',
    dayIndex: 1,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
    status: 'Veröffentlicht',
  },
  {
    employeeId: 'e1',
    dayIndex: 2,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
    status: 'Veröffentlicht',
  },
  {
    employeeId: 'e1',
    dayIndex: 3,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e1',
    dayIndex: 4,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  { employeeId: 'e1', dayIndex: 5, type: 'frei', start: '', end: '', workAreaCode: '' },
  { employeeId: 'e1', dayIndex: 6, type: 'frei', start: '', end: '', workAreaCode: '' },

  {
    employeeId: 'e2',
    dayIndex: 0,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'Ba',
    status: 'Veröffentlicht',
  },
  {
    employeeId: 'e2',
    dayIndex: 1,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e2',
    dayIndex: 2,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e2',
    dayIndex: 3,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e2',
    dayIndex: 4,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'W',
  },
  {
    employeeId: 'e2',
    dayIndex: 5,
    type: 'kurz',
    start: '07:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  { employeeId: 'e2', dayIndex: 6, type: 'frei', start: '', end: '', workAreaCode: '' },

  {
    employeeId: 'e3',
    dayIndex: 0,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e3',
    dayIndex: 1,
    type: 'schule',
    start: '08:00',
    end: '14:00',
    workAreaCode: 'Sch',
  },
  {
    employeeId: 'e3',
    dayIndex: 2,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e3',
    dayIndex: 3,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
    conflict: true,
  },
  {
    employeeId: 'e3',
    dayIndex: 3,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'Ba',
    conflict: true,
  },
  {
    employeeId: 'e3',
    dayIndex: 4,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e3',
    dayIndex: 5,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  { employeeId: 'e3', dayIndex: 6, type: 'frei', start: '', end: '', workAreaCode: '' },

  {
    employeeId: 'e4',
    dayIndex: 0,
    type: 'nacht',
    start: '22:00',
    end: '06:00',
    workAreaCode: 'K',
  },
  { employeeId: 'e4', dayIndex: 1, type: 'frei', start: '', end: '', workAreaCode: '' },
  {
    employeeId: 'e4',
    dayIndex: 2,
    type: 'nacht',
    start: '22:00',
    end: '06:00',
    workAreaCode: 'K',
  },
  { employeeId: 'e4', dayIndex: 3, type: 'frei', start: '', end: '', workAreaCode: '' },
  {
    employeeId: 'e4',
    dayIndex: 4,
    type: 'nacht',
    start: '22:00',
    end: '06:00',
    workAreaCode: 'L',
  },
  {
    employeeId: 'e4',
    dayIndex: 5,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e4',
    dayIndex: 6,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'A',
  },

  {
    employeeId: 'e5',
    dayIndex: 0,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e5',
    dayIndex: 1,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e5',
    dayIndex: 2,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'Ba',
  },
  {
    employeeId: 'e5',
    dayIndex: 3,
    type: 'schule',
    start: '08:00',
    end: '14:00',
    workAreaCode: 'Sch',
  },
  {
    employeeId: 'e5',
    dayIndex: 4,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  { employeeId: 'e5', dayIndex: 5, type: 'frei', start: '', end: '', workAreaCode: '' },
  { employeeId: 'e5', dayIndex: 6, type: 'frei', start: '', end: '', workAreaCode: '' },

  {
    employeeId: 'e6',
    dayIndex: 0,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e6',
    dayIndex: 1,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  { employeeId: 'e6', dayIndex: 2, type: 'frei', start: '', end: '', workAreaCode: '' },
  {
    employeeId: 'e6',
    dayIndex: 3,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'W',
  },
  {
    employeeId: 'e6',
    dayIndex: 4,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e6',
    dayIndex: 5,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e6',
    dayIndex: 6,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },

  {
    employeeId: 'e7',
    dayIndex: 0,
    type: 'mittel',
    start: '08:00',
    end: '14:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e7',
    dayIndex: 1,
    type: 'mittel',
    start: '08:00',
    end: '14:15',
    workAreaCode: 'Ba',
  },
  {
    employeeId: 'e7',
    dayIndex: 2,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e7',
    dayIndex: 3,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  { employeeId: 'e7', dayIndex: 4, type: 'frei', start: '', end: '', workAreaCode: '' },
  {
    employeeId: 'e7',
    dayIndex: 5,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e7',
    dayIndex: 6,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'A',
  },

  {
    employeeId: 'e8',
    dayIndex: 0,
    type: 'frei',
    start: '',
    end: '',
    workAreaCode: '',
  },
  {
    employeeId: 'e8',
    dayIndex: 1,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'L',
  },
  {
    employeeId: 'e8',
    dayIndex: 2,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e8',
    dayIndex: 3,
    type: 'spaet',
    start: '14:00',
    end: '21:15',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e8',
    dayIndex: 4,
    type: 'frueh',
    start: '05:30',
    end: '14:00',
    workAreaCode: 'K',
  },
  {
    employeeId: 'e8',
    dayIndex: 5,
    type: 'nacht',
    start: '22:00',
    end: '06:00',
    workAreaCode: 'K',
  },
  { employeeId: 'e8', dayIndex: 6, type: 'frei', start: '', end: '', workAreaCode: '' },
]

export function resolveShiftVisual(type: ShiftTypeId): {
  label: string
  cardClass: string
  glowClass: string
} {
  const def = getShiftTypeDef(type)
  return {
    label: def.label,
    cardClass: def.cardClass,
    glowClass: def.glowClass,
  }
}

export type ResolvedShiftBlock = ShiftBlockTemplate & {
  dateISO: string
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function resolveBlocksForWeek(weekMonday: Date): ResolvedShiftBlock[] {
  return shiftBlockTemplates.map((t) => {
    const cell = new Date(weekMonday)
    cell.setDate(cell.getDate() + t.dayIndex)
    return { ...t, dateISO: toISODate(cell) }
  })
}

export type OpenShiftSlot = {
  id: string
  dayLabel: string
  time: string
  workAreaCode: string
}

export const mockOpenShifts: OpenShiftSlot[] = [
  { id: 'o1', dayLabel: 'Fr', time: 'Spät 14:00–21:15', workAreaCode: 'W' },
  { id: 'o2', dayLabel: 'Sa', time: 'Früh 05:30–14:00', workAreaCode: 'K' },
  { id: 'o3', dayLabel: 'So', time: 'Nacht 22:00–06:00', workAreaCode: 'K' },
]

export type ScheduleConflict = {
  id: string
  message: string
  detail: string
}

export const mockConflicts: ScheduleConflict[] = [
  {
    id: 'c1',
    message: 'Überlappende Schichten',
    detail: 'Max Vins · Do · Kasse / Backshop',
  },
  {
    id: 'c2',
    message: 'Ruhezeit',
    detail: 'Metin Özgür · weniger als 11h zwischen zwei Diensten (Mi)',
  },
]

export type WeekAbsence = {
  id: string
  employeeName: string
  type: string
  range: string
}

export const mockWeekAbsences: WeekAbsence[] = [
  { id: 'a1', employeeName: 'Valerina Mustafa', type: 'Urlaub', range: 'Fr–So' },
  { id: 'a2', employeeName: 'Enise A.', type: 'Krank', range: 'Sa' },
]

export function computeWeeklyHoursByEmployee(
  blocks: ResolvedShiftBlock[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of blocks) {
    if (b.type === 'frei') continue
    const h = hoursBetween(b.start, b.end)
    if (h <= 0) continue
    map.set(b.employeeId, (map.get(b.employeeId) ?? 0) + h)
  }
  return map
}

function hoursBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const s = sh * 60 + sm
  let e = eh * 60 + em
  if (e <= s) e += 24 * 60
  return (e - s) / 60
}

export function totalPlannedHours(blocks: ResolvedShiftBlock[]): number {
  let t = 0
  for (const b of blocks) {
    if (b.type === 'frei') continue
    t += hoursBetween(b.start, b.end)
  }
  return Math.round(t * 10) / 10
}
