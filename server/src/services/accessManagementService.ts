import type { Database } from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { findUserByUsername } from './authService.js'

function parsePermissionsJson(raw: string | null | undefined): Record<string, boolean> {
  try {
    const o = JSON.parse(String(raw ?? '{}')) as Record<string, unknown>
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(o)) out[k] = Boolean(v)
    return out
  } catch {
    return {}
  }
}

export type StationAccessDto = {
  id: string
  stationId: string
  role: string
  permissions: Record<string, boolean>
  active: number
}

export type ManagedUserDto = {
  id: string
  username: string
  displayName: string
  globalAdmin: boolean
  active: boolean
  stationAccess: StationAccessDto[]
}

export function listManagedUsers(db: Database): ManagedUserDto[] {
  const users = db
    .prepare(
      `SELECT id, username, display_name, COALESCE(global_admin,0) as ga, COALESCE(active,1) as ac FROM users ORDER BY display_name`,
    )
    .all() as {
    id: string
    username: string | null
    display_name: string | null
    ga: number
    ac: number
  }[]
  const accStmt = db.prepare(`SELECT * FROM user_station_access WHERE user_id = ? ORDER BY station_id`)
  return users.map((u) => {
    const rows = accStmt.all(u.id) as {
      id: string
      station_id: string
      role: string
      permissions_json: string
      active: number | null
    }[]
    return {
      id: u.id,
      username: u.username ?? '',
      displayName: u.display_name ?? '',
      globalAdmin: (u.ga ?? 0) === 1,
      active: (u.ac ?? 1) === 1,
      stationAccess: rows.map((r) => ({
        id: r.id,
        stationId: r.station_id,
        role: r.role,
        permissions: parsePermissionsJson(r.permissions_json),
        active: (r.active ?? 1) === 1 ? 1 : 0,
      })),
    }
  })
}

export type UpsertManagedUserInput = {
  displayName: string
  username: string
  password?: string
  globalAdmin?: boolean
  active?: boolean
  /** Ignoriert wenn globalAdmin. */
  stationIds: string[]
  role: string
  permissions: Record<string, boolean>
}

export function createManagedUser(db: Database, input: UpsertManagedUserInput, createdBy: string) {
  const username = String(input.username ?? '').trim().toLowerCase()
  const displayName = String(input.displayName ?? '').trim()
  const password = String(input.password ?? '')
  if (!username) throw new Error('Benutzername erforderlich')
  if (!displayName) throw new Error('Name erforderlich')
  if (!password) throw new Error('Passwort erforderlich')
  if (findUserByUsername(db, username)) throw new Error('Benutzername bereits vergeben')

  const id = randomUUID()
  const ts = nowIso()
  const hash = bcrypt.hashSync(password, 10)
  const globalAdmin = input.globalAdmin === true ? 1 : 0
  const active = input.active === false ? 0 : 1

  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, display_name, role_id, global_admin, active, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, 'role-admin', ?, ?, ?, ?)`,
  ).run(id, username, hash, displayName, globalAdmin, active, ts, ts)

  if (!globalAdmin) {
    const stationIds = [...new Set(input.stationIds.map((s) => String(s).trim()).filter(Boolean))]
    if (stationIds.length === 0) throw new Error('Mindestens eine Station wählen')
    replaceStationAccessForUser(db, id, stationIds, input.role || 'teamleiter', input.permissions, createdBy, ts)
  }
  return getManagedUser(db, id)
}

export function updateManagedUser(db: Database, userId: string, input: UpsertManagedUserInput, actorId: string) {
  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as { id: string; global_admin: number | null } | undefined
  if (!existing) throw new Error('Benutzer nicht gefunden')

  const username = String(input.username ?? '').trim().toLowerCase()
  const displayName = String(input.displayName ?? '').trim()
  if (!username) throw new Error('Benutzername erforderlich')
  if (!displayName) throw new Error('Name erforderlich')

  const other = db
    .prepare(`SELECT id FROM users WHERE lower(trim(username)) = ? AND id != ?`)
    .get(username, userId) as { id: string } | undefined
  if (other) throw new Error('Benutzername bereits vergeben')

  const ts = nowIso()
  const globalAdmin = input.globalAdmin === true ? 1 : 0
  const active = input.active === false ? 0 : 1

  if (input.password && input.password.trim()) {
    const hash = bcrypt.hashSync(input.password, 10)
    db.prepare(
      `UPDATE users SET username = ?, display_name = ?, password_hash = ?, global_admin = ?, active = ?, updated_at = ? WHERE id = ?`,
    ).run(username, displayName, hash, globalAdmin, active, ts, userId)
  } else {
    db.prepare(`UPDATE users SET username = ?, display_name = ?, global_admin = ?, active = ?, updated_at = ? WHERE id = ?`).run(
      username,
      displayName,
      globalAdmin,
      active,
      ts,
      userId,
    )
  }

  db.prepare(`DELETE FROM user_station_access WHERE user_id = ?`).run(userId)
  if (!globalAdmin) {
    const stationIds = [...new Set(input.stationIds.map((s) => String(s).trim()).filter(Boolean))]
    if (stationIds.length === 0) throw new Error('Mindestens eine Station wählen')
    replaceStationAccessForUser(db, userId, stationIds, input.role || 'teamleiter', input.permissions, actorId, ts)
  }
  return getManagedUser(db, userId)
}

function replaceStationAccessForUser(
  db: Database,
  userId: string,
  stationIds: string[],
  role: string,
  permissions: Record<string, boolean>,
  createdBy: string,
  ts: string,
) {
  const permJson = JSON.stringify(permissions ?? {})
  const ins = db.prepare(
    `INSERT INTO user_station_access (id, user_id, station_id, role, permissions_json, active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  )
  for (const sid of stationIds) {
    ins.run(randomUUID(), userId, sid, role, permJson, createdBy, ts, ts)
  }
}

export function getManagedUser(db: Database, userId: string): ManagedUserDto | undefined {
  const u = db
    .prepare(`SELECT id, username, display_name, COALESCE(global_admin,0) as ga, COALESCE(active,1) as ac FROM users WHERE id = ?`)
    .get(userId) as
    | {
        id: string
        username: string | null
        display_name: string | null
        ga: number
        ac: number
      }
    | undefined
  if (!u) return undefined
  const rows = db
    .prepare(`SELECT * FROM user_station_access WHERE user_id = ? ORDER BY station_id`)
    .all(userId) as {
    id: string
    station_id: string
    role: string
    permissions_json: string
    active: number | null
  }[]
  return {
    id: u.id,
    username: u.username ?? '',
    displayName: u.display_name ?? '',
    globalAdmin: (u.ga ?? 0) === 1,
    active: (u.ac ?? 1) === 1,
    stationAccess: rows.map((r) => ({
      id: r.id,
      stationId: r.station_id,
      role: r.role,
      permissions: parsePermissionsJson(r.permissions_json),
      active: (r.active ?? 1) === 1 ? 1 : 0,
    })),
  }
}

export function resetUserPassword(db: Database, userId: string, plain: string) {
  const p = String(plain ?? '').trim()
  if (p.length < 4) throw new Error('Passwort zu kurz')
  const hash = bcrypt.hashSync(p, 10)
  const ts = nowIso()
  const r = db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(hash, ts, userId)
  if (r.changes === 0) throw new Error('Benutzer nicht gefunden')
}
