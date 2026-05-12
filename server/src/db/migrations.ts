import type Database from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { TEAMLEAD_PERMISSIONS } from '../constants/permissions.js'
import { ensureDefaultUserStationAccess, ensureKnownStationsAndWorkAreas } from '../services/stationAccessService.js'

function employeesColumnNames(db: Database.Database): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(employees)`).all() as { name: string }[]
  return new Set(rows.map((r) => r.name))
}

function addEmployeeColumn(db: Database.Database, names: Set<string>, col: string, ddl: string) {
  if (!names.has(col)) {
    db.exec(`ALTER TABLE employees ADD COLUMN ${ddl}`)
    names.add(col)
  }
}

/** Lightweight schema upgrades for existing SQLite files (idempotent). */
export function runMigrations(db: Database.Database) {
  const shiftCols = db.prepare(`PRAGMA table_info(shifts)`).all() as { name: string }[]
  if (!shiftCols.some((r) => r.name === 'import_source')) {
    db.exec(`ALTER TABLE shifts ADD COLUMN import_source TEXT`)
  }

  let empCols = employeesColumnNames(db)
  addEmployeeColumn(db, empCols, 'employee_access_token', 'employee_access_token TEXT')
  addEmployeeColumn(db, empCols, 'employee_access_enabled', 'employee_access_enabled INTEGER DEFAULT 1')
  addEmployeeColumn(db, empCols, 'employee_access_created_at', 'employee_access_created_at TEXT')
  addEmployeeColumn(db, empCols, 'employee_access_last_used_at', 'employee_access_last_used_at TEXT')

  empCols = employeesColumnNames(db)
  addEmployeeColumn(db, empCols, 'preferred_shift_types_json', `preferred_shift_types_json TEXT DEFAULT '[]'`)
  addEmployeeColumn(db, empCols, 'preferred_work_days_json', `preferred_work_days_json TEXT DEFAULT '[]'`)
  addEmployeeColumn(db, empCols, 'not_preferred_work_days_json', `not_preferred_work_days_json TEXT DEFAULT '[]'`)
  addEmployeeColumn(db, empCols, 'can_work_weekends', 'can_work_weekends INTEGER DEFAULT 1')
  addEmployeeColumn(db, empCols, 'can_work_holidays', 'can_work_holidays INTEGER DEFAULT 1')
  addEmployeeColumn(db, empCols, 'max_preferred_days_per_week', 'max_preferred_days_per_week INTEGER')
  addEmployeeColumn(db, empCols, 'max_weekly_hours', 'max_weekly_hours REAL')
  addEmployeeColumn(db, empCols, 'planning_notes', 'planning_notes TEXT')

  migrateEmployeeExtendedColumns(db)

  const ewaInfo = db.prepare(`PRAGMA table_info(employee_work_areas)`).all() as { name: string }[]
  const ewaNames = new Set(ewaInfo.map((c) => c.name))
  if (!ewaNames.has('station_id')) {
    db.exec(`ALTER TABLE employee_work_areas ADD COLUMN station_id TEXT`)
    db.exec(
      `UPDATE employee_work_areas SET station_id = COALESCE(station_id, (SELECT station_id FROM work_areas WHERE work_areas.id = employee_work_areas.work_area_id))`,
    )
  }

  const teCols = db.prepare(`PRAGMA table_info(time_entries)`).all() as { name: string }[]
  const teNames = new Set(teCols.map((c) => c.name))
  const addTe = (name: string, ddl: string) => {
    if (!teNames.has(name)) {
      db.exec(`ALTER TABLE time_entries ADD COLUMN ${ddl}`)
      teNames.add(name)
    }
  }
  addTe('approval_status', 'approval_status TEXT')
  addTe('approved_by', 'approved_by TEXT')
  addTe('approved_at', 'approved_at TEXT')
  addTe('rejected_by', 'rejected_by TEXT')
  addTe('rejected_at', 'rejected_at TEXT')
  addTe('rejection_reason', 'rejection_reason TEXT')
  addTe('correction_note', 'correction_note TEXT')
  addTe('payroll_relevant', 'payroll_relevant INTEGER DEFAULT 0')

  db.prepare(
    `UPDATE time_entries SET approval_status = 'pending', payroll_relevant = 0
     WHERE status = 'completed' AND (approval_status IS NULL OR trim(approval_status) = '')`,
  ).run()

  db.exec(`CREATE TABLE IF NOT EXISTS employee_access_logs (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    token_hash TEXT,
    used_at TEXT,
    ip TEXT,
    user_agent TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`)

  /** Einmalige Auffüllung: nur Zeilen ohne Token. Kein Rotieren bei Serverstart/Redeploy/Seed. */
  const needToken = db
    .prepare(
      `SELECT id FROM employees WHERE employee_access_token IS NULL OR trim(employee_access_token) = ''`,
    )
    .all() as { id: string }[]
  const ts = nowIso()
  for (const { id } of needToken) {
    const tok = randomBytes(32).toString('hex')
    db.prepare(
      `UPDATE employees SET employee_access_token = ?, employee_access_enabled = COALESCE(employee_access_enabled, 1), employee_access_created_at = COALESCE(employee_access_created_at, ?), updated_at = ? WHERE id = ?`,
    ).run(tok, ts, ts, id)
  }

  /* --- Mehrstations: user_station_access, global_admin, weitere Stationen --- */
  db.exec(`CREATE TABLE IF NOT EXISTS user_station_access (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    station_id TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions_json TEXT NOT NULL DEFAULT '{}',
    active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (station_id) REFERENCES stations(id)
  )`)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_station_access_user_station ON user_station_access(user_id, station_id)`)

  const userColNames = new Set(
    (db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map((r) => r.name),
  )
  if (!userColNames.has('global_admin')) {
    db.exec(`ALTER TABLE users ADD COLUMN global_admin INTEGER DEFAULT 0`)
  }

  const stationColNames = new Set(
    (db.prepare(`PRAGMA table_info(stations)`).all() as { name: string }[]).map((r) => r.name),
  )
  if (!stationColNames.has('brand')) {
    db.exec(`ALTER TABLE stations ADD COLUMN brand TEXT`)
  }

  const bootTs = nowIso()
  ensureKnownStationsAndWorkAreas(db, bootTs)
  ensureDefaultUserStationAccess(db, bootTs)

  db.prepare(`UPDATE stations SET brand = COALESCE(brand, 'Aral') WHERE id = 'aral-bodelshausen' AND (brand IS NULL OR trim(brand) = '')`).run()

  mergeTuvPermissionsIntoAccess(db)
  mergeEmployeeSensitivePermissionsIntoAccess(db)
  ensureEmployeeAppDevicesTable(db)
  mergeEmployeeAppPermissionsIntoAccess(db)
  migrateRoleLabelsAndAbsenceRejectColumns(db)
}

function migrateEmployeeExtendedColumns(db: Database.Database) {
  let empCols = employeesColumnNames(db)
  const add = (col: string, ddl: string) => addEmployeeColumn(db, empCols, col, ddl)
  add('salutation', 'salutation TEXT')
  add('short_name', 'short_name TEXT')
  add('mobile_phone', 'mobile_phone TEXT')
  add('landline_phone', 'landline_phone TEXT')
  add('personnel_number', 'personnel_number TEXT')
  add('pin_hash', 'pin_hash TEXT')
  add('time_tracking_mode', `time_tracking_mode TEXT DEFAULT 'station_default'`)
  add('break_mode', `break_mode TEXT DEFAULT 'station_default'`)
  add('mobile_punch_mode', `mobile_punch_mode TEXT DEFAULT 'station_default'`)
  add('check_in_mode', `check_in_mode TEXT DEFAULT 'station_default'`)
  add('check_out_mode', `check_out_mode TEXT DEFAULT 'station_default'`)
  add('employee_app_enabled', 'employee_app_enabled INTEGER DEFAULT 1')
  add('employment_role', 'employment_role TEXT')
  add('pay_type', `pay_type TEXT DEFAULT 'hourly'`)
  add('max_hours_per_month', 'max_hours_per_month REAL')
  add('work_days_json', `work_days_json TEXT DEFAULT '["mo","di","mi","do","fr"]'`)
  add('manko_money', 'manko_money REAL')
  add('vl_amount', 'vl_amount REAL')
  add('hide_in_payroll', 'hide_in_payroll INTEGER DEFAULT 0')
  add('overtime_enabled', 'overtime_enabled INTEGER DEFAULT 0')
  add('overtime_start_value', 'overtime_start_value REAL')
  add('overtime_start_date', 'overtime_start_date TEXT')
  add('overtime_current_value', 'overtime_current_value REAL')
  add('overtime_auto_calculate', 'overtime_auto_calculate INTEGER DEFAULT 0')
  add('overtime_include_in_reports', 'overtime_include_in_reports INTEGER DEFAULT 1')
  add('iban', 'iban TEXT')
  add('bic', 'bic TEXT')
  add('account_holder', 'account_holder TEXT')
  add('vacation_start_enabled', 'vacation_start_enabled INTEGER DEFAULT 0')
  add('vacation_start_value', 'vacation_start_value REAL')
  add('vacation_start_date', 'vacation_start_date TEXT')
  add('annual_vacation_days', 'annual_vacation_days REAL')
  add('vacation_hours_per_day', 'vacation_hours_per_day REAL')
  add('vacation_auto_average_13_weeks', 'vacation_auto_average_13_weeks INTEGER DEFAULT 0')
  add('first_break_value', 'first_break_value REAL')
  add('first_break_after_hours', 'first_break_after_hours REAL')
  add('second_break_value', 'second_break_value REAL')
  add('second_break_after_hours', 'second_break_after_hours REAL')
  add('use_station_break_settings', 'use_station_break_settings INTEGER DEFAULT 1')
  add('own_break_rule_enabled', 'own_break_rule_enabled INTEGER DEFAULT 0')
  add('surcharge_mode', `surcharge_mode TEXT DEFAULT 'none'`)
  add('night_surcharge_percent', 'night_surcharge_percent REAL')
  add('night_surcharge_start', 'night_surcharge_start TEXT')
  add('night_surcharge_end', 'night_surcharge_end TEXT')
  add('night_surcharge_after_two_hours', 'night_surcharge_after_two_hours INTEGER DEFAULT 0')
  add('saturday_surcharge_percent', 'saturday_surcharge_percent REAL')
  add('sunday_surcharge_percent', 'sunday_surcharge_percent REAL')
  add('holiday_surcharge_percent', 'holiday_surcharge_percent REAL')
  add('special_holiday_surcharge_percent', 'special_holiday_surcharge_percent REAL')
  add('night_0_4_surcharge_percent', 'night_0_4_surcharge_percent REAL')
  add('night_0_4_after_sunday_percent', 'night_0_4_after_sunday_percent REAL')
  add('night_0_4_after_holiday_percent', 'night_0_4_after_holiday_percent REAL')
  add('night_0_4_after_special_holiday_percent', 'night_0_4_after_special_holiday_percent REAL')
  add('surcharge_calculation_mode', `surcharge_calculation_mode TEXT DEFAULT 'higher'`)
  add('hide_contact_in_address_book', 'hide_contact_in_address_book INTEGER DEFAULT 0')
  add('show_only_first_name_in_employee_app', 'show_only_first_name_in_employee_app INTEGER DEFAULT 0')
  add('visible_in_team_schedule', 'visible_in_team_schedule INTEGER DEFAULT 1')
  add('phone_visible_to_team', 'phone_visible_to_team INTEGER DEFAULT 1')
  add('email_visible_to_team', 'email_visible_to_team INTEGER DEFAULT 1')
  db.prepare(
    `UPDATE employees SET mobile_phone = COALESCE(NULLIF(trim(mobile_phone), ''), phone) WHERE mobile_phone IS NULL OR trim(mobile_phone) = ''`,
  ).run()
  db.prepare(
    `UPDATE employees SET employment_role = COALESCE(NULLIF(trim(employment_role), ''), role) WHERE employment_role IS NULL OR trim(employment_role) = ''`,
  ).run()
}

function mergeEmployeeSensitivePermissionsIntoAccess(db: Database.Database) {
  const keys = ['employees.viewSensitive', 'payroll.view', 'employees.manageSensitive'] as const
  const defaults = Object.fromEntries(keys.map((k) => [k, Boolean(TEAMLEAD_PERMISSIONS[k])])) as Record<
    string,
    boolean
  >
  const rows = db.prepare(`SELECT id, permissions_json FROM user_station_access`).all() as {
    id: string
    permissions_json: string
  }[]
  const ts = nowIso()
  for (const r of rows) {
    let p: Record<string, boolean> = {}
    try {
      p = JSON.parse(r.permissions_json || '{}') as Record<string, boolean>
    } catch {
      p = {}
    }
    let changed = false
    for (const [k, v] of Object.entries(defaults)) {
      if (p[k] === undefined) {
        p[k] = v
        changed = true
      }
    }
    if (changed) {
      db.prepare(`UPDATE user_station_access SET permissions_json = ?, updated_at = ? WHERE id = ?`).run(
        JSON.stringify(p),
        ts,
        r.id,
      )
    }
  }
}

function migrateRoleLabelsAndAbsenceRejectColumns(db: Database.Database) {
  const roleCols = db.prepare(`PRAGMA table_info(roles)`).all() as { name: string }[]
  const roleNames = new Set(roleCols.map((c) => c.name))
  if (!roleNames.has('role_key')) {
    db.exec(`ALTER TABLE roles ADD COLUMN role_key TEXT`)
  }
  if (!roleNames.has('role_label')) {
    db.exec(`ALTER TABLE roles ADD COLUMN role_label TEXT`)
  }
  db.prepare(`UPDATE roles SET role_key = 'chief_admin', role_label = 'Chef / Administrator' WHERE id = 'role-admin'`).run()

  const hasTeamLead = db.prepare(`SELECT 1 FROM roles WHERE id = 'role-station-team-lead' LIMIT 1`).get()
  if (!hasTeamLead) {
    const perms = JSON.stringify(TEAMLEAD_PERMISSIONS)
    db.prepare(
      `INSERT INTO roles (id, name, description, permissions_json, role_key, role_label)
       VALUES ('role-station-team-lead', 'Stationsleitung', 'Teamleitung / Stationsleitung', ?, 'station_team_lead', 'Stationsleitung / Teamleitung')`,
    ).run(perms)
  }

  db.prepare(`UPDATE users SET role_id = 'role-station-team-lead' WHERE id = 'user-mathias-raselowski'`).run()
  db.prepare(`UPDATE users SET global_admin = 1 WHERE id = 'user-max-vins'`).run()
  db.prepare(`UPDATE users SET global_admin = 0 WHERE id = 'user-mathias-raselowski'`).run()

  const absCols = db.prepare(`PRAGMA table_info(absences)`).all() as { name: string }[]
  const absNames = new Set(absCols.map((c) => c.name))
  if (!absNames.has('rejected_by')) {
    db.exec(`ALTER TABLE absences ADD COLUMN rejected_by TEXT`)
  }
  if (!absNames.has('rejected_at')) {
    db.exec(`ALTER TABLE absences ADD COLUMN rejected_at TEXT`)
  }
}

function ensureEmployeeAppDevicesTable(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS employee_app_devices (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    station_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    device_label TEXT,
    user_agent TEXT,
    platform TEXT,
    last_ip TEXT,
    first_seen_at TEXT,
    last_seen_at TEXT,
    is_active INTEGER DEFAULT 1,
    revoked_at TEXT,
    revoked_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`)
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_app_devices_emp_device ON employee_app_devices(employee_id, device_id)`,
  )
  db.exec(`CREATE INDEX IF NOT EXISTS idx_employee_app_devices_station ON employee_app_devices(station_id)`)
}

function mergeEmployeeAppPermissionsIntoAccess(db: Database.Database) {
  const keys = [
    'employees.viewAppAccess',
    'employees.viewDevices',
    'employees.manageAppAccess',
    'employees.revokeDevices',
  ] as const
  const rows = db.prepare(`SELECT id, permissions_json FROM user_station_access`).all() as {
    id: string
    permissions_json: string
  }[]
  const ts = nowIso()
  for (const r of rows) {
    let p: Record<string, boolean> = {}
    try {
      p = JSON.parse(r.permissions_json || '{}') as Record<string, boolean>
    } catch {
      p = {}
    }
    if (p['employees.qr'] !== true && p['employees.edit'] !== true) continue
    let changed = false
    for (const k of keys) {
      if (p[k] === undefined) {
        p[k] = true
        changed = true
      }
    }
    if (changed) {
      db.prepare(`UPDATE user_station_access SET permissions_json = ?, updated_at = ? WHERE id = ?`).run(
        JSON.stringify(p),
        ts,
        r.id,
      )
    }
  }
}

function mergeTuvPermissionsIntoAccess(db: Database.Database) {
  const tuvDefaults = Object.fromEntries(
    Object.entries(TEAMLEAD_PERMISSIONS).filter(([k]) => k.startsWith('tuvReports.')),
  ) as Record<string, boolean>
  const rows = db.prepare(`SELECT id, permissions_json FROM user_station_access`).all() as {
    id: string
    permissions_json: string
  }[]
  const ts = nowIso()
  for (const r of rows) {
    let p: Record<string, boolean> = {}
    try {
      p = JSON.parse(r.permissions_json || '{}') as Record<string, boolean>
    } catch {
      p = {}
    }
    let changed = false
    for (const [k, v] of Object.entries(tuvDefaults)) {
      if (p[k] === undefined) {
        p[k] = Boolean(v)
        changed = true
      }
    }
    if (changed) {
      db.prepare(`UPDATE user_station_access SET permissions_json = ?, updated_at = ? WHERE id = ?`).run(
        JSON.stringify(p),
        ts,
        r.id,
      )
    }
  }
}
