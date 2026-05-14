import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import type { BakingPlanTypeApi } from './bakingPlanService.js'

export type ShiftBakingNoticeRow = {
  id: string
  station_id: string
  employee_id: string
  shift_id: string | null
  time_entry_id: string
  date: string
  baking_plan_type: string
  items_json: string
  remark: string | null
  acknowledged_at: string
  created_at: string
}

export function getBakingNoticeByTimeEntryId(db: Database, timeEntryId: string): ShiftBakingNoticeRow | undefined {
  return db
    .prepare(`SELECT * FROM shift_baking_notices WHERE time_entry_id = ?`)
    .get(timeEntryId) as ShiftBakingNoticeRow | undefined
}

export function insertShiftBakingNotice(
  db: Database,
  p: {
    stationId: string
    employeeId: string
    shiftId: string | null
    timeEntryId: string
    dateYmd: string
    bakingPlanType: BakingPlanTypeApi
    items: string[]
    remark: string | null
  },
): ShiftBakingNoticeRow {
  const existing = getBakingNoticeByTimeEntryId(db, p.timeEntryId)
  const ts = nowIso()
  const remarkTrim = p.remark != null && String(p.remark).trim() ? String(p.remark).trim() : null
  if (existing) {
    db.prepare(
      `UPDATE shift_baking_notices SET remark = COALESCE(?, remark), items_json = ?, baking_plan_type = ?, acknowledged_at = ?
       WHERE time_entry_id = ?`,
    ).run(remarkTrim, JSON.stringify(p.items), p.bakingPlanType, ts, p.timeEntryId)
    return getBakingNoticeByTimeEntryId(db, p.timeEntryId)!
  }
  const id = `sbn-${randomUUID()}`
  db.prepare(
    `INSERT INTO shift_baking_notices (
      id, station_id, employee_id, shift_id, time_entry_id, date, baking_plan_type, items_json, remark, acknowledged_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    p.stationId,
    p.employeeId,
    p.shiftId,
    p.timeEntryId,
    p.dateYmd,
    p.bakingPlanType,
    JSON.stringify(p.items),
    remarkTrim,
    ts,
    ts,
  )
  return db.prepare(`SELECT * FROM shift_baking_notices WHERE id = ?`).get(id) as ShiftBakingNoticeRow
}
