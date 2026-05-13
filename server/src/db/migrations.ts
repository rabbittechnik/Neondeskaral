import type Database from 'better-sqlite3'
import { randomBytes, randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { TEAMLEAD_PERMISSIONS } from '../constants/permissions.js'
import { mathiasStationsleiterPermissions } from '../constants/mathiasStationsleiterPermissions.js'
import { STATION_RADIO_DEFAULTS_ARAL_BODELSHAUSEN } from '../constants/stationRadioDefaults.js'
import { TABLET_RADIO_DEFAULT_PRESET_ID } from '../constants/tabletRadioPresetIds.js'
import { ensureDefaultUserStationAccess, ensureKnownStationsAndWorkAreas } from '../services/stationAccessService.js'
import { calculateVacationImpact, normalizeAbsenceDbType } from '../utils/vacationImpactCalculator.js'

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
  mergeEmployeesViewDeletedPermission(db)
  migrateRoleLabelsAndAbsenceRejectColumns(db)
  migrateAbsenceVacationModel(db)
  ensureFuelPriceCacheAndStationTankerkoenig(db)
  ensureTaskLogsTabletColumns(db)
  removeSeedDemoRunningTimeEntries(db)
  alignAralBodelshausenEmployeeDisplayRoles(db)
  ensurePayrollAdjustmentsTable(db)
  mergePayrollExportPermission(db)
  ensureShiftCloseChecklistCashDifferenceColumn(db)
  ensurePayrollAdjustmentsUpdatedAtColumn(db)
  ensureStationTabletDevicesTable(db)
  mergeStationTabletPermissionsIntoAccess(db)
  ensureUsersLastLoginAtColumn(db)
  ensureUserAuditLogTable(db)
  syncMathiasRaselowskiAccount(db)
  ensureStationRadioColumns(db)
  seedAralBodelshausenStationRadio(db)
  ensureStationRadioPresetsTable(db)
  seedStationRadioDefaultPresetIds(db)
  ensureStationStammdatenColumns(db)
  ensureStationCanonicalNamesOnce(db)
  syncAralBodelshausenStationDisplayName(db)
  syncAralBodelshausenEmployeeCashRegisterCards(db)
}

/** Idempotent: Kassenkartennummern für Aral Bodelshausen (nur nicht gelöschte Zeilen, Abgleich per display_name). */
function syncAralBodelshausenEmployeeCashRegisterCards(db: Database.Database) {
  const ts = nowIso()
  const pairs: [string, string][] = [
    ['Mathias Raselowski', '772839'],
    ['Metin Özgür', '772820'],
    ['Max Vins', '140520'],
    ['Valerina Mustafa', '772838'],
    ['Luca Stöck', '140519'],
    ['Chiara H.', '772822'],
    ['Enise A.', '772837'],
  ]
  const stmt = db.prepare(
    `UPDATE employees SET cash_register_card_number = ?, updated_at = ?
     WHERE station_id = 'aral-bodelshausen' AND display_name = ?
       AND (deleted_at IS NULL OR trim(deleted_at) = '')`,
  )
  for (const [name, num] of pairs) {
    stmt.run(num, ts, name)
  }
}

function ensureStationStammdatenColumns(db: Database.Database) {
  const cols = new Set((db.prepare(`PRAGMA table_info(stations)`).all() as { name: string }[]).map((c) => c.name))
  const add = (name: string, ddl: string) => {
    if (!cols.has(name)) {
      db.exec(`ALTER TABLE stations ADD COLUMN ${ddl}`)
      cols.add(name)
    }
  }
  add('street', 'street TEXT')
  add('house_number', 'house_number TEXT')
  add('contact_person', 'contact_person TEXT')
  add('notes', 'notes TEXT')
  add('standard_work_times_json', 'standard_work_times_json TEXT')
  add('archived_at', 'archived_at TEXT')
  add('deleted_at', 'deleted_at TEXT')
}

/** Einmalig: Anzeigenamen der vier Kern-Stationen angleichen (keine Adress-/Telefon-Überschreibung). */
function ensureStationCanonicalNamesOnce(db: Database.Database) {
  const key = 'migration_canonical_station_names_v1'
  const done = db.prepare(`SELECT 1 FROM settings WHERE key = ?`).get(key) as { 1: number } | undefined
  if (done) return
  const ts = nowIso()
  const rows: { id: string; name: string }[] = [
    { id: 'aral-bodelshausen', name: 'Aral Bodelshausen' },
    { id: 'autohof-kehl', name: 'Autohof Kehl' },
    { id: 'shell-ingersheim', name: 'Shell Ingersheim' },
    { id: 'shell-station-marsch', name: 'Shell Station Marsch' },
  ]
  const upd = db.prepare(`UPDATE stations SET name = ?, updated_at = ? WHERE id = ?`)
  for (const r of rows) {
    upd.run(r.name, ts, r.id)
  }
  db.prepare(
    `INSERT INTO settings (id, station_id, key, value, type, created_at, updated_at) VALUES (?, NULL, ?, '1', 'bool', ?, ?)`,
  ).run(randomUUID(), key, ts, ts)
}

/** Offizieller Anzeigename Aral Bodelshausen (ohne „Bulle 1000“); idempotent bei jedem Start. */
function syncAralBodelshausenStationDisplayName(db: Database.Database) {
  const ts = nowIso()
  db.prepare(
    `UPDATE stations SET name = ?, brand = ?, updated_at = ? WHERE id = 'aral-bodelshausen'`,
  ).run('Aral Bodelshausen', 'ARAL', ts)
}

function ensureStationRadioColumns(db: Database.Database) {
  const cols = new Set((db.prepare(`PRAGMA table_info(stations)`).all() as { name: string }[]).map((c) => c.name))
  const add = (name: string, ddl: string) => {
    if (!cols.has(name)) {
      db.exec(`ALTER TABLE stations ADD COLUMN ${ddl}`)
      cols.add(name)
    }
  }
  add('radio_enabled', 'radio_enabled INTEGER DEFAULT 1')
  add('radio_stream_name', 'radio_stream_name TEXT')
  add('radio_stream_url', 'radio_stream_url TEXT')
  add('radio_stream_url_fallback', 'radio_stream_url_fallback TEXT')
  add('radio_default_volume', 'radio_default_volume REAL DEFAULT 0.5')
  add('radio_default_preset_id', 'radio_default_preset_id TEXT')
}

/** Optional: später Admin-UI für sender-spezifische Streams (aktuell nutzt das Client `tabletRadioStations.ts`). */
function ensureStationRadioPresetsTable(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS station_radio_presets (
    id TEXT PRIMARY KEY,
    station_id TEXT,
    name TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    stream_url_fallback TEXT,
    enabled INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  )`)
}

function seedAralBodelshausenStationRadio(db: Database.Database) {
  const ts = nowIso()
  const d = STATION_RADIO_DEFAULTS_ARAL_BODELSHAUSEN
  db.prepare(
    `UPDATE stations SET
      radio_enabled = 1,
      radio_stream_name = ?,
      radio_stream_url = ?,
      radio_stream_url_fallback = ?,
      radio_default_volume = 0.5,
      updated_at = ?
    WHERE id = ?
      AND (radio_stream_url IS NULL OR trim(radio_stream_url) = '')`,
  ).run(d.streamName, d.streamUrl, d.streamUrlFallback, ts, d.stationId)
}

function seedStationRadioDefaultPresetIds(db: Database.Database) {
  const ts = nowIso()
  db.prepare(
    `UPDATE stations SET radio_default_preset_id = ?, updated_at = ?
     WHERE id = ?
       AND (radio_default_preset_id IS NULL OR trim(radio_default_preset_id) = '')`,
  ).run(TABLET_RADIO_DEFAULT_PRESET_ID, ts, STATION_RADIO_DEFAULTS_ARAL_BODELSHAUSEN.stationId)
}

function ensureUsersLastLoginAtColumn(db: Database.Database) {
  const cols = new Set((db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map((c) => c.name))
  if (!cols.has('last_login_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN last_login_at TEXT`)
  }
}

function ensureUserAuditLogTable(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS user_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    target_user_id TEXT,
    station_id TEXT,
    details_json TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT
  )`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_audit_log_created ON user_audit_log(created_at)`)
}

/** Profil, E-Mail, Rechte Stationsleiter nur Aral Bodelshausen — Max Vins unangetastet. */
function syncMathiasRaselowskiAccount(db: Database.Database) {
  const matId = 'user-mathias-raselowski'
  const row = db.prepare(`SELECT id FROM users WHERE id = ?`).get(matId) as { id: string } | undefined
  if (!row) return
  const ts = nowIso()
  db.prepare(`UPDATE users SET email = ?, display_name = ?, global_admin = 0, updated_at = ? WHERE id = ?`).run(
    'rabbit.technik@gmail.com',
    'Mathias Raselowski',
    ts,
    matId,
  )

  const perms = JSON.stringify(mathiasStationsleiterPermissions())
  const acc = db
    .prepare(`SELECT id FROM user_station_access WHERE user_id = ? AND station_id = ?`)
    .get(matId, 'aral-bodelshausen') as { id: string } | undefined
  if (acc) {
    db.prepare(
      `UPDATE user_station_access SET role = 'stationsleiter', permissions_json = ?, updated_at = ? WHERE user_id = ? AND station_id = ?`,
    ).run(perms, ts, matId, 'aral-bodelshausen')
  } else {
    db.prepare(
      `INSERT INTO user_station_access (id, user_id, station_id, role, permissions_json, active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'stationsleiter', ?, 1, NULL, ?, ?)`,
    ).run(randomUUID(), matId, 'aral-bodelshausen', perms, ts, ts)
  }
}

/** Stammdaten-Anzeige-Rollen für Bodelshausen (bestehende DBs, Railway-Deploy). */
function alignAralBodelshausenEmployeeDisplayRoles(db: Database.Database) {
  const stationId = 'aral-bodelshausen'
  const ts = nowIso()
  const stmt = db.prepare(
    `UPDATE employees SET role = ?, employment_role = ?, employment_type = ?, updated_at = ? WHERE id = ? AND station_id = ?`,
  )
  const rows: { id: string; role: string; employment_role: string; employment_type: string }[] = [
    { id: 'e1', role: 'Schichtleiter', employment_role: 'Schichtleiter', employment_type: 'vollzeit' },
    { id: 'e3', role: 'Chef / Administrator', employment_role: 'Chef / Administrator', employment_type: 'teilzeit' },
    { id: 'e4', role: 'Vollzeit', employment_role: 'Vollzeit', employment_type: 'vollzeit' },
    { id: 'e5', role: 'Aushilfe', employment_role: 'Aushilfe', employment_type: 'aushilfe' },
    { id: 'e6', role: 'Aushilfe', employment_role: 'Aushilfe', employment_type: 'aushilfe' },
    { id: 'e7', role: 'Aushilfe', employment_role: 'Aushilfe', employment_type: 'aushilfe' },
    { id: 'e8', role: 'Aushilfe', employment_role: 'Aushilfe', employment_type: 'aushilfe' },
  ]
  for (const r of rows) {
    stmt.run(r.role, r.employment_role, r.employment_type, ts, r.id, stationId)
  }
  try {
    db.prepare(
      `UPDATE roles SET role_label = 'Schichtleiter', name = 'Schichtleitung', description = 'Schichtleitung' WHERE id = 'role-station-team-lead'`,
    ).run()
  } catch {
    /* ignore */
  }
}

/** payroll.export: Default = reports.export, wenn noch nicht gesetzt. */
function mergePayrollExportPermission(db: Database.Database) {
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
    if (p['payroll.export'] !== undefined) continue
    p['payroll.export'] = p['reports.export'] === true
    db.prepare(`UPDATE user_station_access SET permissions_json = ?, updated_at = ? WHERE id = ?`).run(
      JSON.stringify(p),
      ts,
      r.id,
    )
  }
}

function ensureShiftCloseChecklistCashDifferenceColumn(db: Database.Database) {
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(shift_close_checklists)`).all() as { name: string }[]).map((c) => c.name),
  )
  if (!cols.has('cash_difference')) {
    db.exec(`ALTER TABLE shift_close_checklists ADD COLUMN cash_difference REAL`)
  }
}

function ensurePayrollAdjustmentsUpdatedAtColumn(db: Database.Database) {
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(payroll_adjustments)`).all() as { name: string }[]).map((c) => c.name),
  )
  if (!cols.has('updated_at')) {
    db.exec(`ALTER TABLE payroll_adjustments ADD COLUMN updated_at TEXT`)
  }
}

function ensurePayrollAdjustmentsTable(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS payroll_adjustments (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    note TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payroll_adj_station_date ON payroll_adjustments(station_id, date)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payroll_adj_employee ON payroll_adjustments(employee_id)`)
}

/** Früherer Seed: feste IDs mit „running“ — produktiv keine Demo-Eingestempelten. */
function removeSeedDemoRunningTimeEntries(db: Database.Database) {
  try {
    db.prepare(`DELETE FROM time_entries WHERE id IN ('te-run-1', 'te-run-2')`).run()
  } catch {
    /* ignore */
  }
}

function ensureFuelPriceCacheAndStationTankerkoenig(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS fuel_price_cache (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_station_id TEXT,
    status TEXT,
    is_open INTEGER,
    e5 REAL,
    e10 REAL,
    diesel REAL,
    currency TEXT DEFAULT 'EUR',
    raw_json TEXT,
    fetched_at TEXT,
    created_at TEXT,
    updated_at TEXT
  )`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fuel_price_cache_station ON fuel_price_cache(station_id)`)

  const cacheCols = new Set(
    (db.prepare(`PRAGMA table_info(fuel_price_cache)`).all() as { name: string }[]).map((r) => r.name),
  )
  if (!cacheCols.has('last_tankerkoenig_fetch_at')) {
    db.exec(`ALTER TABLE fuel_price_cache ADD COLUMN last_tankerkoenig_fetch_at TEXT`)
  }
  db.prepare(
    `UPDATE fuel_price_cache SET last_tankerkoenig_fetch_at = fetched_at
     WHERE last_tankerkoenig_fetch_at IS NULL AND fetched_at IS NOT NULL AND trim(fetched_at) != ''`,
  ).run()

  const tsFk = nowIso()
  db.prepare(
    `UPDATE stations SET tankerkoenig_station_id = (
       SELECT f.provider_station_id FROM fuel_price_cache f
       WHERE f.station_id = stations.id AND trim(COALESCE(f.provider_station_id, '')) != ''
       LIMIT 1
     ), updated_at = ?
     WHERE (tankerkoenig_station_id IS NULL OR trim(tankerkoenig_station_id) = '')
       AND EXISTS (
         SELECT 1 FROM fuel_price_cache f2
         WHERE f2.station_id = stations.id AND trim(COALESCE(f2.provider_station_id, '')) != ''
       )`,
  ).run(tsFk)

  const stationCols = new Set(
    (db.prepare(`PRAGMA table_info(stations)`).all() as { name: string }[]).map((r) => r.name),
  )
  if (!stationCols.has('tankerkoenig_station_id')) {
    db.exec(`ALTER TABLE stations ADD COLUMN tankerkoenig_station_id TEXT`)
  }
}

function ensureTaskLogsTabletColumns(db: Database.Database) {
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(task_logs)`).all() as { name: string }[]).map((r) => r.name),
  )
  if (!cols.has('station_id')) {
    db.exec(`ALTER TABLE task_logs ADD COLUMN station_id TEXT`)
  }
  if (!cols.has('source')) {
    db.exec(`ALTER TABLE task_logs ADD COLUMN source TEXT`)
  }
  if (!cols.has('confirmed_by_employee_id')) {
    db.exec(`ALTER TABLE task_logs ADD COLUMN confirmed_by_employee_id TEXT`)
  }
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
  add('deleted_at', 'deleted_at TEXT')
  add('deleted_by', 'deleted_by TEXT')
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
       VALUES ('role-station-team-lead', 'Schichtleitung', 'Schichtleitung', ?, 'station_team_lead', 'Schichtleiter')`,
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

function migrateAbsenceVacationModel(db: Database.Database) {
  const absCols = db.prepare(`PRAGMA table_info(absences)`).all() as { name: string }[]
  const absNames = new Set(absCols.map((c) => c.name))
  const addAbs = (name: string, ddl: string) => {
    if (!absNames.has(name)) {
      db.exec(`ALTER TABLE absences ADD COLUMN ${ddl}`)
      absNames.add(name)
    }
  }
  addAbs('paid', 'paid INTEGER DEFAULT 0')
  addAbs('counts_against_vacation', 'counts_against_vacation INTEGER DEFAULT 0')
  addAbs('paid_hours_per_day', 'paid_hours_per_day REAL DEFAULT 0')
  addAbs('paid_hours_total', 'paid_hours_total REAL DEFAULT 0')
  addAbs('absence_days', 'absence_days REAL DEFAULT 0')

  db.prepare(`UPDATE absences SET type = 'paid_vacation' WHERE lower(trim(type)) = 'vacation'`).run()
  db.prepare(`UPDATE absences SET type = 'unpaid_vacation' WHERE lower(trim(type)) = 'unpaid'`).run()

  const rows = db
    .prepare(
      `SELECT a.id, a.type, a.start_date, a.end_date, a.half_day, a.status,
              e.vacation_hours_per_day AS vhpd
       FROM absences a
       LEFT JOIN employees e ON e.id = a.employee_id`,
    )
    .all() as {
    id: string
    type: string
    start_date: string
    end_date: string
    half_day: number | null
    status: string
    vhpd: number | null
  }[]

  const upd = db.prepare(
    `UPDATE absences SET
       type = ?,
       paid = ?,
       counts_against_vacation = ?,
       paid_hours_per_day = ?,
       paid_hours_total = ?,
       absence_days = ?
     WHERE id = ?`,
  )

  for (const r of rows) {
    const canon = normalizeAbsenceDbType(r.type)
    const impact = calculateVacationImpact(
      {
        type: canon,
        startDate: r.start_date,
        endDate: r.end_date,
        halfDay: (r.half_day ?? 0) === 1,
      },
      { vacation_hours_per_day: r.vhpd },
    )
    upd.run(
      canon,
      impact.paid ? 1 : 0,
      impact.countsAgainstVacation ? 1 : 0,
      impact.paidHoursPerDay,
      impact.paidHoursTotal,
      impact.absenceDays,
      r.id,
    )
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

/** Wer Mitarbeiter endgültig/soft löschen darf, sieht optional die Liste gelöschter Einträge. */
function mergeEmployeesViewDeletedPermission(db: Database.Database) {
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
    if (p['employees.delete'] !== true) continue
    if (p['employees.viewDeleted'] !== undefined) continue
    p['employees.viewDeleted'] = true
    db.prepare(`UPDATE user_station_access SET permissions_json = ?, updated_at = ? WHERE id = ?`).run(
      JSON.stringify(p),
      ts,
      r.id,
    )
  }
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

function ensureStationTabletDevicesTable(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS station_tablet_devices (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    tablet_token TEXT NOT NULL UNIQUE,
    is_active INTEGER DEFAULT 1,
    first_seen_at TEXT,
    last_seen_at TEXT,
    last_ip TEXT,
    user_agent TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    revoked_at TEXT,
    revoked_by TEXT,
    FOREIGN KEY (station_id) REFERENCES stations(id)
  )`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_station_tablet_devices_station ON station_tablet_devices(station_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_station_tablet_devices_token ON station_tablet_devices(tablet_token)`)
}

/** Stations-Tablets: an Mitarbeiter-App-/Schichtrechten ausrichten (nur fehlende Keys, keine Überschreibung). */
function mergeStationTabletPermissionsIntoAccess(db: Database.Database) {
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
    const grantView =
      p['employees.viewAppAccess'] === true ||
      p['employees.manageAppAccess'] === true ||
      p['employees.viewDevices'] === true ||
      p['employees.qr'] === true ||
      p['schedule.edit'] === true
    const grantManage =
      p['employees.manageAppAccess'] === true ||
      p['employees.revokeDevices'] === true ||
      p['employees.qr'] === true ||
      p['schedule.edit'] === true
    if (!grantView && !grantManage) continue
    let changed = false
    if (grantView && p['stationTablets.view'] === undefined) {
      p['stationTablets.view'] = true
      changed = true
    }
    if (grantManage && p['stationTablets.manage'] === undefined) {
      p['stationTablets.manage'] = true
      changed = true
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
