import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { createShiftWarningFromReview } from './employeeShiftWarningService.js'

/** Keys aligned with Schichtende-Checkliste (camelCase im API-Body). */
export const SHIFT_CHECKLIST_REVIEW_DEFS: { key: string; label: string; checklistProp: keyof Record<string, unknown> }[] = [
  { key: 'fridge_fronted', label: 'Kühlschrank / Front', checklistProp: 'fridgeFronted' },
  { key: 'drinks_filled', label: 'Getränke nachgefüllt', checklistProp: 'drinksFilled' },
  { key: 'cigarettes_filled', label: 'Zigaretten nachgefüllt', checklistProp: 'cigarettesFilled' },
  { key: 'shelves_filled', label: 'Regale aufgefüllt', checklistProp: 'shelvesFilled' },
  { key: 'trash_emptied', label: 'Mülleimer geleert', checklistProp: 'trashEmptied' },
  { key: 'counter_clean', label: 'Kasse sauber', checklistProp: 'counterClean' },
  { key: 'coffee_area_clean', label: 'Kaffee-/Backshop-Bereich', checklistProp: 'coffeeAreaClean' },
  { key: 'outside_checked', label: 'Außenbereich geprüft', checklistProp: 'outsideChecked' },
  { key: 'incidents_noted', label: 'Vorkommnisse notiert', checklistProp: 'incidentsNoted' },
  { key: 'handover_possible', label: 'Übergabe möglich', checklistProp: 'handoverPossible' },
  { key: 'closing_ready', label: 'Zuschließbar', checklistProp: 'closingReady' },
  { key: 'everything_ok', label: 'Alles in Ordnung', checklistProp: 'everythingOk' },
]

function boolFromChecklist(c: Record<string, unknown>, prop: string): number {
  return Boolean(c[prop]) ? 1 : 0
}

export function syncReviewItemsFromCloseChecklist(
  db: Database,
  p: { timeEntryId: string; employeeId: string; stationId: string; checklist: Record<string, unknown> },
) {
  const ts = nowIso()
  const del = db.prepare(`DELETE FROM shift_checklist_review_items WHERE time_entry_id = ?`)
  del.run(p.timeEntryId)

  const ins = db.prepare(
    `INSERT INTO shift_checklist_review_items (
      id, time_entry_id, employee_id, station_id, checklist_key, label,
      employee_checked, review_checked, review_comment, reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
  )

  for (const d of SHIFT_CHECKLIST_REVIEW_DEFS) {
    const ec = boolFromChecklist(p.checklist, d.checklistProp)
    /** Nach Mitarbeiter-Bestätigung: Review startet gleich (noch keine Beanstandung). */
    const rc = ec
    ins.run(
      `scri-${randomUUID()}`,
      p.timeEntryId,
      p.employeeId,
      p.stationId,
      d.key,
      d.label,
      ec,
      rc,
      ts,
      ts,
    )
  }
}

export type ReviewItemApi = {
  id: string
  checklistKey: string
  label: string
  employeeChecked: boolean
  reviewChecked: boolean
  reviewComment: string
  reviewedBy?: string
  reviewedAt?: string
}

export function listReviewItemsForTimeEntry(db: Database, timeEntryId: string): ReviewItemApi[] {
  const rows = db
    .prepare(
      `SELECT * FROM shift_checklist_review_items WHERE time_entry_id = ? ORDER BY checklist_key`,
    )
    .all(timeEntryId) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: String(r.id),
    checklistKey: String(r.checklist_key),
    label: String(r.label),
    employeeChecked: (r.employee_checked as number) === 1,
    reviewChecked: (r.review_checked as number) === 1,
    reviewComment: String(r.review_comment ?? ''),
    reviewedBy: r.reviewed_by ? String(r.reviewed_by) : undefined,
    reviewedAt: r.reviewed_at ? String(r.reviewed_at) : undefined,
  }))
}

export function updateShiftChecklistReviewItems(
  db: Database,
  p: {
    timeEntryId: string
    stationId: string
    employeeId: string
    items: { id: string; reviewChecked: boolean; reviewComment?: string }[]
    reviewedBy: string
  },
) {
  const te = db.prepare(`SELECT id, employee_id, station_id FROM time_entries WHERE id = ?`).get(p.timeEntryId) as
    | { id: string; employee_id: string; station_id: string }
    | undefined
  if (!te || te.station_id !== p.stationId || te.employee_id !== p.employeeId) {
    throw new Error('Zeiteintrag passt nicht')
  }

  const ts = nowIso()
  const sel = db.prepare(`SELECT * FROM shift_checklist_review_items WHERE id = ? AND time_entry_id = ?`)

  for (const it of p.items) {
    const row = sel.get(it.id, p.timeEntryId) as Record<string, unknown> | undefined
    if (!row) continue
    const empChecked = (row.employee_checked as number) === 1
    const newRev = it.reviewChecked
    db.prepare(
      `UPDATE shift_checklist_review_items SET
        review_checked = ?,
        review_comment = ?,
        reviewed_by = ?,
        reviewed_at = ?,
        updated_at = ?
       WHERE id = ?`,
    ).run(
      newRev ? 1 : 0,
      String(it.reviewComment ?? '').trim() || null,
      p.reviewedBy,
      ts,
      ts,
      it.id,
    )

    /** Mitarbeiter hat bestätigt, Leitung beanstandet (review_checked = 0). */
    if (empChecked && !newRev) {
      createShiftWarningFromReview(db, {
        stationId: p.stationId,
        employeeId: p.employeeId,
        sourceTimeEntryId: p.timeEntryId,
        checklistKey: String(row.checklist_key),
        label: String(row.label),
        message: 'Leitung hat diesen Punkt aus der Schichtabschluss-Checkliste beanstandet.',
        createdBy: p.reviewedBy,
      })
    }
  }
}
