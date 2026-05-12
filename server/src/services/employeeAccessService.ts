import type { Database } from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'
import type { EmployeeRow } from './employeeService.js'
import { listShifts } from './shiftService.js'
import { listAbsences } from './absenceService.js'
import { listTasks } from './taskService.js'
import { listTimeEntries } from './timeTrackingService.js'
import { getStation } from './stationService.js'
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
    .prepare(
      `SELECT * FROM employees WHERE employee_access_token = ? AND station_id = ? AND (active IS NULL OR active = 1)`,
    )
    .get(t, DEFAULT_STATION_ID) as EmployeeRow | undefined
}

function assertAccessAllowed(row: EmployeeRow) {
  if ((row.active ?? 1) === 0) return false
  if ((row.employee_access_enabled ?? 1) === 0) return false
  if (!row.employee_access_token) return false
  return true
}

function publicEmployee(row: EmployeeRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    role: row.role ?? '',
    stationId: row.station_id,
    color: row.color ?? '#94a3b8',
    terminalEnabled: (row.terminal_enabled ?? 1) === 1,
    timeTrackingEnabled: (row.time_tracking_enabled ?? 1) === 1,
  }
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
    from: fromIso,
    to: toIso,
  })
  const absences = absencesRaw.map((a) => ({
    id: a.id,
    type: a.type,
    startDate: a.startDate,
    endDate: a.endDate,
    status: a.status,
    comment: a.comment,
  }))

  const tasksAll = listTasks(db, stationId)
  const tasks = tasksAll
    .filter((t) => t.assignedType === 'all' || t.assignedEmployeeId === empId)
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      workAreaId: t.workAreaId,
      recurrenceType: t.recurrenceType,
      startDate: t.startDate,
      endDate: t.endDate,
      weekdays: t.weekdays,
      startTime: t.startTime,
      endTime: t.endTime,
      priority: t.priority,
      active: t.active,
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
    shifts,
    tasks,
    absences,
    timeEntries,
    runningTimeEntry: running,
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
