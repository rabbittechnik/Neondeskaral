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
