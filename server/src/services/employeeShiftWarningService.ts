import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'

export type EmployeeShiftWarningRow = {
  id: string
  station_id: string
  employee_id: string
  source_time_entry_id: string | null
  checklist_key: string | null
  label: string
  message: string | null
  severity: string | null
  created_by: string | null
  created_at: string | null
  acknowledged_at: string | null
  acknowledged_on_time_entry_id: string | null
  active: number | null
}

function rowToApi(r: EmployeeShiftWarningRow) {
  return {
    id: r.id,
    stationId: r.station_id,
    employeeId: r.employee_id,
    sourceTimeEntryId: r.source_time_entry_id ?? undefined,
    checklistKey: r.checklist_key ?? undefined,
    label: r.label,
    message: r.message ?? '',
    severity: (r.severity ?? 'warning') as string,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at ?? '',
    acknowledgedAt: r.acknowledged_at ?? undefined,
    active: (r.active ?? 1) === 1,
  }
}

export function listActiveShiftWarningsForEmployee(db: Database, employeeId: string) {
  const rows = db
    .prepare(
      `SELECT * FROM employee_shift_warnings
       WHERE employee_id = ? AND (active IS NULL OR active = 1)
         AND (acknowledged_at IS NULL OR trim(acknowledged_at) = '')
       ORDER BY datetime(created_at) DESC`,
    )
    .all(employeeId) as EmployeeShiftWarningRow[]
  return rows.map(rowToApi)
}

export function createShiftWarningFromReview(
  db: Database,
  p: {
    stationId: string
    employeeId: string
    sourceTimeEntryId: string
    checklistKey: string
    label: string
    message?: string
    createdBy?: string
  },
) {
  const dup = db
    .prepare(
      `SELECT 1 FROM employee_shift_warnings
       WHERE employee_id = ? AND source_time_entry_id = ? AND checklist_key = ?
         AND (active IS NULL OR active = 1) AND (acknowledged_at IS NULL OR trim(acknowledged_at) = '')
       LIMIT 1`,
    )
    .get(p.employeeId, p.sourceTimeEntryId, p.checklistKey) as { 1: number } | undefined
  if (dup) return null

  const id = `esw-${randomUUID()}`
  const ts = nowIso()
  db.prepare(
    `INSERT INTO employee_shift_warnings (
      id, station_id, employee_id, source_time_entry_id, checklist_key, label, message, severity, created_by, created_at, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'warning', ?, ?, 1)`,
  ).run(
    id,
    p.stationId,
    p.employeeId,
    p.sourceTimeEntryId,
    p.checklistKey,
    p.label,
    p.message ?? null,
    p.createdBy ?? null,
    ts,
  )
  return id
}

export function acknowledgeShiftWarning(
  db: Database,
  warningId: string,
  employeeId: string,
  opts?: { acknowledgedOnTimeEntryId?: string },
) {
  const row = db.prepare(`SELECT * FROM employee_shift_warnings WHERE id = ?`).get(warningId) as EmployeeShiftWarningRow | undefined
  if (!row || row.employee_id !== employeeId) throw new Error('Hinweis nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE employee_shift_warnings SET
      acknowledged_at = ?,
      acknowledged_on_time_entry_id = ?,
      active = 0
     WHERE id = ?`,
  ).run(ts, opts?.acknowledgedOnTimeEntryId ?? null, warningId)
}

/** Hinweise für den nächsten Check-in, wenn Punkte mit „Nein“ ausgestempelt wurden. */
export function createShiftWarningsFromShiftCloseCheckout(
  db: Database,
  p: {
    stationId: string
    employeeId: string
    sourceTimeEntryId: string
    items: { itemKey: string; itemLabel: string; answer: 'yes' | 'no' | 'not_relevant'; reason?: string }[]
  },
) {
  for (const it of p.items) {
    if (it.answer !== 'no') continue
    const base = `In deiner letzten Schicht wurde nicht erledigt: ${it.itemLabel}. Bitte heute besonders beachten.`
    const msg = it.reason ? `${base} (${it.reason})` : base
    createShiftWarningFromReview(db, {
      stationId: p.stationId,
      employeeId: p.employeeId,
      sourceTimeEntryId: p.sourceTimeEntryId,
      checklistKey: it.itemKey,
      label: it.itemLabel,
      message: msg,
      createdBy: 'Schichtende-Checkliste',
    })
  }
}

export function acknowledgeShiftWarningByAdmin(db: Database, warningId: string, employeeId: string) {
  const row = db.prepare(`SELECT * FROM employee_shift_warnings WHERE id = ?`).get(warningId) as EmployeeShiftWarningRow | undefined
  if (!row || row.employee_id !== employeeId) throw new Error('Hinweis nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE employee_shift_warnings SET acknowledged_at = ?, active = 0 WHERE id = ?`,
  ).run(ts, warningId)
}
