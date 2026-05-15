import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { markWeekHasUnpublishedChangesIfPublished } from './weekSchedulePublicationService.js'

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
    Number(body.breakMinutes ?? 0),
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
  markWeekHasUnpublishedChangesIfPublished(db, sid, date)
  return getShift(db, id)
}

export type BulkCreateShiftsResult = {
  created: ReturnType<typeof rowToScheduleShift>[]
  skipped: { date: string; reason: string }[]
  errors: { date: string; message: string }[]
}

/** Mehrere Schichten (gleiche Zeiten/Typ) in einem Vorgang — immer als Entwurf. */
export function createShiftsBulk(
  db: Database,
  body: Record<string, unknown>,
  stationId: string,
): BulkCreateShiftsResult {
  const sid = String(stationId ?? '').trim()
  if (!sid) throw new Error('stationId erforderlich')
  const rawDates = body.dates
  const dates = Array.isArray(rawDates)
    ? [...new Set(rawDates.map((d) => String(d).trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))]
    : []
  if (dates.length === 0) throw new Error('dates (Array von YYYY-MM-DD) erforderlich')

  const created: ReturnType<typeof rowToScheduleShift>[] = []
  const skipped: { date: string; reason: string }[] = []
  const errors: { date: string; message: string }[] = []

  const base = {
    employeeId: body.employeeId,
    workAreaId: body.workAreaId,
    startTime: body.startTime,
    endTime: body.endTime,
    breakMinutes: body.breakMinutes ?? 0,
    shiftType: body.shiftType ?? 'frueh',
    note: body.note ?? '',
    status: 'Entwurf',
    published: false,
    conflict: body.conflict === true,
  }

  for (const date of dates) {
    try {
      const shift = createShift(db, { ...base, date }, sid)
      if (shift) created.push(shift)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      if (msg.includes('UNIQUE') || msg.includes('bereits')) {
        skipped.push({ date, reason: msg })
      } else {
        errors.push({ date, message: msg })
      }
    }
  }

  return { created, skipped, errors }
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
  const updated = getShift(db, id)
  if (updated?.date) markWeekHasUnpublishedChangesIfPublished(db, existing.station_id, updated.date)
  return updated
}

export function deleteShift(db: Database, id: string) {
  const existing = db.prepare(`SELECT station_id, date FROM shifts WHERE id = ?`).get(id) as
    | { station_id: string; date: string }
    | undefined
  const r = db.prepare(`DELETE FROM shifts WHERE id = ?`).run(id)
  if (r.changes === 0) throw new Error('Schicht nicht gefunden')
  if (existing) markWeekHasUnpublishedChangesIfPublished(db, existing.station_id, existing.date)
}

export function publishShift(db: Database, id: string) {
  const ts = nowIso()
  const r = db.prepare(`UPDATE shifts SET published = 1, status = 'published', updated_at = ? WHERE id = ?`).run(ts, id)
  if (r.changes === 0) throw new Error('Schicht nicht gefunden')
  return getShift(db, id)
}

/** @deprecated Veröffentlichung läuft über weekly_schedule_publications — siehe weekSchedulePublicationService.publishWeekSchedule */
export function publishWeek(db: Database, weekMondayIso: string, stationId: string) {
  const mon = new Date(`${weekMondayIso}T12:00:00`)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const from = weekMondayIso
  const to = toStr(sun)
  return { ok: true as const, from, to }
}

export function getShiftRow(db: Database, id: string): ShiftRow | undefined {
  return db.prepare(`SELECT * FROM shifts WHERE id = ?`).get(id) as ShiftRow | undefined
}

const COVERAGE_TOL_MIN = 15

function timeToMinutesDb(t: string): number {
  const raw = String(t ?? '').trim()
  const short = raw.length >= 5 ? raw.slice(0, 5) : raw
  const [h, m] = short.split(':').map(Number)
  return (Number.isFinite(h) ? h! : 0) * 60 + (Number.isFinite(m) ? m! : 0)
}

function minutesToHHMMDb(total: number): string {
  const m = Math.max(0, Math.min(total, 24 * 60 - 1))
  const h = Math.floor(m / 60)
  const mi = m % 60
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}

function clipAssignedRowToWindow(
  row: ShiftRow,
  reqStartMin: number,
  reqEndMin: number,
): { start: number; end: number } | null {
  if (!row.employee_id || !String(row.employee_id).trim()) return null
  if (String(row.shift_type ?? '').trim() === 'frei') return null
  const sm = timeToMinutesDb(row.start_time)
  let em = timeToMinutesDb(row.end_time)
  const overnight = String(row.shift_type ?? '').trim() === 'nacht'
  if (overnight && em <= sm) em += 24 * 60
  const a = Math.max(sm, reqStartMin)
  const b = Math.min(em, reqEndMin)
  if (b <= a) return null
  return { start: a, end: b }
}

/** Echte Lücken in [reqStart, reqEnd] (HH:MM) relativ zu besetzten Schichten am Tag. */
function coverageGapsForWindow(
  reqStart: string,
  reqEnd: string,
  dayRows: ShiftRow[],
  tolMinutes: number,
): { startTime: string; endTime: string }[] {
  const reqS = timeToMinutesDb(reqStart)
  const reqE = timeToMinutesDb(reqEnd)
  if (reqE <= reqS) return []

  const clips: { start: number; end: number }[] = []
  for (const r of dayRows) {
    const c = clipAssignedRowToWindow(r, reqS, reqE)
    if (c) clips.push(c)
  }
  clips.sort((x, y) => x.start - y.start)

  const merged: { start: number; end: number }[] = []
  for (const iv of clips) {
    const last = merged[merged.length - 1]
    if (!last) {
      merged.push({ ...iv })
      continue
    }
    if (iv.start <= last.end + tolMinutes) {
      last.end = Math.max(last.end, iv.end)
    } else {
      merged.push({ ...iv })
    }
  }

  const gaps: { startTime: string; endTime: string }[] = []
  let cursor = reqS
  for (const m of merged) {
    if (m.start > cursor + tolMinutes) {
      gaps.push({ startTime: minutesToHHMMDb(cursor), endTime: minutesToHHMMDb(Math.min(m.start, reqE)) })
    }
    cursor = Math.max(cursor, m.end)
  }
  if (reqE > cursor + tolMinutes) {
    gaps.push({ startTime: minutesToHHMMDb(cursor), endTime: minutesToHHMMDb(reqE) })
  }
  return gaps
}

/**
 * Entfernt offene Schichten (ohne Mitarbeiter), deren Zeitfenster vollständig durch andere
 * besetzte Schichten am selben Tag abgedeckt ist.
 */
export function pruneRedundantOpenShifts(db: Database, stationId: string, from: string, to: string) {
  const sid = String(stationId ?? '').trim()
  if (!sid) throw new Error('stationId erforderlich')
  const openRows = db
    .prepare(
      `SELECT * FROM shifts WHERE station_id = ? AND date >= ? AND date <= ? AND (employee_id IS NULL OR trim(employee_id) = '')`,
    )
    .all(sid, from, to) as ShiftRow[]

  const del = db.prepare(`DELETE FROM shifts WHERE id = ?`)
  const deletedIds: string[] = []
  for (const o of openRows) {
    const dayRows = db.prepare(`SELECT * FROM shifts WHERE station_id = ? AND date = ?`).all(sid, o.date) as ShiftRow[]
    const gaps = coverageGapsForWindow(o.start_time, o.end_time, dayRows, COVERAGE_TOL_MIN)
    if (gaps.length === 0) {
      del.run(o.id)
      deletedIds.push(o.id)
    }
  }
  return { deletedIds }
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
