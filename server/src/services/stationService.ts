import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'

export function listStations(db: Database) {
  return db.prepare(`SELECT * FROM stations ORDER BY name`).all()
}

export function getStation(db: Database, id: string) {
  return db.prepare(`SELECT * FROM stations WHERE id = ?`).get(id)
}

export function createStation(db: Database, body: Record<string, unknown>) {
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : randomUUID()
  const name = String(body.name ?? '').trim()
  if (!name) throw new Error('name erforderlich')
  const ts = nowIso()
  db.prepare(
    `INSERT INTO stations (id, name, address, city, postal_code, phone, email, federal_state, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id,
    name,
    body.address != null ? String(body.address) : null,
    body.city != null ? String(body.city) : null,
    body.postalCode != null ? String(body.postalCode) : null,
    body.phone != null ? String(body.phone) : null,
    body.email != null ? String(body.email) : null,
    String(body.federalState ?? 'BW'),
    ts,
    ts,
  )
  return getStation(db, id)
}

export function updateStation(db: Database, id: string, body: Record<string, unknown>) {
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE stations SET
        name = COALESCE(?, name),
        address = ?,
        city = ?,
        postal_code = ?,
        phone = ?,
        email = ?,
        federal_state = COALESCE(?, federal_state),
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      body.name != null ? String(body.name) : null,
      body.address !== undefined ? (body.address == null ? null : String(body.address)) : null,
      body.city !== undefined ? (body.city == null ? null : String(body.city)) : null,
      body.postalCode !== undefined ? (body.postalCode == null ? null : String(body.postalCode)) : null,
      body.phone !== undefined ? (body.phone == null ? null : String(body.phone)) : null,
      body.email !== undefined ? (body.email == null ? null : String(body.email)) : null,
      body.federalState != null ? String(body.federalState) : null,
      ts,
      id,
    )
  if (r.changes === 0) throw new Error('Station nicht gefunden')
  return getStation(db, id)
}

export function deleteStation(db: Database, id: string) {
  const ts = nowIso()
  const r = db.prepare(`UPDATE stations SET active = 0, updated_at = ? WHERE id = ?`).run(ts, id)
  if (r.changes === 0) throw new Error('Station nicht gefunden')
}
