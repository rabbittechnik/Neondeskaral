import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'

export type ShiftRow = {
  id: string
  station_id: string
  employee_id: string | null
  work_area_id: string
  date: string
  start_time: string
  end_time: string
  break_minutes: number | null
  shift_type: string | null
  title: string | null
  note: string | null
  color: string | null
  status: string | null
  published: number | null
  conflict: number | null
  import_source?: string | null
  created_by?: string | null
  updated_by?: string | null
  emp_display_name?: string | null
  emp_color?: string | null
  emp_deleted_at?: string | null
}

export function rowToScheduleShift(r: ShiftRow) {
  const published = (r.published ?? 0) === 1
  const empName = String(r.emp_display_name ?? '').trim()
  const empColor = String(r.emp_color ?? '').trim()
  const empDel = String(r.emp_deleted_at ?? '').trim()
  return {
    id: r.id,
    employeeId: r.employee_id ?? undefined,
    workAreaId: r.work_area_id,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    breakMinutes: r.break_minutes ?? 0,
    shiftType: (r.shift_type ?? 'frueh') as string,
    note: r.note ?? '',
    status: (published ? 'Veröffentlicht' : 'Entwurf') as 'Entwurf' | 'Veröffentlicht',
    color: r.color ?? undefined,
    conflict: (r.conflict ?? 0) === 1,
    importSource: r.import_source ?? undefined,
    employeeDisplayName: empName || undefined,
    employeeColor: empColor || undefined,
    employeeRemovedFromManagement: empDel ? true : undefined,
  }
}

export function listShifts(
  db: Database,
  q: {
    stationId: string
    from?: string
    to?: string
    employeeId?: string
    workAreaId?: string
  },
) {
  const stationId = String(q.stationId ?? '').trim()
  if (!stationId) throw new Error('stationId erforderlich')
  let sql = `SELECT s.*, e.display_name AS emp_display_name, e.color AS emp_color, e.deleted_at AS emp_deleted_at
    FROM shifts s
    LEFT JOIN employees e ON e.id = s.employee_id
    WHERE s.station_id = ?`
  const params: string[] = [stationId]
  if (q.from) {
    sql += ` AND s.date >= ?`
    params.push(q.from)
  }
  if (q.to) {
    sql += ` AND s.date <= ?`
    params.push(q.to)
  }
  if (q.employeeId) {
    sql += ` AND s.employee_id = ?`
    params.push(q.employeeId)
  }
  if (q.workAreaId) {
    sql += ` AND s.work_area_id = ?`
    params.push(q.workAreaId)
  }
  sql += ` ORDER BY s.date, s.start_time`
  const rows = db.prepare(sql).all(...params) as ShiftRow[]
  return rows.map(rowToScheduleShift)
}

export function getShift(db: Database, id: string) {
  const r = db
    .prepare(
      `SELECT s.*, e.display_name AS emp_display_name, e.color AS emp_color, e.deleted_at AS emp_deleted_at
       FROM shifts s
       LEFT JOIN employees e ON e.id = s.employee_id
       WHERE s.id = ?`,
    )
    .get(id) as ShiftRow | undefined
  return r ? rowToScheduleShift(r) : undefined
}

export function listOpenShifts(db: Database, stationId: string) {
  const sid = String(stationId ?? '').trim()
  if (!sid) throw new Error('stationId erforderlich')
  const rows = db
    .prepare(
      `SELECT * FROM shifts WHERE station_id = ? AND employee_id IS NULL ORDER BY date, start_time`,
    )
    .all(sid) as ShiftRow[]
  return rows.map(rowToScheduleShift)
}

export function listConflicts(
  db: Database,
  stationId: string,
  range?: { from?: string; to?: string },
) {
  const sid = String(stationId ?? '').trim()
  if (!sid) throw new Error('stationId erforderlich')
  let sql = `SELECT * FROM shifts WHERE station_id = ? AND conflict = 1`
  const params: string[] = [sid]
  if (range?.from) {
    sql += ` AND date >= ?`
    params.push(range.from)
  }
  if (range?.to) {
    sql += ` AND date <= ?`
    params.push(range.to)
  }
  sql += ` ORDER BY date, start_time`
  const rows = db.prepare(sql).all(...params) as ShiftRow[]
  return rows.map(rowToScheduleShift)
}

export function createShift(db: Database, body: Record<string, unknown>, stationId: string) {
  const sid = String(stationId ?? '').trim()
  if (!sid) throw new Error('stationId erforderlich')
  const date = String(body.date ?? '').trim()
  const startTime = String(body.startTime ?? '').trim()
  const endTime = String(body.endTime ?? '').trim()
  const workAreaId = String(body.workAreaId ?? '').trim()
  if (!date) throw new Error('date erforderlich')
  if (!startTime) throw new Error('start_time erforderlich')
  if (!endTime) throw new Error('end_time erforderlich')
  if (!workAreaId) throw new Error('work_area_id erforderlich')
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `sh-${randomUUID()}`
  const ts = nowIso()
  const published = body.status === 'Veröffentlicht' || body.published === true ? 1 : 0
  const employeeId =
    body.employeeId === null || body.employeeId === '' || body.employeeId === undefined
      ? null
      : String(body.employeeId)

  const importSource =
    body.importSource != null && String(body.importSource).trim()
      ? String(body.importSource).trim()
      : null

  db.prepare(
    `INSERT INTO shifts (
      id, station_id, employee_id, work_area_id, date, start_time, end_time, break_minutes,
      shift_type, title, note, color, status, published, conflict, import_source, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
  ).run(
    id,
    sid,
    employeeId,
    workAreaId,
    date,
    startTime,
    endTime,
    Number(body.breakMinutes ?? 30),
    String(body.shiftType ?? 'frueh'),
    body.title != null ? String(body.title) : null,
    String(body.note ?? ''),
    body.color != null ? String(body.color) : null,
    published ? 'published' : 'draft',
    published,
    body.conflict === true ? 1 : 0,
    importSource,
    ts,
    ts,
  )
  return getShift(db, id)
}

export function updateShift(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM shifts WHERE id = ?`).get(id) as ShiftRow | undefined
  if (!existing) throw new Error('Schicht nicht gefunden')
  const ts = nowIso()
  const published =
    body.status === 'Veröffentlicht'
      ? 1
      : body.status === 'Entwurf'
        ? 0
        : body.published === true
          ? 1
          : body.published === false
            ? 0
            : (existing.published ?? 0)

  const employeeId =
    body.employeeId === undefined
      ? existing.employee_id
      : body.employeeId === null || body.employeeId === ''
        ? null
        : String(body.employeeId)

  const importSource =
    body.importSource !== undefined
      ? body.importSource == null || body.importSource === ''
        ? null
        : String(body.importSource)
      : existing.import_source ?? null

  const updatedBy =
    body.updatedBy !== undefined && body.updatedBy !== null && String(body.updatedBy).trim()
      ? String(body.updatedBy).trim()
      : existing.updated_by ?? null

  db.prepare(
    `UPDATE shifts SET
      employee_id = ?,
      work_area_id = COALESCE(?, work_area_id),
      date = COALESCE(?, date),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      break_minutes = COALESCE(?, break_minutes),
      shift_type = COALESCE(?, shift_type),
      note = COALESCE(?, note),
      color = ?,
      status = ?,
      published = ?,
      conflict = COALESCE(?, conflict),
      import_source = ?,
      updated_by = ?,
      updated_at = ?
    WHERE id = ?`,
  ).run(
    employeeId,
    body.workAreaId != null ? String(body.workAreaId) : null,
    body.date != null ? String(body.date) : null,
    body.startTime != null ? String(body.startTime) : null,
    body.endTime != null ? String(body.endTime) : null,
    body.breakMinutes != null ? Number(body.breakMinutes) : null,
    body.shiftType != null ? String(body.shiftType) : null,
    body.note != null ? String(body.note) : null,
    body.color !== undefined ? (body.color == null ? null : String(body.color)) : existing.color,
    published ? 'published' : 'draft',
    published,
    body.conflict != null ? (body.conflict ? 1 : 0) : null,
    importSource,
    updatedBy,
    ts,
    id,
  )
  return getShift(db, id)
}

export function deleteShift(db: Database, id: string) {
  const r = db.prepare(`DELETE FROM shifts WHERE id = ?`).run(id)
  if (r.changes === 0) throw new Error('Schicht nicht gefunden')
}

export function publishShift(db: Database, id: string) {
  const ts = nowIso()
  const r = db.prepare(`UPDATE shifts SET published = 1, status = 'published', updated_at = ? WHERE id = ?`).run(ts, id)
  if (r.changes === 0) throw new Error('Schicht nicht gefunden')
  return getShift(db, id)
}

export function publishWeek(db: Database, weekMondayIso: string, stationId: string) {
  const sid = String(stationId ?? '').trim()
  if (!sid) throw new Error('stationId erforderlich')
  const mon = new Date(`${weekMondayIso}T12:00:00`)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const from = toStr(mon)
  const to = toStr(sun)
  const ts = nowIso()
  db.prepare(
    `UPDATE shifts SET published = 1, status = 'published', updated_at = ? WHERE station_id = ? AND date >= ? AND date <= ?`,
  ).run(ts, sid, from, to)
  return { ok: true as const, from, to }
}

export function getShiftRow(db: Database, id: string): ShiftRow | undefined {
  return db.prepare(`SELECT * FROM shifts WHERE id = ?`).get(id) as ShiftRow | undefined
}

export function listShiftRowsForStationDateRange(
  db: Database,
  stationId: string,
  from: string,
  to: string,
): ShiftRow[] {
  return db
    .prepare(`SELECT * FROM shifts WHERE station_id = ? AND date >= ? AND date <= ?`)
    .all(stationId, from, to) as ShiftRow[]
}
