import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import type { BackshopItemSnapshot, BackshopRoutineType } from './backshopRoutineService.js'

export type BackshopAckRow = {
  id: string
  station_id: string
  employee_id: string
  shift_id: string | null
  time_entry_id: string
  routine_id: string | null
  routine_type: string
  title_snapshot: string | null
  items_snapshot_json: string
  remark: string | null
  acknowledged_at: string
  created_at: string
}

function snapshotsToJson(
  itemSnapshots: BackshopItemSnapshot[] | undefined,
  displayLines: string[] | undefined,
): string {
  if (itemSnapshots && itemSnapshots.length > 0) {
    return JSON.stringify(itemSnapshots)
  }
  const lines = displayLines ?? []
  return JSON.stringify(
    lines.map((line) => ({
      itemId: null,
      name: '',
      quantity: 0,
      unit: 'Stück',
      category: null,
      line,
    })),
  )
}

export function upsertBackshopNoticeAcknowledgement(
  db: Database,
  p: {
    stationId: string
    employeeId: string
    shiftId: string | null
    timeEntryId: string
    routineId: string | null
    routineType: BackshopRoutineType | string
    titleSnapshot: string | null
    itemSnapshots?: BackshopItemSnapshot[]
    displayLines?: string[]
    remark: string | null
  },
): BackshopAckRow {
  const existing = db
    .prepare(`SELECT * FROM backshop_notice_acknowledgements WHERE time_entry_id = ?`)
    .get(p.timeEntryId) as BackshopAckRow | undefined
  const ts = nowIso()
  const remarkTrim = p.remark != null && String(p.remark).trim() ? String(p.remark).trim() : null
  const snap = snapshotsToJson(p.itemSnapshots, p.displayLines)
  const rt = String(p.routineType)

  if (existing) {
    db.prepare(
      `UPDATE backshop_notice_acknowledgements SET
        routine_id = ?, routine_type = ?, title_snapshot = ?, items_snapshot_json = ?, remark = COALESCE(?, remark), acknowledged_at = ?
       WHERE time_entry_id = ?`,
    ).run(p.routineId, rt, p.titleSnapshot, snap, remarkTrim, ts, p.timeEntryId)
    return db.prepare(`SELECT * FROM backshop_notice_acknowledgements WHERE time_entry_id = ?`).get(p.timeEntryId) as BackshopAckRow
  }

  const id = `bna-${randomUUID()}`
  db.prepare(
    `INSERT INTO backshop_notice_acknowledgements (
      id, station_id, employee_id, shift_id, time_entry_id, routine_id, routine_type, title_snapshot, items_snapshot_json, remark, acknowledged_at, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    p.stationId,
    p.employeeId,
    p.shiftId,
    p.timeEntryId,
    p.routineId,
    rt,
    p.titleSnapshot,
    snap,
    remarkTrim,
    ts,
    ts,
  )
  return db.prepare(`SELECT * FROM backshop_notice_acknowledgements WHERE id = ?`).get(id) as BackshopAckRow
}

export function getBackshopAckByTimeEntryId(db: Database, timeEntryId: string): BackshopAckRow | undefined {
  return db
    .prepare(`SELECT * FROM backshop_notice_acknowledgements WHERE time_entry_id = ?`)
    .get(timeEntryId) as BackshopAckRow | undefined
}

/** Legacy Tabelle (nur Lesen, falls Migration noch nicht lief). */
export function getLegacyShiftBakingNotice(db: Database, timeEntryId: string) {
  const tbl = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='shift_baking_notices'`).get() as
    | { name: string }
    | undefined
  if (!tbl) return undefined
  return db.prepare(`SELECT * FROM shift_baking_notices WHERE time_entry_id = ?`).get(timeEntryId) as
    | {
        baking_plan_type: string
        items_json: string
        remark: string | null
        acknowledged_at: string
      }
    | undefined
}
