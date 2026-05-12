import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'

const TYPE_TO_DE: Record<string, string> = {
  vacation: 'urlaub',
  sick: 'krankheit',
  school: 'berufsschule',
  day_off: 'frei',
  special_leave: 'sonderurlaub',
  unpaid: 'unbezahlt',
  child_sick: 'kind_krank',
  other: 'sonstiges',
}

const DE_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_DE).map(([k, v]) => [v, k]),
)

const STATUS_TO_DE: Record<string, string> = {
  requested: 'beantragt',
  approved: 'genehmigt',
  rejected: 'abgelehnt',
  cancelled: 'storniert',
}

const DE_TO_STATUS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_TO_DE).map(([k, v]) => [v, k]),
)

export type AbsenceRow = {
  id: string
  station_id: string
  employee_id: string
  type: string
  start_date: string
  end_date: string
  half_day: number | null
  status: string
  comment: string | null
  requested_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejected_reason: string | null
}

export function rowToAbsenceApi(r: AbsenceRow) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    type: (TYPE_TO_DE[r.type] ?? 'sonstiges') as string,
    startDate: r.start_date,
    endDate: r.end_date,
    halfDay: (r.half_day ?? 0) === 1,
    status: (STATUS_TO_DE[r.status] ?? 'beantragt') as string,
    comment: r.comment ?? '',
    requestedAt: r.requested_at ?? nowIso(),
    approvedBy: r.approved_by ?? undefined,
    approvedAt: r.approved_at ?? undefined,
    rejectedReason: r.rejected_reason ?? undefined,
    rejectedBy: r.rejected_by ?? undefined,
    rejectedAt: r.rejected_at ?? undefined,
  }
}

export function listAbsences(
  db: Database,
  q: {
    stationId?: string
    from?: string
    to?: string
    employeeId?: string
    status?: string
    type?: string
  },
) {
  const stationId = q.stationId ?? DEFAULT_STATION_ID
  let sql = `SELECT * FROM absences WHERE station_id = ?`
  const params: string[] = [stationId]
  if (q.from) {
    sql += ` AND end_date >= ?`
    params.push(q.from)
  }
  if (q.to) {
    sql += ` AND start_date <= ?`
    params.push(q.to)
  }
  if (q.employeeId) {
    sql += ` AND employee_id = ?`
    params.push(q.employeeId)
  }
  if (q.status) {
    const st = DE_TO_STATUS[q.status] ?? q.status
    sql += ` AND status = ?`
    params.push(st)
  }
  if (q.type) {
    const ty = DE_TO_TYPE[q.type] ?? q.type
    sql += ` AND type = ?`
    params.push(ty)
  }
  sql += ` ORDER BY start_date`
  const rows = db.prepare(sql).all(...params) as AbsenceRow[]
  return rows.map(rowToAbsenceApi)
}

export function countRequestedAbsences(db: Database, stationId = DEFAULT_STATION_ID): number {
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM absences WHERE station_id = ? AND status = 'requested'`)
    .get(stationId) as { c: number }
  return row?.c ?? 0
}

function formatDeYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`
}

const ABS_TYPE_SNIPPET_DE: Record<string, string> = {
  vacation: 'Urlaub',
  day_off: 'Frei',
  sick: 'Krank',
  special_leave: 'Sonderurlaub',
  child_sick: 'Kind krank',
  unpaid: 'Unbezahlt',
  other: 'Sonstiges',
  school: 'Berufsschule',
}

/** Letzte offene Antrags-Zeile für Benachrichtigungstext (Name + Zeitraum). */
export function getLatestRequestedAbsenceSnippet(db: Database, stationId: string): string | null {
  const r = db
    .prepare(
      `SELECT e.display_name as dn, a.type as ty, a.start_date as sd, a.end_date as ed
       FROM absences a
       JOIN employees e ON e.id = a.employee_id
       WHERE a.station_id = ? AND a.status = 'requested'
       ORDER BY datetime(COALESCE(a.requested_at, a.created_at, a.updated_at)) DESC
       LIMIT 1`,
    )
    .get(stationId) as { dn: string; ty: string; sd: string; ed: string } | undefined
  if (!r) return null
  const t = ABS_TYPE_SNIPPET_DE[r.ty] ?? 'Abwesenheit'
  return `${r.dn} beantragt ${t} vom ${formatDeYmd(r.sd)} bis ${formatDeYmd(r.ed)}.`
}

export function getAbsence(db: Database, id: string) {
  const r = db.prepare(`SELECT * FROM absences WHERE id = ?`).get(id) as AbsenceRow | undefined
  return r ? rowToAbsenceApi(r) : undefined
}

export function createAbsence(db: Database, body: Record<string, unknown>, stationId = DEFAULT_STATION_ID) {
  const employeeId = String(body.employeeId ?? '').trim()
  const typeDe = String(body.type ?? '').trim()
  const startDate = String(body.startDate ?? '').trim()
  const endDate = String(body.endDate ?? '').trim()
  if (!employeeId) throw new Error('employee_id erforderlich')
  if (!typeDe) throw new Error('type erforderlich')
  if (!startDate) throw new Error('start_date erforderlich')
  if (!endDate) throw new Error('end_date erforderlich')
  const type = DE_TO_TYPE[typeDe] ?? typeDe
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `abs-${randomUUID()}`
  const ts = nowIso()
  const status = DE_TO_STATUS[String(body.status ?? 'beantragt')] ?? 'requested'
  db.prepare(
    `INSERT INTO absences (id, station_id, employee_id, type, start_date, end_date, half_day, status, comment, requested_at, approved_by, approved_at, rejected_by, rejected_at, rejected_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
  ).run(
    id,
    stationId,
    employeeId,
    type,
    startDate,
    endDate,
    body.halfDay === true ? 1 : 0,
    status,
    String(body.comment ?? ''),
    ts,
    ts,
    ts,
  )
  return getAbsence(db, id)
}

export function updateAbsence(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM absences WHERE id = ?`).get(id) as AbsenceRow | undefined
  if (!existing) throw new Error('Abwesenheit nicht gefunden')
  const ts = nowIso()
  const type =
    body.type != null ? DE_TO_TYPE[String(body.type)] ?? String(body.type) : existing.type
  const status =
    body.status != null ? DE_TO_STATUS[String(body.status)] ?? String(body.status) : existing.status
  db.prepare(
    `UPDATE absences SET
      employee_id = COALESCE(?, employee_id),
      type = ?,
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      half_day = COALESCE(?, half_day),
      status = ?,
      comment = COALESCE(?, comment),
      updated_at = ?
    WHERE id = ?`,
  ).run(
    body.employeeId != null ? String(body.employeeId) : null,
    type,
    body.startDate != null ? String(body.startDate) : null,
    body.endDate != null ? String(body.endDate) : null,
    body.halfDay != null ? (body.halfDay ? 1 : 0) : null,
    status,
    body.comment != null ? String(body.comment) : null,
    ts,
    id,
  )
  return getAbsence(db, id)
}

export function deleteAbsence(db: Database, id: string) {
  const r = db.prepare(`DELETE FROM absences WHERE id = ?`).run(id)
  if (r.changes === 0) throw new Error('Abwesenheit nicht gefunden')
}

export function approveAbsence(db: Database, id: string, by = 'Station') {
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE absences SET status = 'approved', approved_by = ?, approved_at = ?, rejected_reason = NULL, rejected_by = NULL, rejected_at = NULL, updated_at = ? WHERE id = ?`,
    )
    .run(by, ts, ts, id)
  if (r.changes === 0) throw new Error('Abwesenheit nicht gefunden')
  return getAbsence(db, id)
}

export function rejectAbsence(db: Database, id: string, reason: string | undefined, rejectedByUserId?: string) {
  const trimmed = String(reason ?? '').trim()
  if (!trimmed) throw new Error('Ablehnungsgrund erforderlich')
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE absences SET status = 'rejected', rejected_reason = ?, rejected_by = ?, rejected_at = ?, approved_by = NULL, approved_at = NULL, updated_at = ? WHERE id = ?`,
    )
    .run(trimmed, rejectedByUserId ?? null, ts, ts, id)
  if (r.changes === 0) throw new Error('Abwesenheit nicht gefunden')
  return getAbsence(db, id)
}

export function cancelAbsence(db: Database, id: string) {
  const existing = db.prepare(`SELECT status FROM absences WHERE id = ?`).get(id) as { status: string } | undefined
  if (!existing) throw new Error('Abwesenheit nicht gefunden')
  if (existing.status !== 'requested') throw new Error('Nur beantragte Abwesenheiten können storniert werden')
  const ts = nowIso()
  const r = db
    .prepare(`UPDATE absences SET status = 'cancelled', updated_at = ? WHERE id = ?`)
    .run(ts, id)
  if (r.changes === 0) throw new Error('Abwesenheit nicht gefunden')
  return getAbsence(db, id)
}
