import type { Database } from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import type { EmployeeRow } from './employeeService.js'
import { getShift, listShifts } from './shiftService.js'
import {
  assertPaidVacationCreateAllowed,
  buildVacationSnapshotForEmployee,
  createAbsence,
  listAbsences,
  VacationAckRequiredError,
} from './absenceService.js'
import { confirmTaskFromEmployeeApp, listTaskLogsByTaskIds, listTasks, rowToTaskApi } from './taskService.js'
import { listTimeEntries, rowToTimeEntryApi } from './timeTrackingService.js'
import { getStation } from './stationService.js'
import { listWorkAreas } from './workAreaService.js'
import { listActiveShiftWarningsForEmployee, acknowledgeShiftWarning } from './employeeShiftWarningService.js'
import {
  clockCheckInByEmployeeId,
  clockCheckOutComplete,
  clockCheckOutStartByEmployeeId,
} from './clockService.js'
import { isDeviceRequestBlocked, recordEmployeeAppDeviceVisit } from './employeeAppDeviceService.js'

export const EMPLOYEE_APP_ACCESS_DENIED_MESSAGE =
  'Dein Mitarbeiterzugang wurde deaktiviert. Bitte wende dich an die Stationsleitung.'

/** Keine internen Import-/System-Hinweise in der Mitarbeiter-App anzeigen. */
export function sanitizeAbsenceCommentForEmployeeApp(comment: string | null | undefined): string | undefined {
  const c = String(comment ?? '').trim()
  if (!c) return undefined
  const lower = c.toLowerCase()
  if (lower.includes('stationguide_import')) return undefined
  if (lower.includes('grauem balken')) return undefined
  if (lower.includes('stationguide') && (lower.includes('übernommen') || lower.includes('uebernommen'))) return undefined
  if (/\[stationguide[\w_-]*\]/i.test(c)) return undefined
  return c
}

export type EmployeeAccessRequestMeta = {
  deviceId: string
  platform: string
  appVersion: string
  userAgent: string
  lastIp: string | null
}

export function parseEmployeeAccessRequestMeta(req: import('express').Request): EmployeeAccessRequestMeta {
  const h = req.headers
  const pick = (name: string) => {
    const v = h[name.toLowerCase()]
    if (Array.isArray(v)) return String(v[0] ?? '').trim()
    return typeof v === 'string' ? v.trim() : ''
  }
  const ipRaw =
    typeof req.ip === 'string' && req.ip
      ? req.ip
      : typeof (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress === 'string'
        ? String((req.socket as { remoteAddress?: string }).remoteAddress)
        : ''
  return {
    deviceId: pick('x-employee-device-id').slice(0, 96),
    platform: pick('x-employee-app-platform').slice(0, 120),
    appVersion: pick('x-employee-app-version').slice(0, 40),
    userAgent: pick('user-agent').slice(0, 500),
    lastIp: ipRaw ? ipRaw.slice(0, 64) : null,
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

export function generateAccessToken(): string {
  return randomBytes(32).toString('hex')
}

export function getEmployeeRowByAccessToken(db: Database, token: string): EmployeeRow | undefined {
  const t = String(token ?? '').trim()
  if (!t) return undefined
  return db
    .prepare(`SELECT * FROM employees WHERE trim(employee_access_token) = ?`)
    .get(t) as EmployeeRow | undefined
}

export function validateEmployeeAppAccess(
  db: Database,
  row: EmployeeRow | undefined,
  deviceId?: string,
): row is EmployeeRow {
  if (!row) return false
  const R = row as Record<string, unknown>
  const tok = String(R.employee_access_token ?? '').trim()
  if (!tok) return false
  if (String(R.deleted_at ?? '').trim()) return false
  const stRaw = String(row.status ?? '').toLowerCase()
  if (stRaw === 'deleted' || stRaw === 'geloescht') return false
  if ((row.active ?? 1) === 0) return false
  const st = stRaw
  if (st === 'inactive' || st === 'inaktiv') return false
  if ((row.employee_access_enabled ?? 1) === 0) return false
  const station = getStation(db, row.station_id) as { active?: number } | undefined
  if (!station || (station.active ?? 1) === 0) return false
  const d = deviceId?.trim()
  if (d && isDeviceRequestBlocked(db, row.id, d)) return false
  return true
}

function touchAccessAndDevice(db: Database, row: EmployeeRow, meta?: EmployeeAccessRequestMeta) {
  touchEmployeeAccessUsed(db, row.id)
  const d = meta?.deviceId?.trim()
  if (d) {
    recordEmployeeAppDeviceVisit(db, {
      employeeId: row.id,
      stationId: row.station_id,
      deviceId: d,
      userAgent: meta?.userAgent ?? '',
      platform: meta?.platform ?? '',
      lastIp: meta?.lastIp ?? null,
    })
  }
}

export function resolveEmployeeAccessContext(
  db: Database,
  token: string,
  meta?: EmployeeAccessRequestMeta,
): { ok: true; row: EmployeeRow } | { ok: false } {
  const row = getEmployeeRowByAccessToken(db, token)
  const deviceId = meta?.deviceId?.trim() || undefined
  if (!validateEmployeeAppAccess(db, row, deviceId)) return { ok: false }
  touchAccessAndDevice(db, row, meta)
  return { ok: true, row }
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
    vollzeit: 'Vollzeit',
    'chef / administrator': 'Chef / Administrator',
    'chef/administrator': 'Chef / Administrator',
  }
  if (empRole && map[empRole]) return map[empRole]!
  if (empRole) return empRole.charAt(0).toUpperCase() + empRole.slice(1)
  return ''
}

function publicEmployee(row: EmployeeRow) {
  const R = row as Record<string, unknown>
  const annual = R.annual_vacation_days
  const vhpd = R.vacation_hours_per_day
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
    annualVacationDays:
      annual != null && String(annual).trim() !== '' && Number.isFinite(Number(annual)) ? Number(annual) : null,
    vacationHoursPerDay:
      vhpd != null && String(vhpd).trim() !== '' && Number.isFinite(Number(vhpd)) ? Number(vhpd) : null,
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

export function buildEmployeeAccessPayload(db: Database, token: string, meta?: EmployeeAccessRequestMeta) {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  const row = ctx.row
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
    comment: sanitizeAbsenceCommentForEmployeeApp(a.comment),
    requestedAt: a.requestedAt,
    approvedAt: a.approvedAt,
    rejectedReason: a.rejectedReason,
    paid: a.paid,
    countsAgainstVacation: a.countsAgainstVacation,
    paidHoursPerDay: a.paidHoursPerDay,
    paidHoursTotal: a.paidHoursTotal,
    absenceDays: a.absenceDays,
  }))

  const yNow = new Date().getFullYear()
  const vacationSnapshot = buildVacationSnapshotForEmployee(db, stationId, empId, yNow)

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

  const activeShiftWarnings = listActiveShiftWarningsForEmployee(db, empId)

  return {
    ok: true as const,
    employee: publicEmployee(row),
    station: publicStation(db, stationId),
    workAreas,
    shifts,
    tasks,
    taskLogs,
    absences,
    vacationSnapshot,
    timeEntries,
    runningTimeEntry: running,
    activeShiftWarnings,
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

export function buildEmployeeWeekSchedule(
  db: Database,
  token: string,
  weekStart?: string,
  meta?: EmployeeAccessRequestMeta,
) {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  const row = ctx.row
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

export function employeeAccessCheckIn(db: Database, token: string, force: boolean, meta?: EmployeeAccessRequestMeta) {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, result: 'invalid_token' as const, message: EMPLOYEE_APP_ACCESS_DENIED_MESSAGE }
  }
  const row = ctx.row
  return clockCheckInByEmployeeId(db, {
    employeeId: row.id,
    stationId: row.station_id,
    force,
    source: 'employee_mobile_app',
    startedBy: 'Mitarbeiter-App',
  })
}

export function employeeAccessListShiftWarnings(db: Database, token: string, meta?: EmployeeAccessRequestMeta) {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  const row = ctx.row
  return { ok: true as const, data: listActiveShiftWarningsForEmployee(db, row.id) }
}

export function employeeAccessAcknowledgeShiftWarning(db: Database, token: string, warningId: string, meta?: EmployeeAccessRequestMeta) {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  const row = ctx.row
  try {
    acknowledgeShiftWarning(db, warningId, row.id)
    return { ok: true as const }
  } catch {
    return { ok: false as const, error: 'ack_failed' as const }
  }
}

export function employeeAccessCheckOutStart(db: Database, token: string, meta?: EmployeeAccessRequestMeta) {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, result: 'invalid_token' as const, message: EMPLOYEE_APP_ACCESS_DENIED_MESSAGE }
  }
  const row = ctx.row
  return clockCheckOutStartByEmployeeId(db, {
    employeeId: row.id,
    stationId: row.station_id,
  })
}

export function employeeAccessCheckOutComplete(
  db: Database,
  token: string,
  body: { timeEntryId: string; checklist: Record<string, unknown> },
  meta?: EmployeeAccessRequestMeta,
) {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, error: EMPLOYEE_APP_ACCESS_DENIED_MESSAGE }
  }
  const row = ctx.row
  const te = listTimeEntries(db, {
    stationId: row.station_id,
    employeeId: row.id,
    status: 'running',
  })[0]
  if (!te || te.id !== body.timeEntryId) {
    return { ok: false as const, error: 'Kein passender laufender Eintrag.' }
  }
  return clockCheckOutComplete(db, {
    timeEntryId: body.timeEntryId,
    checklist: body.checklist,
    endedBy: row.display_name ?? 'Mitarbeiter-App',
  })
}

export function employeeAccessListAbsences(db: Database, token: string, meta?: EmployeeAccessRequestMeta) {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  const row = ctx.row
  const data = listAbsences(db, { stationId: row.station_id, employeeId: row.id }).map((a) => ({
    ...a,
    comment: sanitizeAbsenceCommentForEmployeeApp(a.comment) ?? '',
  }))
  return { ok: true as const, data }
}

export function employeeAccessCreateAbsence(
  db: Database,
  token: string,
  body: Record<string, unknown>,
  meta?: EmployeeAccessRequestMeta,
):
  | { ok: true; data: ReturnType<typeof createAbsence> }
  | { ok: false; error: 'invalid_token' }
  | { ok: false; error: 'vacation_ack_required'; details: Record<string, unknown> } {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  const row = ctx.row
  const safe: Record<string, unknown> = { ...(body ?? {}) }
  delete safe.employeeId
  try {
    assertPaidVacationCreateAllowed(db, row.station_id, row.id, safe, {
      startDate: String(safe.startDate ?? '').trim(),
      endDate: String(safe.endDate ?? '').trim(),
      halfDay: safe.halfDay === true,
      typeInput: String(safe.type ?? '').trim(),
    })
  } catch (e) {
    if (e instanceof VacationAckRequiredError) {
      return { ok: false as const, error: 'vacation_ack_required' as const, details: e.details }
    }
    throw e
  }
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

export function employeeAccessGetTasks(db: Database, token: string, meta?: EmployeeAccessRequestMeta) {
  const full = buildEmployeeAccessPayload(db, token, meta)
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
  meta?: EmployeeAccessRequestMeta,
) {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) {
    return { ok: false as const, error: 'invalid_token' as const }
  }
  const row = ctx.row
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

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

function daysInclusive(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split('-').map(Number)
  const [y2, m2, d2] = toYmd.split('-').map(Number)
  const a = new Date(y1, m1 - 1, d1).getTime()
  const b = new Date(y2, m2 - 1, d2).getTime()
  return Math.floor((b - a) / 86400000) + 1
}

function workedMinutesEntry(startAt: string, endAt: string | undefined, breakMinutes: number, nowMs: number): number {
  const s = new Date(startAt).getTime()
  const e = endAt ? new Date(endAt).getTime() : nowMs
  const raw = Math.max(0, Math.round((e - s) / 60000))
  return Math.max(0, raw - Math.max(0, Math.round(breakMinutes || 0)))
}

function hoursFromWorkedMinutes(mins: number): number {
  return Math.round((mins / 60) * 100) / 100
}

function mapEmployeeTimeEntryReadStatus(
  te: ReturnType<typeof rowToTimeEntryApi>,
): 'running' | 'pending_approval' | 'approved' | 'correction_required' | 'rejected' {
  if (te.status === 'running') return 'running'
  if (te.approvalStatus === 'approved') return 'approved'
  if (te.approvalStatus === 'rejected') return 'rejected'
  if (te.approvalStatus === 'correction_required') return 'correction_required'
  return 'pending_approval'
}

export type EmployeeAccessTimeEntryRead = {
  id: string
  date: string
  plannedStart?: string
  plannedEnd?: string
  clockInAt: string
  clockOutAt?: string
  pauseMinutes: number
  totalHours: number
  status: 'running' | 'pending_approval' | 'approved' | 'correction_required' | 'rejected'
}

export type EmployeeAccessMyShiftRow = {
  id: string
  date: string
  startTime: string
  endTime: string
  workAreaId?: string
  shiftType?: string
  status?: string
}

export function employeeAccessListMyShiftsForRange(
  db: Database,
  token: string,
  fromYmd: string,
  toYmd: string,
  meta?: EmployeeAccessRequestMeta,
):
  | { ok: true; data: { from: string; to: string; shifts: EmployeeAccessMyShiftRow[] } }
  | { ok: false; error: 'invalid_token' | 'bad_range' } {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) return { ok: false as const, error: 'invalid_token' as const }
  const f = String(fromYmd ?? '').trim()
  const t = String(toYmd ?? '').trim()
  if (!YMD_RE.test(f) || !YMD_RE.test(t) || f > t) return { ok: false as const, error: 'bad_range' as const }
  if (daysInclusive(f, t) > 62) return { ok: false as const, error: 'bad_range' as const }
  const row = ctx.row
  const shifts = listShifts(db, {
    stationId: row.station_id,
    employeeId: row.id,
    from: f,
    to: t,
  }).map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    workAreaId: s.workAreaId,
    shiftType: s.shiftType,
    status: s.status,
  }))
  return { ok: true as const, data: { from: f, to: t, shifts } }
}

export function employeeAccessListTimeEntriesReadModel(
  db: Database,
  token: string,
  fromYmd: string,
  toYmd: string,
  meta?: EmployeeAccessRequestMeta,
):
  | {
      ok: true
      data: {
        month: string
        from: string
        to: string
        summary: { entryCount: number; totalHours: number; approvedHours: number; pendingHours: number }
        entries: EmployeeAccessTimeEntryRead[]
      }
    }
  | { ok: false; error: 'invalid_token' | 'bad_range' } {
  const ctx = resolveEmployeeAccessContext(db, token, meta)
  if (!ctx.ok) return { ok: false as const, error: 'invalid_token' as const }
  const f = String(fromYmd ?? '').trim()
  const t = String(toYmd ?? '').trim()
  if (!YMD_RE.test(f) || !YMD_RE.test(t) || f > t) return { ok: false as const, error: 'bad_range' as const }
  if (daysInclusive(f, t) > 93) return { ok: false as const, error: 'bad_range' as const }
  const row = ctx.row
  const fromIso = `${f}T00:00:00.000Z`
  const toIso = `${t}T23:59:59.999Z`
  const rows = listTimeEntries(db, {
    stationId: row.station_id,
    employeeId: row.id,
    from: fromIso,
    to: toIso,
  })
  const nowMs = Date.now()
  const shiftCache = new Map<string, { plannedStart?: string; plannedEnd?: string }>()
  const entriesOut: EmployeeAccessTimeEntryRead[] = []
  let totalMins = 0
  let approvedMins = 0
  for (const te of rows) {
    const mins = workedMinutesEntry(te.startAt, te.endAt, te.breakMinutes ?? 0, nowMs)
    totalMins += mins
    const st = mapEmployeeTimeEntryReadStatus(te)
    if (st === 'approved') approvedMins += mins

    let plannedStart: string | undefined
    let plannedEnd: string | undefined
    if (te.shiftId) {
      let cached = shiftCache.get(te.shiftId)
      if (cached === undefined) {
        const sh = getShift(db, te.shiftId)
        cached = sh ? { plannedStart: sh.startTime, plannedEnd: sh.endTime } : {}
        shiftCache.set(te.shiftId, cached)
      }
      plannedStart = cached.plannedStart
      plannedEnd = cached.plannedEnd
    }
    const dateKey = te.startAt.slice(0, 10)
    entriesOut.push({
      id: te.id,
      date: dateKey,
      plannedStart,
      plannedEnd,
      clockInAt: te.startAt,
      clockOutAt: te.endAt,
      pauseMinutes: te.breakMinutes ?? 0,
      totalHours: hoursFromWorkedMinutes(mins),
      status: st,
    })
  }
  entriesOut.sort((a, b) => (a.date === b.date ? b.clockInAt.localeCompare(a.clockInAt) : b.date.localeCompare(a.date)))
  const month = f.slice(0, 7)
  const pendingMins = Math.max(0, totalMins - approvedMins)
  return {
    ok: true as const,
    data: {
      month,
      from: f,
      to: t,
      summary: {
        entryCount: entriesOut.length,
        totalHours: hoursFromWorkedMinutes(totalMins),
        approvedHours: hoursFromWorkedMinutes(approvedMins),
        pendingHours: hoursFromWorkedMinutes(pendingMins),
      },
      entries: entriesOut,
    },
  }
}
