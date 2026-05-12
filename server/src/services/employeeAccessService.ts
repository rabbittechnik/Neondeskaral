import type { Database } from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import type { EmployeeRow } from './employeeService.js'
import { listShifts } from './shiftService.js'
import { listAbsences, createAbsence } from './absenceService.js'
import { confirmTaskFromEmployeeApp, listTaskLogsByTaskIds, listTasks, rowToTaskApi } from './taskService.js'
import { listTimeEntries } from './timeTrackingService.js'
import { getStation } from './stationService.js'
import { listWorkAreas } from './workAreaService.js'
import {
  clockCheckInByEmployeeId,
  clockCheckOutComplete,
  clockCheckOutStartByEmployeeId,
} from './clockService.js'

export function generateAccessToken(): string {
  return randomBytes(32).toString('hex')
}

export function getEmployeeRowByAccessToken(db: Database, token: string): EmployeeRow | undefined {
  const t = String(token ?? '').trim()
  if (!t) return undefined
  return db
    .prepare(`SELECT * FROM employees WHERE employee_access_token = ? AND (active IS NULL OR active = 1)`)
    .get(t) as EmployeeRow | undefined
}

function assertAccessAllowed(row: EmployeeRow) {
  if ((row.active ?? 1) === 0) return false
  if ((row.employee_access_enabled ?? 1) === 0) return false
  if (!row.employee_access_token) return false
  return true
}

function employmentRoleFromRow(row: EmployeeRow): string {
  const raw = (row as Record<string, unknown>).employment_role
  return typeof raw === 'string' ? raw.trim() : ''
}

function roleLabelForEmployeeApp(row: EmployeeRow): string {
  const job = employmentRoleFromRow(row)
  if (job) return job
  const empRole = String(row.role ?? '').trim().toLowerCase()
  const map: Record<string, string> = {
    schichtleiter: 'Schichtleiter',
    teamleiter: 'Teamleiter / Stationsleitung',
    stationsleitung: 'Teamleiter / Stationsleitung',
    verkäufer: 'Verkäufer',
    verkaufer: 'Verkäufer',
    aushilfe: 'Aushilfe',
    aushilfen: 'Aushilfe',
  }
  if (empRole && map[empRole]) return map[empRole]!
  if (empRole) return empRole.charAt(0).toUpperCase() + empRole.slice(1)
  return ''
}

function publicEmployee(row: EmployeeRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    role: row.role ?? '',
    roleLabel: roleLabelForEmployeeApp(row) || undefined,
    stationId: row.station_id,
    color: row.color ?? '#94a3b8',
    terminalEnabled: (row.terminal_enabled ?? 1) === 1,
    timeTrackingEnabled: (row.time_tracking_enabled ?? 1) === 1,
  }
}

function employeeWorkAreaIds(db: Database, employeeId: string): string[] {
  const rows = db
    .prepare(`SELECT work_area_id FROM employee_work_areas WHERE employee_id = ?`)
    .all(employeeId) as { work_area_id: string }[]
  return [...new Set(rows.map((r) => String(r.work_area_id ?? '')).filter(Boolean))]
}

function normalizeRoleToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function taskRelevantForEmployee(
  t: ReturnType<typeof rowToTaskApi>,
  empId: string,
  empRole: string,
  empJobTitle: string,
  workAreaIds: string[],
  todayShiftWorkAreaIds: Set<string>,
): boolean {
  if (!t.active) return false
  const type = String(t.assignedType ?? 'all')
  if (type === 'all') return true
  if (type === 'employee') return t.assignedEmployeeId === empId
  if (type === 'role') {
    const ar = normalizeRoleToken(String(t.assignedRole ?? ''))
    if (!ar) return false
    const pool = normalizeRoleToken(`${empRole} ${empJobTitle}`)
    if (pool.includes(ar)) return true
    for (const part of ar.split('/')) {
      const p = part.trim().toLowerCase()
      if (p && pool.includes(p)) return true
    }
    return false
  }
  if (type === 'workArea') {
    const wid = String(t.workAreaId ?? '')
    if (wid && workAreaIds.includes(wid)) return true
    if (wid && todayShiftWorkAreaIds.has(wid)) return true
    return false
  }
  return false
}

function publicStation(db: Database, stationId: string) {
  const r = getStation(db, stationId) as
    | { id: string; name: string; federal_state?: string }
    | undefined
  if (!r) return { id: stationId, name: 'Station' }
  return { id: r.id, name: r.name, federalState: r.federal_state ?? 'BW' }
}

export function buildEmployeeAccessPayload(db: Database, token: string) {
  const row = getEmployeeRowByAccessToken(db, token)
  if (!row || !assertAccessAllowed(row)) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  const stationId = row.station_id
  const empId = row.id
  const empRole = String(row.role ?? '').trim()
  const empJobTitle = employmentRoleFromRow(row)
  const todayYmd = ymdFromDate(new Date())
  const todayShiftAreas = new Set(
    listShifts(db, { stationId, employeeId: empId, from: todayYmd, to: todayYmd })
      .map((s) => s.workAreaId)
      .filter(Boolean),
  )
  const ewaIds = employeeWorkAreaIds(db, empId)

  const from = new Date()
  from.setDate(from.getDate() - 7)
  const to = new Date()
  to.setDate(to.getDate() + 42)
  const fromIso = from.toISOString().slice(0, 10)
  const toIso = to.toISOString().slice(0, 10)

  const shifts = listShifts(db, {
    stationId,
    from: fromIso,
    to: toIso,
    employeeId: empId,
  }).map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    workAreaId: s.workAreaId,
    shiftType: s.shiftType,
    status: s.status,
  }))

  const absencesRaw = listAbsences(db, {
    stationId,
    employeeId: empId,
  })
  const absences = absencesRaw.map((a) => ({
    id: a.id,
    type: a.type,
    startDate: a.startDate,
    endDate: a.endDate,
    halfDay: a.halfDay,
    status: a.status,
    comment: a.comment,
    requestedAt: a.requestedAt,
    approvedAt: a.approvedAt,
    rejectedReason: a.rejectedReason,
  }))

  const tasksAll = listTasks(db, stationId)
  const tasks = tasksAll.filter((t) =>
    taskRelevantForEmployee(t, empId, empRole, empJobTitle, ewaIds, todayShiftAreas),
  )
  const logFrom = addDaysToYmd(todayYmd, -7)
  const logTo = addDaysToYmd(todayYmd, 21)
  const taskLogs = listTaskLogsByTaskIds(
    db,
    tasks.map((x) => x.id),
    logFrom,
    logTo,
  )

  const workAreas = listWorkAreas(db, stationId).map((w) => ({
    id: w.id,
    name: w.name ?? w.id,
  }))

  const timeEntries = listTimeEntries(db, {
    stationId,
    employeeId: empId,
    from: `${fromIso}T00:00:00.000Z`,
    to: undefined,
  }).slice(0, 40)

  const running = timeEntries.find((e) => e.status === 'running')

  return {
    ok: true as const,
    employee: publicEmployee(row),
    station: publicStation(db, stationId),
    workAreas,
    shifts,
    tasks,
    taskLogs,
    absences,
    timeEntries,
    runningTimeEntry: running,
  }
}

/**
 * Wenn true, liefert der Mitarbeiter-Wochenplan nur veröffentlichte Schichten.
 * Vorerst false: alle Schichten sichtbar, Logik bleibt vorbereitet.
 */
export const EMPLOYEE_APP_WEEK_SCHEDULE_PUBLISHED_ONLY = false

function ymdFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysToYmd(ymd: string, n: number): string {
  const [y, mo, da] = ymd.split('-').map(Number)
  const d = new Date(y, mo - 1, da + n)
  return ymdFromDate(d)
}

function serverLocalMondayToday(): string {
  const d = new Date()
  const dow = d.getDay()
  const off = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + off)
  return ymdFromDate(d)
}

function normalizeWeekMonday(weekStart?: string): string {
  const s = String(weekStart ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return serverLocalMondayToday()
  return s
}

function isoCalendarWeekFromMondayYmd(mondayYmd: string): { week: number; weekYear: number } {
  const [y, m, d] = mondayYmd.split('-').map(Number)
  const mon = new Date(y, m - 1, d)
  mon.setHours(12, 0, 0, 0)
  const thu = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 3)
  thu.setHours(12, 0, 0, 0)
  const year = thu.getFullYear()
  const firstThursday = new Date(year, 0, 4)
  const offset = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(4 - offset)
  const diffDays = Math.round((thu.getTime() - firstThursday.getTime()) / 86400000)
  const week = 1 + Math.floor(diffDays / 7)
  return { week, weekYear: year }
}

type PublicScheduleEmployee = {
  id: string
  displayName: string
  shortName: string
  color: string
  role: string
}

function loadPublicEmployeesForIds(db: Database, ids: string[]): Map<string, PublicScheduleEmployee> {
  const map = new Map<string, PublicScheduleEmployee>()
  if (!ids.length) return map
  const uniq = [...new Set(ids)]
  const placeholders = uniq.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT id, display_name, short_name, color, role FROM employees WHERE id IN (${placeholders})`,
    )
    .all(...uniq) as { id: string; display_name: string | null; short_name: string | null; color: string | null; role: string | null }[]
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      displayName: String(r.display_name ?? '').trim() || 'Mitarbeiter',
      shortName: String(r.short_name ?? '').trim(),
      color: String(r.color ?? '#94a3b8'),
      role: String(r.role ?? ''),
    })
  }
  return map
}

export function buildEmployeeWeekSchedule(db: Database, token: string, weekStart?: string) {
  const row = getEmployeeRowByAccessToken(db, token)
  if (!row || !assertAccessAllowed(row)) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  const weekMonday = normalizeWeekMonday(weekStart)
  const weekSunday = addDaysToYmd(weekMonday, 6)
  const { week: calendarWeek, weekYear: calendarWeekYear } = isoCalendarWeekFromMondayYmd(weekMonday)

  let shifts = listShifts(db, {
    stationId: row.station_id,
    from: weekMonday,
    to: weekSunday,
  })
  if (EMPLOYEE_APP_WEEK_SCHEDULE_PUBLISHED_ONLY) {
    shifts = shifts.filter((s) => s.status === 'Veröffentlicht')
  }

  const empIds = shifts.map((s) => s.employeeId).filter((x): x is string => Boolean(x))
  const empMap = loadPublicEmployeesForIds(db, empIds)
  const workAreas = listWorkAreas(db, row.station_id)

  return {
    ok: true as const,
    weekStart: weekMonday,
    weekEnd: weekSunday,
    calendarWeek,
    calendarWeekYear,
    stationId: row.station_id,
    stationName: publicStation(db, row.station_id).name,
    shifts: shifts.map((s) => ({
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      workAreaId: s.workAreaId,
      shiftType: s.shiftType,
      employeeId: s.employeeId ?? null,
      employee: s.employeeId ? empMap.get(s.employeeId) ?? null : null,
      publicationStatus: s.status === 'Veröffentlicht' ? ('published' as const) : ('draft' as const),
    })),
    workAreas,
    /** Platzhalter für spätere Feiertags-Anzeige */
    holidays: [] as { date: string; name: string }[],
  }
}

export function touchEmployeeAccessUsed(db: Database, employeeId: string) {
  const ts = nowIso()
  db.prepare(`UPDATE employees SET employee_access_last_used_at = ?, updated_at = ? WHERE id = ?`).run(
    ts,
    ts,
    employeeId,
  )
}

export function employeeAccessCheckIn(db: Database, token: string, force: boolean) {
  const row = getEmployeeRowByAccessToken(db, token)
  if (!row || !assertAccessAllowed(row)) {
    return { ok: false as const, result: 'invalid_token' as const, message: 'Zugang ungültig oder deaktiviert.' }
  }
  touchEmployeeAccessUsed(db, row.id)
  return clockCheckInByEmployeeId(db, {
    employeeId: row.id,
    stationId: row.station_id,
    force,
    source: 'employee_mobile_app',
    startedBy: 'Mitarbeiter-App',
  })
}

export function employeeAccessCheckOutStart(db: Database, token: string) {
  const row = getEmployeeRowByAccessToken(db, token)
  if (!row || !assertAccessAllowed(row)) {
    return { ok: false as const, result: 'invalid_token' as const, message: 'Zugang ungültig oder deaktiviert.' }
  }
  touchEmployeeAccessUsed(db, row.id)
  return clockCheckOutStartByEmployeeId(db, {
    employeeId: row.id,
    stationId: row.station_id,
  })
}

export function employeeAccessCheckOutComplete(
  db: Database,
  token: string,
  body: { timeEntryId: string; checklist: Record<string, unknown> },
) {
  const row = getEmployeeRowByAccessToken(db, token)
  if (!row || !assertAccessAllowed(row)) {
    return { ok: false as const, error: 'Zugang ungültig oder deaktiviert.' }
  }
  const te = listTimeEntries(db, {
    stationId: row.station_id,
    employeeId: row.id,
    status: 'running',
  })[0]
  if (!te || te.id !== body.timeEntryId) {
    return { ok: false as const, error: 'Kein passender laufender Eintrag.' }
  }
  touchEmployeeAccessUsed(db, row.id)
  return clockCheckOutComplete(db, {
    timeEntryId: body.timeEntryId,
    checklist: body.checklist,
    endedBy: row.display_name ?? 'Mitarbeiter-App',
  })
}

export function employeeAccessListAbsences(db: Database, token: string) {
  const row = getEmployeeRowByAccessToken(db, token)
  if (!row || !assertAccessAllowed(row)) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  touchEmployeeAccessUsed(db, row.id)
  const data = listAbsences(db, { stationId: row.station_id, employeeId: row.id })
  return { ok: true as const, data }
}

export function employeeAccessCreateAbsence(db: Database, token: string, body: Record<string, unknown>) {
  const row = getEmployeeRowByAccessToken(db, token)
  if (!row || !assertAccessAllowed(row)) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  touchEmployeeAccessUsed(db, row.id)
  const safe: Record<string, unknown> = { ...(body ?? {}) }
  delete safe.employeeId
  const data = createAbsence(
    db,
    {
      ...safe,
      employeeId: row.id,
      status: 'beantragt',
    },
    row.station_id,
  )
  return { ok: true as const, data }
}

export function employeeAccessGetTasks(db: Database, token: string) {
  const full = buildEmployeeAccessPayload(db, token)
  if (!full.ok) return { ok: false as const, error: 'invalid_token' as const }
  return {
    ok: true as const,
    data: { tasks: full.tasks, taskLogs: full.taskLogs, workAreas: full.workAreas },
  }
}

export function employeeAccessConfirmTask(
  db: Database,
  token: string,
  taskId: string,
  body: { comment?: string },
) {
  const row = getEmployeeRowByAccessToken(db, token)
  if (!row || !assertAccessAllowed(row)) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  touchEmployeeAccessUsed(db, row.id)
  const stationId = row.station_id
  const empId = row.id
  const empRole = String(row.role ?? '').trim()
  const empJobTitle = employmentRoleFromRow(row)
  const todayYmd = ymdFromDate(new Date())
  const todayShiftAreas = new Set(
    listShifts(db, { stationId, employeeId: empId, from: todayYmd, to: todayYmd })
      .map((s) => s.workAreaId)
      .filter(Boolean),
  )
  const ewaIds = employeeWorkAreaIds(db, empId)
  const tasksAll = listTasks(db, stationId)
  const t = tasksAll.find((x) => x.id === taskId)
  if (!t || !taskRelevantForEmployee(t, empId, empRole, empJobTitle, ewaIds, todayShiftAreas)) {
    return { ok: false as const, error: 'not_allowed' as const }
  }
  const label = String(row.display_name ?? `${row.first_name} ${row.last_name}`).trim() || 'Mitarbeiter'
  confirmTaskFromEmployeeApp(db, taskId, {
    date: todayYmd,
    employeeId: empId,
    confirmedBy: label,
    comment: body.comment,
  })
  return { ok: true as const, data: { saved: true } }
}
