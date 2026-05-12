import type Database from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'

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
}
