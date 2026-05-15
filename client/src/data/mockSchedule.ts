/** Dummy-Daten für das Schichtplan-Frontend (ohne API/DB). */

import { workAreasScheduleCompat } from './mockEmployees'
import { STATION_NAME } from './station'

export type { Employee, ScheduleEmployeeRow } from '../types/employee'
export { toScheduleEmployeeRow } from '../types/employee'

export { STATION_NAME }

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
  | 'regular'

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
    id: 'sonderdienst',
    label: 'Sonderdienst',
    legendTime: 'individuell',
    cardClass:
      'bg-gradient-to-br from-amber-500/30 to-orange-600/25 text-amber-50 border-amber-400/55',
    glowClass: 'shadow-[0_0_16px_rgba(251,191,36,0.4)]',
  },
  {
    id: 'mittel',
    label: 'Mittel',
    legendTime: '08:00–14:15',
    cardClass: 'bg-sky-500/25 text-sky-50 border-sky-300/45',
    glowClass: 'shadow-[0_0_14px_rgba(125,211,252,0.3)]',
  },
  {
    id: 'regular',
    label: 'Schicht',
    legendTime: 'individuell',
    cardClass: 'bg-slate-600/30 text-slate-50 border-slate-400/45',
    glowClass: 'shadow-[0_0_14px_rgba(148,163,184,0.28)]',
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

export const workAreas: WorkArea[] = workAreasScheduleCompat

export function workAreaLabel(code: string): string {
  if (!code) return ''
  const w = workAreas.find((a) => a.shortCode === code)
  return w?.label ?? code
}

export function workAreaIdFromShortCode(shortCode: string): string {
  if (!shortCode) return ''
  const w = workAreas.find((a) => a.shortCode === shortCode)
  return w?.id ?? ''
}

export function shortCodeFromWorkAreaId(workAreaId: string): string {
  if (!workAreaId) return ''
  const w = workAreas.find((a) => a.id === workAreaId)
  return w?.shortCode ?? ''
}

/** Lokales State-Modell (Phase 3, ohne API). */
export type ScheduleShift = {
  id: string
  employeeId?: string
  workAreaId: string
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  shiftType: ShiftTypeId
  note: string
  status: 'Entwurf' | 'Veröffentlicht'
  /** Optional: überschreibt Farbe aus Schichttyp */
  color?: string
  /** Nur Anzeige (Mock / UI) */
  conflict?: boolean
  employeeDisplayName?: string
  employeeColor?: string
  employeeRemovedFromManagement?: boolean
}

export type WeekDayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export function dayIndexInWeek(
  dateISO: string,
  weekMonday: Date,
): WeekDayIndex | null {
  const t = new Date(`${dateISO}T12:00:00`)
  const mon = new Date(weekMonday)
  mon.setHours(12, 0, 0, 0)
  const diff = Math.round((t.getTime() - mon.getTime()) / 86400000)
  if (diff < 0 || diff > 6) return null
  return diff as WeekDayIndex
}

export function shiftsInWeek(
  shifts: ScheduleShift[],
  weekMonday: Date,
): ScheduleShift[] {
  return shifts.filter((s) => dayIndexInWeek(s.date, weekMonday) !== null)
}

/** Darstellung in Raster / Karten (abgeleitet). */
export type ResolvedShiftBlock = {
  id: string
  employeeId?: string
  dayIndex: WeekDayIndex
  type: ShiftTypeId
  start: string
  end: string
  workAreaCode: string
  dateISO: string
  status?: 'Entwurf' | 'Veröffentlicht'
  conflict?: boolean
  breakMinutes?: number
  note?: string
  color?: string
  employeeDisplayName?: string
  employeeColor?: string
  /** Offene Schicht ohne Mitarbeiter */
  open?: boolean
  /** Synthetisch: fehlende Soll-Schicht (Standardbedarf), keine DB-Zeile */
  requirementGap?: boolean
  /** Nur Teil der Soll-Zeit offen (Rest durch andere Schichten abgedeckt). */
  requirementGapPartial?: boolean
  /** Freigegebene oder offene Stempelzeit (Anzeige, Plan bleibt in start/end). */
  actualStart?: string
  actualEnd?: string
  actualPendingApproval?: boolean
  /** Nur Ist ohne geplanten Dienst (nicht im Organisations-Schichtplan) */
  istOnly?: boolean
  /** @deprecated Nur für Auswertungen – im Plan nicht als Balken nutzen */
  actualRunning?: boolean
  /** Kleines Badge am geplanten Balken (nur Stempel-Status, kein zweiter Balken) */
  stampStatus?: 'running' | 'clocked_in' | 'deviation' | 'pending_approval'
  /** Nur Tooltip / Detail – Plan bleibt in start/end */
  stampActualStart?: string
  stampActualEnd?: string | null
  stampSource?: string
}

export function scheduleShiftToResolved(
  s: ScheduleShift,
  weekMonday: Date,
): ResolvedShiftBlock | null {
  const di = dayIndexInWeek(s.date, weekMonday)
  if (di === null) return null
  const code = shortCodeFromWorkAreaId(s.workAreaId)
  return {
    id: s.id,
    employeeId: s.employeeId,
    dayIndex: di,
    type: s.shiftType,
    start: s.startTime,
    end: s.endTime,
    workAreaCode: code,
    dateISO: s.date,
    status: s.status,
    breakMinutes: s.breakMinutes,
    note: s.note,
    color: s.color,
    conflict: s.conflict,
    employeeDisplayName: s.employeeDisplayName,
    employeeColor: s.employeeColor,
    open: !s.employeeId && s.shiftType !== 'frei',
  }
}

export function resolveShiftsForWeekGrid(
  shifts: ScheduleShift[],
  weekMonday: Date,
): ResolvedShiftBlock[] {
  return shifts
    .map((s) => scheduleShiftToResolved(s, weekMonday))
    .filter((b): b is ResolvedShiftBlock => b !== null)
}

export function createLocalShiftId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `sh-${crypto.randomUUID()}`
  }
  return `sh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

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

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

let _seedSeq = 0
function nextSeedId(): string {
  _seedSeq += 1
  return `seed-${_seedSeq}`
}

/** Dummy-Schichten + offene Slots für eine konkrete Woche (ISO-Datum). */
export function seedScheduleWeek(weekMonday: Date): ScheduleShift[] {
  _seedSeq = 0
  const out: ScheduleShift[] = []
  for (const t of shiftBlockTemplates) {
    const cell = new Date(weekMonday)
    cell.setDate(cell.getDate() + t.dayIndex)
    out.push({
      id: nextSeedId(),
      employeeId: t.employeeId,
      workAreaId: workAreaIdFromShortCode(t.workAreaCode),
      date: toISODate(cell),
      startTime: t.start,
      endTime: t.end,
      breakMinutes: 0,
      shiftType: t.type,
      note: '',
      status: t.status ?? 'Entwurf',
      conflict: t.conflict,
    })
  }
  const openSlots: {
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
  for (const o of openSlots) {
    const cell = new Date(weekMonday)
    cell.setDate(cell.getDate() + o.dayIndex)
    out.push({
      id: nextSeedId(),
      workAreaId: workAreaIdFromShortCode(o.code),
      date: toISODate(cell),
      startTime: o.start,
      endTime: o.end,
      breakMinutes: 0,
      shiftType: o.shiftType,
      note: '',
      status: 'Veröffentlicht',
    })
  }
  return out
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

export type WeekAbsence = {
  id: string
  employeeName: string
  type: string
  range: string
}

/** Netto-Planstunden einer Schicht (Ende − Start − explizit gespeicherte Pause; Standardpause 0). */
export function netPlannedHoursForShift(s: ScheduleShift): number {
  if (!s.startTime || !s.endTime) return 0
  const gross = hoursBetween(s.startTime, s.endTime)
  const br = (s.breakMinutes ?? 0) / 60
  return Math.max(0, Math.round((gross - br) * 10) / 10)
}

/** Summiert geplante Nettostunden pro Mitarbeiter im Datumintervall [fromYmd, toYmd] (Station bereits gefilterte Liste). */
export function computePlannedHoursByEmployeeInDateRange(
  shifts: ScheduleShift[],
  fromYmd: string,
  toYmd: string,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of shifts) {
    if (!s.employeeId) continue
    if (s.shiftType === 'frei') continue
    if (s.date < fromYmd || s.date > toYmd) continue
    const h = netPlannedHoursForShift(s)
    if (h <= 0) continue
    map.set(s.employeeId, (map.get(s.employeeId) ?? 0) + h)
  }
  return map
}

export function computeWeeklyHoursByEmployee(
  blocks: ResolvedShiftBlock[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of blocks) {
    if (!b.employeeId || b.type === 'frei') continue
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
