import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'

export type AuditLogRow = {
  id: string
  user_id: string | null
  action: string
  target_user_id: string | null
  station_id: string | null
  details_json: string | null
  created_at: string
  created_by: string | null
}

export function appendUserAudit(
  db: Database,
  row: {
    userId: string | null
    action: string
    targetUserId?: string | null
    stationId?: string | null
    details?: Record<string, unknown>
    createdBy?: string | null
  },
) {
  const id = randomUUID()
  const ts = nowIso()
  const detailsJson = row.details && Object.keys(row.details).length ? JSON.stringify(row.details) : null
  db.prepare(
    `INSERT INTO user_audit_log (id, user_id, action, target_user_id, station_id, details_json, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    row.userId,
    row.action,
    row.targetUserId ?? null,
    row.stationId ?? null,
    detailsJson,
    ts,
    row.createdBy ?? null,
  )
}

export function listUserAuditLog(db: Database, limit = 200): AuditLogRow[] {
  const n = Math.min(Math.max(Number(limit) || 200, 1), 500)
  return db
    .prepare(
      `SELECT id, user_id, action, target_user_id, station_id, details_json, created_at, created_by
       FROM user_audit_log ORDER BY datetime(created_at) DESC LIMIT ?`,
    )
    .all(n) as AuditLogRow[]
}
