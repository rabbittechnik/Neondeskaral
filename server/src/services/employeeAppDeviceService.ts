import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { getStation } from './stationService.js'

/** Geräte nach QR-Neu-Regenerierung — dürfen sich mit neuem Token wieder anmelden. */
export const RB_TOKEN_REGEN = 'token_regenerated'
/** Zugang per Admin/QR-Bereich deaktiviert — werden bei erneutem „Zugang aktivieren“ wieder freigegeben. */
export const RB_ACCESS_DISABLED = 'access_disabled'
export const RB_ADMIN_DEVICE = 'admin_device'
export const RB_ADMIN_ALL = 'admin_all_devices'
export const RB_EMPLOYEE_INACTIVE = 'employee_inactive'
/** Soft-Delete / aus Verwaltung entfernt — Geräte bleiben gesperrt bis manuell neu freigegeben. */
export const RB_EMPLOYEE_REMOVED = 'employee_removed'
export const RB_SELF_DEVICE = 'self_device'

function buildDeviceLabel(userAgent: string, platform: string): string {
  const ua = userAgent.trim()
  const pl = platform.trim()
  if (pl) return pl.slice(0, 120)
  if (!ua) return 'Unbekanntes Gerät'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS'
  return ua.slice(0, 80)
}

export function revokeAllDevicesForEmployee(db: Database, employeeId: string, revokedBy: string) {
  const ts = nowIso()
  db.prepare(
    `UPDATE employee_app_devices SET is_active = 0, revoked_at = ?, revoked_by = ?, updated_at = ?
     WHERE employee_id = ? AND is_active = 1`,
  ).run(ts, revokedBy, ts, employeeId)
}

export function reactivateDevicesAfterAccessReEnabled(db: Database, employeeId: string) {
  const ts = nowIso()
  db.prepare(
    `UPDATE employee_app_devices SET is_active = 1, revoked_at = NULL, revoked_by = NULL, updated_at = ?
     WHERE employee_id = ? AND revoked_by = ?`,
  ).run(ts, employeeId, RB_ACCESS_DISABLED)
}

export function isDeviceRequestBlocked(db: Database, employeeId: string, deviceId: string): boolean {
  const row = db
    .prepare(`SELECT is_active, revoked_by FROM employee_app_devices WHERE employee_id = ? AND device_id = ?`)
    .get(employeeId, deviceId) as { is_active: number; revoked_by: string | null } | undefined
  if (!row) return false
  if (row.is_active === 1) return false
  if (row.revoked_by === RB_TOKEN_REGEN || row.revoked_by === RB_ACCESS_DISABLED) return false
  return true
}

export function recordEmployeeAppDeviceVisit(
  db: Database,
  params: {
    employeeId: string
    stationId: string
    deviceId: string
    userAgent: string
    platform: string
    lastIp: string | null
  },
) {
  const { employeeId, stationId, deviceId } = params
  if (!deviceId || deviceId.length < 8 || deviceId.length > 96) return
  const ts = nowIso()
  const ua = params.userAgent.slice(0, 500)
  const plat = params.platform.slice(0, 120)
  const ip = params.lastIp ? params.lastIp.slice(0, 64) : null
  const label = buildDeviceLabel(ua, plat)

  const ex = db
    .prepare(`SELECT id, is_active, revoked_by FROM employee_app_devices WHERE employee_id = ? AND device_id = ?`)
    .get(employeeId, deviceId) as { id: string; is_active: number; revoked_by: string | null } | undefined

  if (ex) {
    if (ex.is_active === 0 && (ex.revoked_by === RB_TOKEN_REGEN || ex.revoked_by === RB_ACCESS_DISABLED)) {
      db.prepare(
        `UPDATE employee_app_devices SET is_active = 1, revoked_at = NULL, revoked_by = NULL, last_seen_at = ?, user_agent = ?, platform = ?, last_ip = ?, device_label = ?, updated_at = ? WHERE id = ?`,
      ).run(ts, ua, plat || null, ip, label, ts, ex.id)
      return
    }
    if (ex.is_active === 1) {
      db.prepare(
        `UPDATE employee_app_devices SET last_seen_at = ?, user_agent = ?, platform = COALESCE(NULLIF(?, ''), platform), last_ip = ?, device_label = ?, updated_at = ? WHERE id = ?`,
      ).run(ts, ua, plat, ip, label, ts, ex.id)
    }
    return
  }

  const id = randomUUID()
  db.prepare(
    `INSERT INTO employee_app_devices (
      id, employee_id, station_id, device_id, device_label, user_agent, platform, last_ip,
      first_seen_at, last_seen_at, is_active, revoked_at, revoked_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL, ?, ?)`,
  ).run(id, employeeId, stationId, deviceId, label, ua, plat || null, ip, ts, ts, ts, ts)
}

export function revokeDeviceRowById(
  db: Database,
  rowId: string,
  stationId: string,
  revokedBy: string,
): { employeeId: string } {
  const row = db
    .prepare(`SELECT id, employee_id, station_id FROM employee_app_devices WHERE id = ?`)
    .get(rowId) as { id: string; employee_id: string; station_id: string } | undefined
  if (!row || row.station_id !== stationId) throw new Error('Gerät nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE employee_app_devices SET is_active = 0, revoked_at = ?, revoked_by = ?, updated_at = ? WHERE id = ?`,
  ).run(ts, revokedBy, ts, row.id)
  return { employeeId: row.employee_id }
}

export function revokeDeviceForEmployeeSelf(db: Database, employeeId: string, deviceId: string) {
  const row = db
    .prepare(`SELECT id FROM employee_app_devices WHERE employee_id = ? AND device_id = ?`)
    .get(employeeId, deviceId) as { id: string } | undefined
  if (!row) return
  const ts = nowIso()
  db.prepare(
    `UPDATE employee_app_devices SET is_active = 0, revoked_at = ?, revoked_by = ?, updated_at = ? WHERE id = ?`,
  ).run(ts, RB_SELF_DEVICE, ts, row.id)
}

export type EmployeeAppDeviceRow = {
  id: string
  employee_id: string
  station_id: string
  device_id: string
  device_label: string | null
  user_agent: string | null
  platform: string | null
  last_ip: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  is_active: number
  revoked_at: string | null
  revoked_by: string | null
}

export function listDevicesForEmployee(db: Database, employeeId: string): EmployeeAppDeviceRow[] {
  return db
    .prepare(
      `SELECT * FROM employee_app_devices WHERE employee_id = ? ORDER BY COALESCE(last_seen_at, first_seen_at, '') DESC`,
    )
    .all(employeeId) as EmployeeAppDeviceRow[]
}

type EmpRow = {
  id: string
  display_name: string | null
  station_id: string
  employee_access_token: string | null
  employee_access_enabled: number | null
  employee_access_created_at: string | null
  employee_access_last_used_at: string | null
  active: number | null
  status: string | null
}

export type EmployeeAppAccessOverviewApi = {
  employeeId: string
  employeeName: string
  stationId: string
  stationName: string
  accessEnabled: boolean
  hasToken: boolean
  tokenTail: string | null
  tokenCreatedAt: string | null
  lastUsedAt: string | null
  activeDeviceCount: number
  lastDeviceLabel: string | null
  lastDeviceSeenAt: string | null
  devices: {
    id: string
    deviceLabel: string | null
    platform: string | null
    firstSeenAt: string | null
    lastSeenAt: string | null
    isActive: boolean
    lastIp?: string | null
  }[]
}

function tokenTailMasked(tok: string | null | undefined): string | null {
  const t = String(tok ?? '').trim()
  if (!t) return null
  if (t.length <= 6) return '****'
  return `****${t.slice(-6)}`
}

export function listEmployeeAppAccessOverview(db: Database, stationId: string): EmployeeAppAccessOverviewApi[] {
  const station = getStation(db, stationId) as { name?: string } | undefined
  const stationName = String(station?.name ?? stationId)
  const emps = db
    .prepare(
      `SELECT id, display_name, station_id, employee_access_token, employee_access_enabled,
              employee_access_created_at, employee_access_last_used_at, active, status, deleted_at
       FROM employees WHERE station_id = ?
         AND (deleted_at IS NULL OR trim(deleted_at) = '')
       ORDER BY display_name COLLATE NOCASE`,
    )
    .all(stationId) as (EmpRow & { deleted_at?: string | null })[]
  if (!emps.length) return []

  const allDev = db
    .prepare(`SELECT * FROM employee_app_devices WHERE station_id = ?`)
    .all(stationId) as EmployeeAppDeviceRow[]
  const byEmp = new Map<string, EmployeeAppDeviceRow[]>()
  for (const d of allDev) {
    const arr = byEmp.get(d.employee_id) ?? []
    arr.push(d)
    byEmp.set(d.employee_id, arr)
  }

  return emps.map((e) => {
    const tok = String(e.employee_access_token ?? '').trim()
    const hasToken = Boolean(tok)
    const empActive = (e.active ?? 1) === 1
    const st = String(e.status ?? '').toLowerCase()
    const empStatusOk = st !== 'inactive' && st !== 'inaktiv'
    const accessEnabled =
      hasToken && (e.employee_access_enabled ?? 1) === 1 && empActive && empStatusOk
    const list = (byEmp.get(e.id) ?? []).slice()
    list.sort((a, b) =>
      String(b.last_seen_at ?? b.first_seen_at ?? '').localeCompare(String(a.last_seen_at ?? a.first_seen_at ?? '')),
    )
    const activeDeviceCount = list.filter((d) => d.is_active === 1).length
    const lastActive = list.find((d) => d.is_active === 1) ?? list[0]
    return {
      employeeId: e.id,
      employeeName: String(e.display_name ?? '').trim() || 'Mitarbeiter',
      stationId: e.station_id,
      stationName,
      accessEnabled,
      hasToken,
      tokenTail: tokenTailMasked(tok),
      tokenCreatedAt: e.employee_access_created_at ?? null,
      lastUsedAt: e.employee_access_last_used_at ?? null,
      activeDeviceCount,
      lastDeviceLabel: lastActive?.device_label ?? null,
      lastDeviceSeenAt: lastActive?.last_seen_at ?? lastActive?.first_seen_at ?? null,
      devices: list.map((d) => ({
        id: d.id,
        deviceLabel: d.device_label,
        platform: d.platform,
        firstSeenAt: d.first_seen_at,
        lastSeenAt: d.last_seen_at,
        isActive: d.is_active === 1,
        lastIp: d.last_ip,
      })),
    }
  })
}
