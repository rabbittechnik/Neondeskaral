import type { Database } from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

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
  return {
    token,
    user: {
      id: row.id,
      username: row.username ?? '',
      displayName: row.display_name ?? '',
      roleId: row.role_id ?? '',
    },
  }
}
