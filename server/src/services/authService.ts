import type { Database } from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
  buildAccessContext,
  listAccessibleStationRows,
  listAllActiveStationRows,
} from './stationAccessService.js'

export type AuthUserRow = {
  id: string
  username: string | null
  display_name: string | null
  role_id: string | null
  active: number | null
  password_hash: string | null
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'neonshift-dev-jwt-secret-change-me'

export type JwtPayload = {
  sub: string
  username: string
  displayName: string
  roleId: string
}

export function signAdminToken(payload: JwtPayload, rememberMe: boolean): string {
  const expiresIn = rememberMe ? '30d' : '12h'
  return jwt.sign(
    {
      sub: payload.sub,
      username: payload.username,
      displayName: payload.displayName,
      roleId: payload.roleId,
    },
    JWT_SECRET,
    { expiresIn },
  )
}

export function verifyAdminToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
    if (!decoded.sub || typeof decoded.sub !== 'string') return null
    return {
      sub: decoded.sub,
      username: String(decoded.username ?? ''),
      displayName: String(decoded.displayName ?? ''),
      roleId: String(decoded.roleId ?? ''),
    }
  } catch {
    return null
  }
}

export function findUserByUsername(db: Database, username: string): AuthUserRow | undefined {
  const u = username.trim().toLowerCase()
  return db
    .prepare(`SELECT * FROM users WHERE lower(trim(username)) = ? AND (active IS NULL OR active = 1)`)
    .get(u) as AuthUserRow | undefined
}

export function verifyPassword(row: AuthUserRow, password: string): boolean {
  const hash = row.password_hash ?? ''
  if (!hash || hash === 'not-set') return false
  return bcrypt.compareSync(password, hash)
}

export function getUserDisplayName(db: Database, userId: string): string {
  const r = db.prepare(`SELECT display_name, username FROM users WHERE id = ?`).get(userId) as
    | { display_name: string | null; username: string | null }
    | undefined
  const dn = r?.display_name?.trim()
  if (dn) return dn
  const u = r?.username?.trim()
  if (u) return u
  return userId
}

export function buildAuthMeUser(db: Database, userId: string) {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role_id,
              r.role_key as role_key, r.role_label as role_label
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
    )
    .get(userId) as
    | {
        id: string
        username: string | null
        display_name: string | null
        role_id: string | null
        role_key: string | null
        role_label: string | null
      }
    | undefined
  if (!row) return null
  const ctx = buildAccessContext(db, userId)
  const stationsRaw = ctx.globalAdmin ? listAllActiveStationRows(db) : listAccessibleStationRows(db, ctx)
  const stations = stationsRaw.map((s) => ({
    id: String(s.id),
    name: String(s.name ?? ''),
    brand: s.brand != null ? String(s.brand) : undefined,
    city: s.city != null ? String(s.city) : undefined,
    federalState: String(s.federal_state ?? 'BW'),
    active: (s.active as number) ?? 1,
  }))
  const stationAccess = ctx.globalAdmin
    ? []
    : ctx.stationIds.map((sid) => ({
        stationId: sid,
        role: ctx.roleByStation.get(sid) ?? 'teamleiter',
        permissions: ctx.permissionsByStation.get(sid) ?? {},
        active: true as const,
      }))
  const canSwitchStation = ctx.globalAdmin || ctx.stationIds.length > 1
  const roleKey = row.role_key?.trim() || undefined
  const roleLabel = row.role_label?.trim() || undefined
  return {
    id: row.id,
    username: row.username ?? '',
    displayName: row.display_name ?? '',
    roleId: row.role_id ?? '',
    roleKey,
    roleLabel,
    globalAdmin: ctx.globalAdmin,
    stations,
    stationAccess,
    canSwitchStation,
  }
}

export function loginAdminUser(
  db: Database,
  body: { username: string; password: string; rememberMe?: boolean },
) {
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')
  if (!username || !password) throw new Error('Benutzername und Passwort erforderlich')
  const row = findUserByUsername(db, username)
  if (!row || !verifyPassword(row, password)) {
    throw new Error('Anmeldung fehlgeschlagen')
  }
  const token = signAdminToken(
    {
      sub: row.id,
      username: row.username ?? '',
      displayName: row.display_name ?? '',
      roleId: row.role_id ?? '',
    },
    Boolean(body.rememberMe),
  )
  const user = buildAuthMeUser(db, row.id)
  if (!user) throw new Error('Benutzerdaten fehlen')
  return {
    token,
    user,
  }
}
