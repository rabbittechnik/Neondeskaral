import type { Database } from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { findUserByUsername } from './authService.js'
import { appendUserAudit } from './userAuditLogService.js'

/** Hauptadministrator — darf nicht eingeschränkt oder gelöscht werden. */
export const CHIEF_ADMIN_USER_ID = 'user-max-vins'

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
  email: string | null
  lastLoginAt: string | null
  globalAdmin: boolean
  active: boolean
  stationAccess: StationAccessDto[]
}

function roleIdForUser(globalAdmin: boolean): string {
  return globalAdmin ? 'role-admin' : 'role-station-team-lead'
}

export function listManagedUsers(db: Database): ManagedUserDto[] {
  const users = db
    .prepare(
      `SELECT id, username, email, display_name, last_login_at,
              COALESCE(global_admin,0) as ga, COALESCE(active,1) as ac
       FROM users ORDER BY display_name COLLATE NOCASE`,
    )
    .all() as {
    id: string
    username: string | null
    email: string | null
    display_name: string | null
    last_login_at: string | null
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
      email: u.email?.trim() ? u.email.trim() : null,
      lastLoginAt: u.last_login_at?.trim() ? u.last_login_at.trim() : null,
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
  email?: string
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
  const email = String(input.email ?? '').trim() || null
  const password = String(input.password ?? '').trim()
  if (!username) throw new Error('Benutzername erforderlich')
  if (!displayName) throw new Error('Name erforderlich')
  if (findUserByUsername(db, username)) throw new Error('Benutzername bereits vergeben')

  const id = randomUUID()
  const ts = nowIso()
  const passwordHash = password ? bcrypt.hashSync(password, 10) : 'not-set'
  const globalAdmin = input.globalAdmin === true ? 1 : 0
  const active = input.active === false ? 0 : 1
  const rid = roleIdForUser(globalAdmin === 1)

  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, display_name, role_id, global_admin, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, username, email, passwordHash, displayName, rid, globalAdmin, active, ts, ts)

  if (!globalAdmin) {
    const stationIds = [...new Set(input.stationIds.map((s) => String(s).trim()).filter(Boolean))]
    if (stationIds.length === 0) throw new Error('Mindestens eine Station wählen')
    replaceStationAccessForUser(db, id, stationIds, input.role || 'teamleiter', input.permissions, createdBy, ts)
  }
  appendUserAudit(db, {
    userId: createdBy,
    action: 'user.created',
    targetUserId: id,
    details: { username, globalAdmin: globalAdmin === 1 },
    createdBy,
  })
  return getManagedUser(db, id)
}

export function updateManagedUser(db: Database, userId: string, input: UpsertManagedUserInput, actorId: string) {
  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as
    | { id: string; global_admin: number | null }
    | undefined
  if (!existing) throw new Error('Benutzer nicht gefunden')

  if (userId === CHIEF_ADMIN_USER_ID) {
    if (input.globalAdmin !== true) throw new Error('Max Vins muss Administrator bleiben.')
    if (input.active === false) throw new Error('Der Hauptadministrator kann nicht deaktiviert werden.')
  }

  const username = String(input.username ?? '').trim().toLowerCase()
  const displayName = String(input.displayName ?? '').trim()
  const prevEmail = db.prepare(`SELECT email FROM users WHERE id = ?`).get(userId) as { email: string | null } | undefined
  const email =
    input.email !== undefined ? (String(input.email).trim() || null) : (prevEmail?.email ?? null)
  if (!username) throw new Error('Benutzername erforderlich')
  if (!displayName) throw new Error('Name erforderlich')

  const other = db
    .prepare(`SELECT id FROM users WHERE lower(trim(username)) = ? AND id != ?`)
    .get(username, userId) as { id: string } | undefined
  if (other) throw new Error('Benutzername bereits vergeben')

  const ts = nowIso()
  const globalAdmin = input.globalAdmin === true ? 1 : 0
  const active = input.active === false ? 0 : 1
  const rid = roleIdForUser(globalAdmin === 1)

  if (input.password && input.password.trim()) {
    const hash = bcrypt.hashSync(input.password.trim(), 10)
    db.prepare(
      `UPDATE users SET username = ?, email = ?, display_name = ?, password_hash = ?, role_id = ?, global_admin = ?, active = ?, updated_at = ? WHERE id = ?`,
    ).run(username, email, displayName, hash, rid, globalAdmin, active, ts, userId)
  } else {
    db.prepare(
      `UPDATE users SET username = ?, email = ?, display_name = ?, role_id = ?, global_admin = ?, active = ?, updated_at = ? WHERE id = ?`,
    ).run(username, email, displayName, rid, globalAdmin, active, ts, userId)
  }

  db.prepare(`DELETE FROM user_station_access WHERE user_id = ?`).run(userId)
  if (!globalAdmin) {
    const stationIds = [...new Set(input.stationIds.map((s) => String(s).trim()).filter(Boolean))]
    if (stationIds.length === 0) throw new Error('Mindestens eine Station wählen')
    replaceStationAccessForUser(db, userId, stationIds, input.role || 'teamleiter', input.permissions, actorId, ts)
  }
  appendUserAudit(db, {
    userId: actorId,
    action: 'user.updated',
    targetUserId: userId,
    createdBy: actorId,
  })
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
    .prepare(
      `SELECT id, username, email, display_name, last_login_at, COALESCE(global_admin,0) as ga, COALESCE(active,1) as ac FROM users WHERE id = ?`,
    )
    .get(userId) as
    | {
        id: string
        username: string | null
        email: string | null
        display_name: string | null
        last_login_at: string | null
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
    email: u.email?.trim() ? u.email.trim() : null,
    lastLoginAt: u.last_login_at?.trim() ? u.last_login_at.trim() : null,
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

export function resetUserPassword(db: Database, userId: string, plain: string, actorId: string) {
  const p = String(plain ?? '').trim()
  if (p.length < 4) throw new Error('Passwort zu kurz')
  const hash = bcrypt.hashSync(p, 10)
  const ts = nowIso()
  const r = db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(hash, ts, userId)
  if (r.changes === 0) throw new Error('Benutzer nicht gefunden')
  appendUserAudit(db, {
    userId: actorId,
    action: 'user.password_reset',
    targetUserId: userId,
    createdBy: actorId,
  })
}

export function setUserActive(db: Database, userId: string, active: boolean, actorId: string) {
  if (userId === CHIEF_ADMIN_USER_ID && !active) {
    throw new Error('Der Hauptadministrator kann nicht deaktiviert werden.')
  }
  const ts = nowIso()
  const r = db.prepare(`UPDATE users SET active = ?, updated_at = ? WHERE id = ?`).run(active ? 1 : 0, ts, userId)
  if (r.changes === 0) throw new Error('Benutzer nicht gefunden')
  appendUserAudit(db, {
    userId: actorId,
    action: active ? 'user.enabled' : 'user.disabled',
    targetUserId: userId,
    createdBy: actorId,
  })
}

export function deleteManagedUser(db: Database, userId: string, actorId: string) {
  if (userId === CHIEF_ADMIN_USER_ID) {
    throw new Error('Der Hauptadministrator kann nicht gelöscht werden.')
  }
  db.prepare(`DELETE FROM user_station_access WHERE user_id = ?`).run(userId)
  const r = db.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
  if (r.changes === 0) throw new Error('Benutzer nicht gefunden')
  appendUserAudit(db, {
    userId: actorId,
    action: 'user.deleted',
    targetUserId: userId,
    createdBy: actorId,
  })
}
