import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'
import { buildDefaultWeekRequirements as buildStationDefaultWeekRequirements } from '../data/defaultShiftRequirements.js'
import { getHolidayBadgeForDate } from '../data/germanHolidays2026.js'
import type { GermanState } from '../data/germanHolidays2026.js'
import type { AbsenceRow } from './absenceService.js'
import * as employeeService from './employeeService.js'
import { listShiftRowsForStationDateRange, type ShiftRow } from './shiftService.js'

export type AssistantMode = 'fill_gaps' | 'replace_drafts' | 'full_refresh'

export type AssistantSlotKind = 'early' | 'late' | 'night' | 'middle' | 'short' | 'school'

export type DayRequirement = {
  date: string
  slots: {
    kind: AssistantSlotKind
    startTime: string
    endTime: string
    workAreaId: string
    required: boolean
  }[]
}

export type GenerateBody = {
  stationId?: string
  weekStart: string
  mode?: AssistantMode
  requirements?: DayRequirement[]
  federalState?: string
}

export type SuggestedShift = {
  id: string
  date: string
  startTime: string
  endTime: string
  workAreaId: string
  shiftType: string
  employeeId: string | null
  employeeName?: string
  score: number
  level: 'good' | 'warn' | 'bad'
  hints: string[]
  existingShiftId?: string
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoWeekdayKey(dateIso: string) {
  const d = new Date(`${dateIso}T12:00:00`)
  const i = d.getDay()
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
  return map[i]
}

function isWeekendDay(dateIso: string): boolean {
  const k = isoWeekdayKey(dateIso)
  return k === 'saturday' || k === 'sunday'
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function durationMinutes(start: string, end: string): number {
  const a = timeToMinutes(start)
  const b = timeToMinutes(end)
  if (b >= a) return b - a
  return b + 24 * 60 - a
}

function rangesOverlapDay(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = timeToMinutes(aStart)
  let ae = timeToMinutes(aEnd)
  if (ae <= as) ae += 24 * 60
  const bs = timeToMinutes(bStart)
  let be = timeToMinutes(bEnd)
  if (be <= bs) be += 24 * 60
  return as < be && ae > bs
}

function kindToShiftType(kind: AssistantSlotKind): string {
  switch (kind) {
    case 'early':
      return 'frueh'
    case 'late':
      return 'spaet'
    case 'night':
      return 'nacht'
    case 'middle':
      return 'mittel'
    case 'short':
      return 'kurz'
    case 'school':
      return 'schule'
    default:
      return 'frueh'
  }
}

function prefKindMatchesSlot(
  pref: string[],
  kind: AssistantSlotKind,
  date: string,
  federalState: GermanState,
): boolean {
  if (pref.includes('weekend') && isWeekendDay(date)) return true
  if (pref.includes('holiday') || pref.includes('feiertag')) {
    const hol = getHolidayBadgeForDate(date, federalState)
    if (hol.severity === 'strong') return true
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

type Emp = ReturnType<typeof employeeService.listEmployees>[number]

function isAbsentApproved(empId: string, date: string, rows: AbsenceRow[]): boolean {
  return rows.some((r) => r.employee_id === empId && r.start_date <= date && r.end_date >= date)
}

function listApprovedAbsenceRows(db: Database, stationId: string, from: string, to: string): AbsenceRow[] {
  return db
    .prepare(
      `SELECT * FROM absences WHERE station_id = ? AND end_date >= ? AND start_date <= ? AND status = 'approved'`,
    )
    .all(stationId, from, to) as AbsenceRow[]
}

export function calculateEmployeeShiftScore(
  emp: Emp,
  slot: { date: string; kind: AssistantSlotKind; startTime: string; endTime: string; workAreaId: string },
  ctx: {
    federalState: GermanState
    assignedDayCount: number
    weeklyMinutesSoFar: number
    slotMinutes: number
    weeklyContractMinutes: number
    maxWeeklyMinutes?: number
    noShiftYetOnThisDay: boolean
  },
): { score: number; level: 'good' | 'warn' | 'bad'; hints: string[] } {
  let score = 0
  const hints: string[] = []
  const wd = isoWeekdayKey(slot.date)
  const weekend = isWeekendDay(slot.date)
  const hol = getHolidayBadgeForDate(slot.date, ctx.federalState)

  if (prefKindMatchesSlot(emp.preferredShiftTypes ?? [], slot.kind, slot.date, ctx.federalState)) {
    score += 30
    hints.push('bevorzugte Schichtart')
  }
  if ((emp.preferredWorkDays ?? []).includes(wd)) {
    score += 25
    hints.push('bevorzugter Arbeitstag')
  }
  if ((emp.notPreferredWorkDays ?? []).includes(wd)) {
    score -= 40
    hints.push('nicht bevorzugter Tag')
  }

  const proj = ctx.weeklyMinutesSoFar + ctx.slotMinutes
  const cap = ctx.maxWeeklyMinutes ?? ctx.weeklyContractMinutes * 1.05
  if (proj <= ctx.weeklyContractMinutes * 0.9) {
    score += 15
    hints.push('unter Soll-Stunden')
  }
  if (proj > cap) {
    score -= 50
    hints.push('Wochenstunden überschritten')
  }

  if (ctx.noShiftYetOnThisDay) {
    score += 10
    hints.push('noch keine Schicht an diesem Tag')
  }

  if (weekend && emp.canWorkWeekends) {
    score += 10
    hints.push('Wochenende erlaubt')
  }
  if (weekend && !emp.canWorkWeekends) {
    score -= 30
    hints.push('Wochenende nicht bevorzugt')
  }

  if (hol.severity === 'strong' && emp.canWorkHolidays) {
    score += 10
    hints.push('Feiertag möglich')
  }
  if (hol.severity === 'strong' && !emp.canWorkHolidays) {
    score -= 30
    hints.push('Feiertag nicht freigegeben')
  }
  if (hol.severity === 'soft') {
    hints.push(`Hinweis Feiertag: ${hol.label}`)
  }

  if ((emp.workAreaIds ?? []).includes(slot.workAreaId)) {
    score += 5
    hints.push('Arbeitsbereich passt')
  } else {
    score -= 2
    hints.push('Arbeitsbereich abweichend')
  }

  const maxDays = emp.maxPreferredDaysPerWeek
  if (maxDays != null && ctx.assignedDayCount >= maxDays) {
    score -= 20
    hints.push('viele Arbeitstage in der Woche')
  }

  let level: 'good' | 'warn' | 'bad' = 'good'
  if (score < 0) level = 'warn'
  if (score < -40) level = 'bad'
  return { score, level, hints }
}

function deleteDraftsForMode(db: Database, stationId: string, from: string, to: string, mode: AssistantMode) {
  if (mode === 'replace_drafts') {
    db.prepare(
      `DELETE FROM shifts WHERE station_id = ? AND date >= ? AND date <= ? AND (published IS NULL OR published = 0) AND import_source = ?`,
    ).run(stationId, from, to, 'schedule_assistant')
  }
  if (mode === 'full_refresh') {
    db.prepare(
      `DELETE FROM shifts WHERE station_id = ? AND date >= ? AND date <= ? AND (published IS NULL OR published = 0)`,
    ).run(stationId, from, to)
  }
}

function shiftOverlapsSlot(row: ShiftRow, slot: { date: string; startTime: string; endTime: string }): boolean {
  if (row.date !== slot.date) return false
  return rangesOverlapDay(row.start_time, row.end_time, slot.startTime, slot.endTime)
}

function slotFilledByAssignedShift(rows: ShiftRow[], slot: { date: string; startTime: string; endTime: string }) {
  return rows.some((r) => shiftOverlapsSlot(r, slot) && r.employee_id)
}

function findOpenShiftForSlot(rows: ShiftRow[], slot: { date: string; startTime: string; endTime: string }) {
  return rows.find((r) => shiftOverlapsSlot(r, slot) && !r.employee_id)
}

function employeeOverlapsProposed(
  empId: string,
  date: string,
  start: string,
  end: string,
  rows: ShiftRow[],
  proposed: { employeeId: string; date: string; start: string; end: string }[],
): boolean {
  for (const r of rows) {
    if (r.date !== date || r.employee_id !== empId) continue
    if (rangesOverlapDay(r.start_time, r.end_time, start, end)) return true
  }
  for (const p of proposed) {
    if (p.employeeId !== empId || p.date !== date) continue
    if (rangesOverlapDay(p.start, p.end, start, end)) return true
  }
  return false
}

function weeklyMinutesForEmployee(
  empId: string,
  rows: ShiftRow[],
  proposed: { employeeId: string; start: string; end: string }[],
): number {
  let m = 0
  for (const r of rows) {
    if (r.employee_id !== empId) continue
    m += durationMinutes(r.start_time, r.end_time)
  }
  for (const p of proposed) {
    if (p.employeeId !== empId) continue
    m += durationMinutes(p.start, p.end)
  }
  return m
}

function distinctDaysWorked(empId: string, rows: ShiftRow[], proposed: { employeeId: string; date: string }[]): number {
  const s = new Set<string>()
  for (const r of rows) {
    if (r.employee_id === empId) s.add(r.date)
  }
  for (const p of proposed) {
    if (p.employeeId === empId) s.add(p.date)
  }
  return s.size
}

export function generateScheduleSuggestions(db: Database, body: GenerateBody) {
  const stationId = String(body.stationId ?? DEFAULT_STATION_ID)
  const weekStart = String(body.weekStart ?? '').trim()
  if (!weekStart) throw new Error('weekStart erforderlich')
  const mode: AssistantMode = body.mode ?? 'fill_gaps'
  const federalState = (String(body.federalState ?? 'BW').toUpperCase() as GermanState) ?? 'BW'
  const weekEnd = addDaysIso(weekStart, 6)

  const requirements =
    body.requirements && body.requirements.length > 0
      ? body.requirements
      : buildStationDefaultWeekRequirements(weekStart, stationId, federalState)

  const employees = employeeService.listEmployees(db, stationId).filter((e) => e.status === 'aktiv' && e.visibleInTeamSchedule !== false)
  const absenceRows = listApprovedAbsenceRows(db, stationId, weekStart, weekEnd)
  const shiftRows = listShiftRowsForStationDateRange(db, stationId, weekStart, weekEnd)

  const warnings: string[] = []
  const suggestedShifts: SuggestedShift[] = []
  const proposed: { employeeId: string; date: string; start: string; end: string }[] = []

  for (const day of requirements) {
    for (const slot of day.slots) {
      if (!slot.required) continue
      const fullSlot = { date: day.date, ...slot }
      if (mode === 'fill_gaps' && slotFilledByAssignedShift(shiftRows, fullSlot)) continue

      const open = findOpenShiftForSlot(shiftRows, fullSlot)
      const slotMin = durationMinutes(slot.startTime, slot.endTime)

      const candidates: SuggestedShift[] = []

      for (const emp of employees) {
        if (isAbsentApproved(emp.id, day.date, absenceRows)) {
          candidates.push({
            id: `sug-${randomUUID()}`,
            date: day.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            workAreaId: slot.workAreaId,
            shiftType: kindToShiftType(slot.kind),
            employeeId: emp.id,
            employeeName: emp.displayName,
            score: -1000,
            level: 'bad',
            hints: ['Mitarbeiter abwesend (genehmigt)'],
            existingShiftId: open?.id,
          })
          continue
        }
        if (employeeOverlapsProposed(emp.id, day.date, slot.startTime, slot.endTime, shiftRows, proposed)) {
          candidates.push({
            id: `sug-${randomUUID()}`,
            date: day.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            workAreaId: slot.workAreaId,
            shiftType: kindToShiftType(slot.kind),
            employeeId: emp.id,
            employeeName: emp.displayName,
            score: -1000,
            level: 'bad',
            hints: ['Überschneidung mit bestehender Schicht'],
            existingShiftId: open?.id,
          })
          continue
        }

        const wMin = weeklyMinutesForEmployee(emp.id, shiftRows, proposed)
        const dayCount = distinctDaysWorked(emp.id, shiftRows, proposed)
        const hasShiftThisDay =
          shiftRows.some((r) => r.employee_id === emp.id && r.date === day.date) ||
          proposed.some((p) => p.employeeId === emp.id && p.date === day.date)
        const contractMin = (emp.weeklyHours ?? 40) * 60
        const maxW = emp.maxWeeklyHours != null ? emp.maxWeeklyHours * 60 : undefined

        const sc = calculateEmployeeShiftScore(emp, { ...fullSlot, kind: slot.kind }, {
          federalState,
          assignedDayCount: dayCount,
          weeklyMinutesSoFar: wMin,
          slotMinutes: slotMin,
          weeklyContractMinutes: contractMin,
          maxWeeklyMinutes: maxW,
          noShiftYetOnThisDay: !hasShiftThisDay,
        })

        candidates.push({
          id: `sug-${randomUUID()}`,
          date: day.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          workAreaId: slot.workAreaId,
          shiftType: kindToShiftType(slot.kind),
          employeeId: emp.id,
          employeeName: emp.displayName,
          score: sc.score,
          level: sc.level,
          hints: sc.hints,
          existingShiftId: open?.id,
        })
      }

      const viable = candidates.filter((c) => c.score > -500)
      viable.sort((a, b) => b.score - a.score)
      const best = viable[0]

      if (best) {
        proposed.push({
          employeeId: best.employeeId!,
          date: best.date,
          start: best.startTime,
          end: best.endTime,
        })
        suggestedShifts.push(best)
      } else {
        warnings.push(`Kein passender Mitarbeiter für ${day.date} ${slot.kind} (${slot.startTime}–${slot.endTime})`)
        suggestedShifts.push({
          id: `sug-${randomUUID()}`,
          date: day.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          workAreaId: slot.workAreaId,
          shiftType: kindToShiftType(slot.kind),
          employeeId: null,
          score: -999,
          level: 'bad',
          hints: ['Offene Schicht'],
          existingShiftId: open?.id,
        })
      }
    }
  }

  return { suggestedShifts, warnings, scoreDetails: suggestedShifts }
}

export type ApplyBody = {
  stationId?: string
  weekStart?: string
  mode?: AssistantMode
  suggestions: {
    employeeId: string | null
    date: string
    startTime: string
    endTime: string
    workAreaId: string
    shiftType: string
    existingShiftId?: string
  }[]
  onlyOpen?: boolean
}

export function applyScheduleSuggestions(db: Database, body: ApplyBody) {
  const stationId = String(body.stationId ?? DEFAULT_STATION_ID)
  const mode: AssistantMode = body.mode ?? 'fill_gaps'
  const weekStart = String(body.weekStart ?? '').trim()
  if (weekStart && (mode === 'replace_drafts' || mode === 'full_refresh')) {
    const weekEnd = addDaysIso(weekStart, 6)
    deleteDraftsForMode(db, stationId, weekStart, weekEnd, mode)
  }

  const onlyOpen = Boolean(body.onlyOpen)
  const created: string[] = []
  const updated: string[] = []
  const ts = nowIso()
  for (const s of body.suggestions ?? []) {
    if (onlyOpen) {
      if (!s.existingShiftId || !s.employeeId) continue
      db.prepare(
        `UPDATE shifts SET employee_id = ?, shift_type = ?, updated_at = ?, import_source = COALESCE(import_source, ?) WHERE id = ?`,
      ).run(s.employeeId, s.shiftType, ts, 'schedule_assistant', s.existingShiftId)
      updated.push(s.existingShiftId)
      continue
    }
    if (!s.employeeId) continue
    if (s.existingShiftId) {
      db.prepare(
        `UPDATE shifts SET employee_id = ?, shift_type = ?, updated_at = ?, import_source = COALESCE(import_source, ?) WHERE id = ?`,
      ).run(s.employeeId, s.shiftType, ts, 'schedule_assistant', s.existingShiftId)
      updated.push(s.existingShiftId)
      continue
    }
    const id = `sh-${randomUUID()}`
    db.prepare(
      `INSERT INTO shifts (
      id, station_id, employee_id, work_area_id, date, start_time, end_time, break_minutes,
      shift_type, title, note, color, status, published, conflict, import_source, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '', NULL, 'draft', 0, 0, ?, NULL, NULL, ?, ?)`,
    ).run(
      id,
      stationId,
      s.employeeId,
      s.workAreaId,
      s.date,
      s.startTime,
      s.endTime,
      0,
      s.shiftType,
      'schedule_assistant',
      ts,
      ts,
    )
    created.push(id)
  }
  return { created, updated }
}
