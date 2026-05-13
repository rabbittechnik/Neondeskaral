import type { Database } from 'better-sqlite3'
import type { Request } from 'express'
import { randomBytes, randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { getStation } from './stationService.js'

export type StationTabletDeviceRow = {
  id: string
  station_id: string
  name: string
  description: string | null
  tablet_token: string
  is_active: number
  first_seen_at: string | null
  last_seen_at: string | null
  last_ip: string | null
  user_agent: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  revoked_at: string | null
  revoked_by: string | null
}

function maskTokenTail(tok: string | null | undefined): string | null {
  const t = String(tok ?? '').trim()
  if (!t) return null
  if (t.length <= 6) return '****'
  return `****${t.slice(-6)}`
}

export function clientIpFromRequest(req: Request): string | null {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0]!.trim().slice(0, 64)
  }
  const ip = req.ip ?? (req.socket?.remoteAddress ?? '')
  return ip ? String(ip).slice(0, 64) : null
}

function userAgentFromRequest(req: Request): string | null {
  const ua = req.get('user-agent')
  return ua ? ua.slice(0, 500) : null
}

function newTabletToken(): string {
  return randomBytes(32).toString('hex')
}

function isStationActive(db: Database, stationId: string): boolean {
  const st = db.prepare(`SELECT active FROM stations WHERE id = ?`).get(stationId) as { active: number | null } | undefined
  if (!st) return false
  return st.active == null || st.active === 1
}

/** Session / erste Anfrage: Gerät anfassen, Station liefern. */
export function touchTabletByToken(db: Database, tabletToken: string, req: Request): StationTabletDeviceRow | null {
  const t = tabletToken.trim()
  if (!t) return null
  const row = db
    .prepare(`SELECT * FROM station_tablet_devices WHERE tablet_token = ?`)
    .get(t) as StationTabletDeviceRow | undefined
  if (!row || row.is_active !== 1) return null
  if (!isStationActive(db, row.station_id)) return null

  const ts = nowIso()
  const ip = clientIpFromRequest(req)
  const ua = userAgentFromRequest(req)
  const first = row.first_seen_at?.trim() ? row.first_seen_at : ts
  db.prepare(
    `UPDATE station_tablet_devices SET
      first_seen_at = COALESCE(first_seen_at, ?),
      last_seen_at = ?,
      last_ip = ?,
      user_agent = ?,
      updated_at = ?
     WHERE id = ?`,
  ).run(first, ts, ip, ua, ts, row.id)

  return db.prepare(`SELECT * FROM station_tablet_devices WHERE id = ?`).get(row.id) as StationTabletDeviceRow
}

/** Nur prüfen (ohne Touch), z. B. vor sensiblen Aktionen. */
export function getActiveTabletByToken(db: Database, tabletToken: string): StationTabletDeviceRow | null {
  const t = tabletToken.trim()
  if (!t) return null
  const row = db
    .prepare(`SELECT * FROM station_tablet_devices WHERE tablet_token = ?`)
    .get(t) as StationTabletDeviceRow | undefined
  if (!row || row.is_active !== 1) return null
  if (!isStationActive(db, row.station_id)) return null
  return row
}

export function listStationTabletsForApi(db: Database, stationId: string) {
  const station = getStation(db, stationId) as { name?: string } | undefined
  const stationName = String(station?.name ?? stationId)
  const rows = db
    .prepare(
      `SELECT * FROM station_tablet_devices WHERE station_id = ? ORDER BY name COLLATE NOCASE, created_at`,
    )
    .all(stationId) as StationTabletDeviceRow[]

  return rows.map((r) => ({
    id: r.id,
    stationId: r.station_id,
    stationName,
    name: r.name,
    description: r.description,
    tokenTail: maskTokenTail(r.tablet_token),
    isActive: r.is_active === 1,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    lastIp: r.last_ip,
    userAgent: r.user_agent,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    revokedAt: r.revoked_at,
  }))
}

export function createStationTablet(
  db: Database,
  opts: { stationId: string; name: string; description?: string | null; createdBy: string | null },
): { device: ReturnType<typeof listStationTabletsForApi>[number]; tabletToken: string } {
  const name = String(opts.name ?? '').trim()
  if (!name) throw new Error('name erforderlich')
  const stationId = String(opts.stationId ?? '').trim()
  if (!stationId) throw new Error('stationId erforderlich')
  if (!getStation(db, stationId)) throw new Error('Station nicht gefunden')
  if (!isStationActive(db, stationId)) throw new Error('Station ist nicht aktiv')

  const ts = nowIso()
  const id = randomUUID()
  let tabletToken = newTabletToken()
  for (let i = 0; i < 5; i++) {
    try {
      db.prepare(
        `INSERT INTO station_tablet_devices (
          id, station_id, name, description, tablet_token, is_active,
          first_seen_at, last_seen_at, last_ip, user_agent,
          created_by, created_at, updated_at, revoked_at, revoked_by
        ) VALUES (?, ?, ?, ?, ?, 1, NULL, NULL, NULL, NULL, ?, ?, ?, NULL, NULL)`,
      ).run(
        id,
        stationId,
        name,
        opts.description != null && String(opts.description).trim() ? String(opts.description).trim() : null,
        tabletToken,
        opts.createdBy,
        ts,
        ts,
      )
      break
    } catch {
      tabletToken = newTabletToken()
      if (i === 4) throw new Error('Token-Kollision')
    }
  }

  const list = listStationTabletsForApi(db, stationId)
  const device = list.find((x) => x.id === id)
  if (!device) throw new Error('Gerät nicht gefunden')
  return { device, tabletToken }
}

export function updateStationTablet(
  db: Database,
  id: string,
  stationId: string,
  body: { name?: string; description?: string | null },
) {
  const row = db
    .prepare(`SELECT * FROM station_tablet_devices WHERE id = ? AND station_id = ?`)
    .get(id, stationId) as StationTabletDeviceRow | undefined
  if (!row) throw new Error('Tablet-Gerät nicht gefunden')

  const ts = nowIso()
  const name = body.name !== undefined ? String(body.name ?? '').trim() : row.name
  if (!name) throw new Error('name erforderlich')
  const desc =
    body.description !== undefined
      ? body.description == null || String(body.description).trim() === ''
        ? null
        : String(body.description).trim()
      : row.description

  db.prepare(`UPDATE station_tablet_devices SET name = ?, description = ?, updated_at = ? WHERE id = ?`).run(
    name,
    desc,
    ts,
    id,
  )
}

export function regenerateStationTabletToken(
  db: Database,
  id: string,
  stationId: string,
): { tabletToken: string; tokenTail: string } {
  const row = db
    .prepare(`SELECT * FROM station_tablet_devices WHERE id = ? AND station_id = ?`)
    .get(id, stationId) as StationTabletDeviceRow | undefined
  if (!row) throw new Error('Tablet-Gerät nicht gefunden')

  const ts = nowIso()
  let tabletToken = newTabletToken()
  for (let i = 0; i < 5; i++) {
    try {
      db.prepare(`UPDATE station_tablet_devices SET tablet_token = ?, updated_at = ? WHERE id = ?`).run(
        tabletToken,
        ts,
        id,
      )
      break
    } catch {
      tabletToken = newTabletToken()
      if (i === 4) throw new Error('Token-Kollision')
    }
  }
  return { tabletToken, tokenTail: maskTokenTail(tabletToken)! }
}

export function disableStationTablet(db: Database, id: string, stationId: string, revokedBy: string) {
  const row = db
    .prepare(`SELECT id FROM station_tablet_devices WHERE id = ? AND station_id = ?`)
    .get(id, stationId) as { id: string } | undefined
  if (!row) throw new Error('Tablet-Gerät nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE station_tablet_devices SET is_active = 0, revoked_at = ?, revoked_by = ?, updated_at = ? WHERE id = ?`,
  ).run(ts, revokedBy, ts, id)
}

export function enableStationTablet(db: Database, id: string, stationId: string) {
  const row = db
    .prepare(`SELECT id FROM station_tablet_devices WHERE id = ? AND station_id = ?`)
    .get(id, stationId) as { id: string } | undefined
  if (!row) throw new Error('Tablet-Gerät nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE station_tablet_devices SET is_active = 1, revoked_at = NULL, revoked_by = NULL, updated_at = ? WHERE id = ?`,
  ).run(ts, id)
}

export function deleteStationTablet(db: Database, id: string, stationId: string): { hardDeleted: boolean } {
  const row = db
    .prepare(`SELECT * FROM station_tablet_devices WHERE id = ? AND station_id = ?`)
    .get(id, stationId) as StationTabletDeviceRow | undefined
  if (!row) throw new Error('Tablet-Gerät nicht gefunden')

  const used = Boolean(row.first_seen_at?.trim() || row.last_seen_at?.trim())
  if (used) {
    disableStationTablet(db, id, stationId, 'delete:soft')
    return { hardDeleted: false }
  }
  db.prepare(`DELETE FROM station_tablet_devices WHERE id = ?`).run(id)
  return { hardDeleted: true }
}

/** Terminal-Body: optional tabletToken setzt stationId verbindlich. */
export function resolveTerminalStationIdFromBody(db: Database, body: Record<string, unknown>, req: Request): string | null {
  const tt = typeof body.tabletToken === 'string' ? body.tabletToken.trim() : ''
  if (tt) {
    const touched = touchTabletByToken(db, tt, req)
    return touched?.station_id ?? null
  }
  const stationId = String(body.stationId ?? '').trim()
  return stationId || null
}
