import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'

export type VacationBlockRow = {
  id: string
  station_id: string
  title: string
  start_date: string
  end_date: string
  description: string | null
  work_area_ids_json: string | null
  active: number | null
}

export function rowToVacationBlockApi(r: VacationBlockRow) {
  let workAreaIds: string[] = []
  try {
    workAreaIds = r.work_area_ids_json ? (JSON.parse(r.work_area_ids_json) as string[]) : []
  } catch {
    workAreaIds = []
  }
  return {
    id: r.id,
    title: r.title,
    startDate: r.start_date,
    endDate: r.end_date,
    description: r.description ?? '',
    workAreaIds,
    active: (r.active ?? 1) === 1,
  }
}

export function listVacationBlocks(db: Database, stationId = DEFAULT_STATION_ID, includeInactive?: boolean) {
  let sql = `SELECT * FROM vacation_blocks WHERE station_id = ?`
  if (!includeInactive) sql += ` AND (active IS NULL OR active = 1)`
  sql += ` ORDER BY start_date`
  const rows = db.prepare(sql).all(stationId) as VacationBlockRow[]
  return rows.map(rowToVacationBlockApi)
}

export function createVacationBlock(db: Database, body: Record<string, unknown>, stationId = DEFAULT_STATION_ID) {
  const title = String(body.title ?? '').trim()
  if (!title) throw new Error('title erforderlich')
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `vb-${randomUUID()}`
  const ts = nowIso()
  db.prepare(
    `INSERT INTO vacation_blocks (id, station_id, title, start_date, end_date, description, work_area_ids_json, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id,
    stationId,
    title,
    String(body.startDate ?? ''),
    String(body.endDate ?? ''),
    String(body.description ?? '') || null,
    JSON.stringify(Array.isArray(body.workAreaIds) ? body.workAreaIds : []),
    ts,
    ts,
  )
  return rowToVacationBlockApi(
    db.prepare(`SELECT * FROM vacation_blocks WHERE id = ?`).get(id) as VacationBlockRow,
  )
}

export function updateVacationBlock(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM vacation_blocks WHERE id = ?`).get(id) as VacationBlockRow | undefined
  if (!existing) throw new Error('Block nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE vacation_blocks SET
      title = COALESCE(?, title),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      description = COALESCE(?, description),
      work_area_ids_json = COALESCE(?, work_area_ids_json),
      active = COALESCE(?, active),
      updated_at = ?
    WHERE id = ?`,
  ).run(
    body.title != null ? String(body.title) : null,
    body.startDate != null ? String(body.startDate) : null,
    body.endDate != null ? String(body.endDate) : null,
    body.description != null ? String(body.description) : null,
    body.workAreaIds != null ? JSON.stringify(body.workAreaIds) : null,
    body.active != null ? (body.active === false || Number(body.active) === 0 ? 0 : 1) : null,
    ts,
    id,
  )
  return rowToVacationBlockApi(db.prepare(`SELECT * FROM vacation_blocks WHERE id = ?`).get(id) as VacationBlockRow)
}

export function deleteVacationBlock(db: Database, id: string) {
  const ts = nowIso()
  const r = db.prepare(`UPDATE vacation_blocks SET active = 0, updated_at = ? WHERE id = ?`).run(ts, id)
  if (r.changes === 0) throw new Error('Block nicht gefunden')
}
