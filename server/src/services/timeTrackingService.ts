import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'

export type TimeEntryRow = {
  id: string
  station_id: string
  employee_id: string
  shift_id: string | null
  start_at: string
  end_at: string | null
  break_minutes: number | null
  status: string | null
  source: string | null
  started_by: string | null
  ended_by: string | null
  start_note: string | null
  end_note: string | null
  created_at: string | null
  updated_at: string | null
}

export function rowToTimeEntryApi(r: TimeEntryRow) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    stationId: r.station_id,
    shiftId: r.shift_id ?? undefined,
    startAt: r.start_at,
    endAt: r.end_at ?? undefined,
    breakMinutes: r.break_minutes ?? 0,
    status: r.status ?? 'running',
    source: r.source ?? 'manual',
    startedBy: r.started_by ?? 'System',
    endedBy: r.ended_by ?? undefined,
    startNote: r.start_note ?? undefined,
    endNote: r.end_note ?? undefined,
    createdAt: r.created_at ?? nowIso(),
    updatedAt: r.updated_at ?? nowIso(),
  }
}

export function listTimeEntries(
  db: Database,
  q: { stationId?: string; employeeId?: string; from?: string; to?: string; status?: string },
) {
  const stationId = q.stationId ?? DEFAULT_STATION_ID
  let sql = `SELECT * FROM time_entries WHERE station_id = ?`
  const params: string[] = [stationId]
  if (q.employeeId) {
    sql += ` AND employee_id = ?`
    params.push(q.employeeId)
  }
  if (q.from) {
    sql += ` AND start_at >= ?`
    params.push(q.from)
  }
  if (q.to) {
    sql += ` AND start_at <= ?`
    params.push(q.to)
  }
  if (q.status) {
    sql += ` AND status = ?`
    params.push(q.status)
  }
  sql += ` ORDER BY start_at DESC`
  return (db.prepare(sql).all(...params) as TimeEntryRow[]).map(rowToTimeEntryApi)
}

export function listRunning(db: Database, stationId = DEFAULT_STATION_ID) {
  const rows = db
    .prepare(`SELECT * FROM time_entries WHERE station_id = ? AND status = 'running' ORDER BY start_at`)
    .all(stationId) as TimeEntryRow[]
  return rows.map(rowToTimeEntryApi)
}

export function listToday(db: Database, stationId = DEFAULT_STATION_ID) {
  const d = new Date()
  const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const rows = db
    .prepare(`SELECT * FROM time_entries WHERE station_id = ? AND start_at LIKE ? ORDER BY start_at DESC`)
    .all(stationId, `${prefix}%`) as TimeEntryRow[]
  return rows.map(rowToTimeEntryApi)
}

export function getTimeEntry(db: Database, id: string) {
  const r = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
  return r ? rowToTimeEntryApi(r) : undefined
}

export function createManualTimeEntry(db: Database, body: Record<string, unknown>, stationId = DEFAULT_STATION_ID) {
  const employeeId = String(body.employeeId ?? '').trim()
  const startAt = String(body.startAt ?? '').trim()
  if (!employeeId) throw new Error('employee_id erforderlich')
  if (!startAt) throw new Error('start_at erforderlich')
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `te-${randomUUID()}`
  const ts = nowIso()
  db.prepare(
    `INSERT INTO time_entries (id, station_id, employee_id, shift_id, start_at, end_at, break_minutes, status, source, started_by, ended_by, start_note, end_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run(
    id,
    stationId,
    employeeId,
    body.shiftId != null ? String(body.shiftId) : null,
    startAt,
    body.endAt != null ? String(body.endAt) : null,
    Number(body.breakMinutes ?? 0),
    String(body.status ?? 'running'),
    String(body.source ?? 'manual'),
    String(body.startedBy ?? 'manual'),
    body.startNote != null ? String(body.startNote) : null,
    body.endNote != null ? String(body.endNote) : null,
    ts,
    ts,
  )
  return getTimeEntry(db, id)
}

export function updateTimeEntry(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
  if (!existing) throw new Error('Zeiteintrag nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE time_entries SET
      start_at = COALESCE(?, start_at),
      end_at = ?,
      break_minutes = COALESCE(?, break_minutes),
      status = COALESCE(?, status),
      source = COALESCE(?, source),
      end_note = ?,
      ended_by = ?,
      updated_at = ?
    WHERE id = ?`,
  ).run(
    body.startAt != null ? String(body.startAt) : null,
    body.endAt !== undefined ? (body.endAt == null ? null : String(body.endAt)) : existing.end_at,
    body.breakMinutes != null ? Number(body.breakMinutes) : null,
    body.status != null ? String(body.status) : null,
    body.source != null ? String(body.source) : null,
    body.endNote !== undefined ? (body.endNote == null ? null : String(body.endNote)) : existing.end_note,
    body.endedBy !== undefined ? (body.endedBy == null ? null : String(body.endedBy)) : existing.ended_by,
    ts,
    id,
  )
  return getTimeEntry(db, id)
}

export function closeTimeEntry(db: Database, id: string, endedBy?: string) {
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE time_entries SET end_at = ?, status = 'completed', ended_by = ?, updated_at = ? WHERE id = ? AND status = 'running'`,
    )
    .run(ts, endedBy ?? 'System', ts, id)
  if (r.changes === 0) throw new Error('Kein laufender Eintrag oder nicht gefunden')
  return getTimeEntry(db, id)
}

export function getRunningForEmployee(db: Database, employeeId: string, stationId = DEFAULT_STATION_ID) {
  const r = db
    .prepare(
      `SELECT * FROM time_entries WHERE employee_id = ? AND station_id = ? AND status = 'running' ORDER BY start_at DESC LIMIT 1`,
    )
    .get(employeeId, stationId) as TimeEntryRow | undefined
  return r ? rowToTimeEntryApi(r) : undefined
}

export function insertChecklist(
  db: Database,
  timeEntryId: string,
  employeeId: string,
  checklist: Record<string, unknown>,
) {
  const id = `chk-${randomUUID()}`
  const ts = nowIso()
  db.prepare(
    `INSERT INTO shift_close_checklists (
      id, time_entry_id, employee_id,
      fridge_fronted, drinks_filled, cigarettes_filled, shelves_filled, trash_emptied,
      counter_clean, coffee_area_clean, outside_checked, incidents_noted, handover_possible,
      closing_ready, everything_ok, incident_note, completed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    timeEntryId,
    employeeId,
    checklist.fridgeFronted ? 1 : 0,
    checklist.drinksFilled ? 1 : 0,
    checklist.cigarettesFilled ? 1 : 0,
    checklist.shelvesFilled ? 1 : 0,
    checklist.trashEmptied ? 1 : 0,
    checklist.counterClean ? 1 : 0,
    checklist.coffeeAreaClean ? 1 : 0,
    checklist.outsideChecked ? 1 : 0,
    checklist.incidentsNoted ? 1 : 0,
    checklist.handoverPossible ? 1 : 0,
    checklist.closingReady ? 1 : 0,
    checklist.everythingOk ? 1 : 0,
    String(checklist.incidentNote ?? ''),
    ts,
    ts,
  )
  return id
}

export function logCardEvent(
  db: Database,
  p: {
    cardNumber: string
    employeeId?: string | null
    stationId: string
    actionType: string
    result: string
    message: string
  },
) {
  const id = `cev-${randomUUID()}`
  const ts = nowIso()
  db.prepare(
    `INSERT INTO card_entry_events (id, card_number, employee_id, station_id, action_type, entered_at, result, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    p.cardNumber,
    p.employeeId ?? null,
    p.stationId,
    p.actionType,
    ts,
    p.result,
    p.message,
    ts,
  )
}
