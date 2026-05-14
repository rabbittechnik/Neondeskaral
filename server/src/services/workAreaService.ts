import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'

export type WorkAreaRow = {
  id: string
  station_id: string
  name: string
  short_code: string | null
  color: string | null
  description: string | null
  active: number | null
  sort_order?: number | null
  is_default?: number | null
}

export function rowToWorkAreaApi(r: WorkAreaRow) {
  return {
    id: r.id,
    name: r.name,
    shortCode: r.short_code ?? '',
    color: r.color ?? '#94a3b8',
    description: r.description ?? '',
    sortOrder: Number(r.sort_order ?? 0),
    isDefault: (r.is_default ?? 0) === 1,
    active: (r.active ?? 1) === 1,
  }
}

export function listWorkAreas(
  db: Database,
  stationId = DEFAULT_STATION_ID,
  opts?: { includeInactive?: boolean },
) {
  let sql = `SELECT * FROM work_areas WHERE station_id = ?`
  if (!opts?.includeInactive) {
    sql += ` AND (active IS NULL OR active = 1)`
  }
  sql += ` ORDER BY COALESCE(sort_order, 0) ASC, name ASC`
  const rows = db.prepare(sql).all(stationId) as WorkAreaRow[]
  return rows.map(rowToWorkAreaApi)
}

export function getWorkArea(db: Database, id: string) {
  const r = db.prepare(`SELECT * FROM work_areas WHERE id = ?`).get(id) as WorkAreaRow | undefined
  return r ? rowToWorkAreaApi(r) : undefined
}

export function getWorkAreaStationId(db: Database, id: string): string | undefined {
  const r = db.prepare(`SELECT station_id FROM work_areas WHERE id = ?`).get(id) as { station_id: string } | undefined
  return r?.station_id
}

function nextSortOrder(db: Database, stationId: string): number {
  const row = db
    .prepare(`SELECT MAX(COALESCE(sort_order, 0)) as m FROM work_areas WHERE station_id = ?`)
    .get(stationId) as { m: number | null }
  return Number(row?.m ?? 0) + 1
}

export function createWorkArea(db: Database, body: Record<string, unknown>, stationId = DEFAULT_STATION_ID) {
  const name = String(body.name ?? '').trim()
  if (!name) throw new Error('name erforderlich')
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : randomUUID()
  const ts = nowIso()
  const sortOrder =
    body.sortOrder != null && Number.isFinite(Number(body.sortOrder)) ? Math.floor(Number(body.sortOrder)) : nextSortOrder(db, stationId)
  const isDefault = body.isDefault === true || Number(body.isDefault) === 1 ? 1 : 0
  if (isDefault === 1) {
    db.prepare(`UPDATE work_areas SET is_default = 0, updated_at = ? WHERE station_id = ?`).run(ts, stationId)
  }
  db.prepare(
    `INSERT INTO work_areas (id, station_id, name, short_code, color, description, active, sort_order, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
  ).run(
    id,
    stationId,
    name,
    String(body.shortCode ?? '').trim() || null,
    String(body.color ?? '#94a3b8'),
    String(body.description ?? '') || null,
    sortOrder,
    isDefault,
    ts,
    ts,
  )
  return getWorkArea(db, id)
}

export function updateWorkArea(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM work_areas WHERE id = ?`).get(id) as WorkAreaRow | undefined
  if (!existing) throw new Error('Arbeitsbereich nicht gefunden')
  const ts = nowIso()
  const sid = existing.station_id
  const wantDefault = body.isDefault === true || Number(body.isDefault) === 1
  if (body.isDefault != null && wantDefault) {
    db.prepare(`UPDATE work_areas SET is_default = 0, updated_at = ? WHERE station_id = ?`).run(ts, sid)
  }
  const r = db
    .prepare(
      `UPDATE work_areas SET
        name = COALESCE(?, name),
        short_code = COALESCE(?, short_code),
        color = COALESCE(?, color),
        description = COALESCE(?, description),
        active = COALESCE(?, active),
        sort_order = COALESCE(?, sort_order),
        is_default = COALESCE(?, is_default),
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      body.name != null ? String(body.name) : null,
      body.shortCode != null ? String(body.shortCode) : null,
      body.color != null ? String(body.color) : null,
      body.description != null ? String(body.description) : null,
      body.active != null ? (body.active === false || Number(body.active) === 0 ? 0 : 1) : null,
      body.sortOrder != null && Number.isFinite(Number(body.sortOrder)) ? Math.floor(Number(body.sortOrder)) : null,
      body.isDefault != null ? (wantDefault ? 1 : 0) : null,
      ts,
      id,
    )
  if (r.changes === 0) throw new Error('Arbeitsbereich nicht gefunden')
  return getWorkArea(db, id)
}

export function deleteWorkArea(db: Database, id: string) {
  const ts = nowIso()
  const r = db.prepare(`UPDATE work_areas SET active = 0, updated_at = ? WHERE id = ?`).run(ts, id)
  if (r.changes === 0) throw new Error('Arbeitsbereich nicht gefunden')
}
