import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { isBadenWuerttembergPublicHolidayYmd, isWeekendBerlinYmd } from './bwHolidayCalendar.js'

export type BackshopRoutineType = 'weekday' | 'weekend' | 'holiday'

export type BackshopRoutineRow = {
  id: string
  station_id: string
  routine_type: string
  title: string
  description: string | null
  active: number
  created_at: string
  updated_at: string
}

export type BackshopRoutineItemRow = {
  id: string
  routine_id: string
  name: string
  quantity: number
  unit: string
  category: string | null
  sort_order: number
  active: number
  valid_from: string | null
  valid_to: string | null
  restrict_day_type: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export function resolveBackshopRoutineKindForBerlinYmd(ymd: string): BackshopRoutineType {
  if (isBadenWuerttembergPublicHolidayYmd(ymd)) return 'holiday'
  if (isWeekendBerlinYmd(ymd)) return 'weekend'
  return 'weekday'
}

export function routineTypeLabelDe(t: string): string {
  const x = String(t ?? '').toLowerCase()
  if (x === 'weekday') return 'Normaler Wochentag'
  if (x === 'weekend') return 'Wochenende'
  if (x === 'holiday') return 'Feiertag'
  return t
}

export function formatBackshopLine(name: string, quantity: number, unit: string): string {
  const u = (unit ?? '').trim()
  const q = Number.isInteger(quantity) ? String(quantity) : String(Math.round(quantity * 100) / 100).replace('.', ',')
  if (!u || u.toLowerCase() === 'stück' || u.toLowerCase() === 'stk') return `${q} ${name}`.trim()
  return `${q} ${name} (${u})`.trim()
}

export type BackshopItemSnapshot = {
  itemId: string | null
  name: string
  quantity: number
  unit: string
  category: string | null
  line: string
}

export type BackshopResolvedNotice = {
  routineType: BackshopRoutineType
  routineId: string | null
  title: string
  displayLines: string[]
  itemSnapshots: BackshopItemSnapshot[]
}

function itemPassesFilters(row: BackshopRoutineItemRow, ymd: string, kind: BackshopRoutineType): boolean {
  if (row.active !== 1) return false
  const vf = row.valid_from?.trim()
  const vt = row.valid_to?.trim()
  if (vf && ymd < vf) return false
  if (vt && ymd > vt) return false
  const r = (row.restrict_day_type ?? '').trim().toLowerCase()
  if (!r) return true
  if (r === 'holiday') return kind === 'holiday'
  if (r === 'weekend') return kind === 'weekend'
  if (r === 'weekday') return kind === 'weekday'
  return true
}

/** Liefert Vorgaben für Popup / Ack (leer wenn Station nicht gepflegt). */
export function resolveBackshopNoticeForStationAndDate(
  db: Database,
  stationId: string,
  ymdBerlin: string,
): BackshopResolvedNotice {
  const kind = resolveBackshopRoutineKindForBerlinYmd(ymdBerlin)
  const titleFallback =
    kind === 'weekday' ? 'Backwaren für heute' : kind === 'weekend' ? 'Backwaren für Wochenende' : 'Backwaren für Feiertag'

  const routine = db
    .prepare(
      `SELECT * FROM backshop_routines WHERE station_id = ? AND routine_type = ? AND active = 1 LIMIT 1`,
    )
    .get(stationId, kind) as BackshopRoutineRow | undefined

  if (!routine) {
    return { routineType: kind, routineId: null, title: titleFallback, displayLines: [], itemSnapshots: [] }
  }

  const items = db
    .prepare(`SELECT * FROM backshop_routine_items WHERE routine_id = ? ORDER BY sort_order ASC, name ASC`)
    .all(routine.id) as BackshopRoutineItemRow[]

  const displayLines: string[] = []
  const itemSnapshots: BackshopItemSnapshot[] = []
  for (const it of items) {
    if (!itemPassesFilters(it, ymdBerlin, kind)) continue
    const line = formatBackshopLine(it.name, it.quantity, it.unit ?? 'Stück')
    displayLines.push(line)
    itemSnapshots.push({
      itemId: it.id,
      name: it.name,
      quantity: it.quantity,
      unit: it.unit ?? 'Stück',
      category: it.category,
      line,
    })
  }

  return {
    routineType: kind,
    routineId: routine.id,
    title: routine.title?.trim() || titleFallback,
    displayLines,
    itemSnapshots,
  }
}

export function listBackshopRoutinesWithItems(db: Database, stationId: string) {
  const routines = db
    .prepare(`SELECT * FROM backshop_routines WHERE station_id = ? ORDER BY routine_type ASC`)
    .all(stationId) as BackshopRoutineRow[]
  const itemStmt = db.prepare(
    `SELECT * FROM backshop_routine_items WHERE routine_id = ? ORDER BY sort_order ASC, name ASC`,
  )
  return routines.map((r) => ({
    ...rowToRoutineApi(r),
    items: (itemStmt.all(r.id) as BackshopRoutineItemRow[]).map(rowToItemApi),
  }))
}

export function rowToRoutineApi(r: BackshopRoutineRow) {
  return {
    id: r.id,
    stationId: r.station_id,
    routineType: r.routine_type as BackshopRoutineType,
    title: r.title,
    description: r.description,
    active: r.active === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function rowToItemApi(r: BackshopRoutineItemRow) {
  return {
    id: r.id,
    routineId: r.routine_id,
    name: r.name,
    quantity: r.quantity,
    unit: r.unit,
    category: r.category,
    sortOrder: r.sort_order,
    active: r.active === 1,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    restrictDayType: r.restrict_day_type,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function updateBackshopRoutine(
  db: Database,
  routineId: string,
  patch: { title?: string; description?: string | null; active?: boolean },
) {
  const row = db.prepare(`SELECT * FROM backshop_routines WHERE id = ?`).get(routineId) as BackshopRoutineRow | undefined
  if (!row) throw new Error('Routine nicht gefunden')
  const ts = nowIso()
  const title = patch.title !== undefined ? String(patch.title).trim() : row.title
  const description = patch.description !== undefined ? patch.description : row.description
  const active = patch.active !== undefined ? (patch.active ? 1 : 0) : row.active
  db.prepare(
    `UPDATE backshop_routines SET title = ?, description = ?, active = ?, updated_at = ? WHERE id = ?`,
  ).run(title, description, active, ts, routineId)
  const updated = db.prepare(`SELECT * FROM backshop_routines WHERE id = ?`).get(routineId) as BackshopRoutineRow
  return rowToRoutineApi(updated)
}

export function createBackshopRoutineItem(
  db: Database,
  routineId: string,
  body: {
    name: string
    quantity?: number
    unit?: string
    category?: string | null
    sortOrder?: number
    active?: boolean
    validFrom?: string | null
    validTo?: string | null
    restrictDayType?: string | null
    notes?: string | null
  },
) {
  const r = db.prepare(`SELECT id FROM backshop_routines WHERE id = ?`).get(routineId) as { id: string } | undefined
  if (!r) throw new Error('Routine nicht gefunden')
  const ts = nowIso()
  const id = `bi-${randomUUID()}`
  const maxSo =
    (db.prepare(`SELECT COALESCE(MAX(sort_order), 0) as m FROM backshop_routine_items WHERE routine_id = ?`).get(routineId) as {
      m: number
    }).m ?? 0
  const sortOrder = body.sortOrder != null ? Number(body.sortOrder) : maxSo + 1
  db.prepare(
    `INSERT INTO backshop_routine_items (
      id, routine_id, name, quantity, unit, category, sort_order, active, valid_from, valid_to, restrict_day_type, notes, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    routineId,
    String(body.name ?? '').trim(),
    Number.isFinite(Number(body.quantity)) ? Number(body.quantity) : 1,
    String(body.unit ?? 'Stück').trim() || 'Stück',
    body.category != null ? String(body.category) : null,
    sortOrder,
    body.active === false ? 0 : 1,
    body.validFrom?.trim() || null,
    body.validTo?.trim() || null,
    body.restrictDayType?.trim() || null,
    body.notes != null ? String(body.notes) : null,
    ts,
    ts,
  )
  return rowToItemApi(db.prepare(`SELECT * FROM backshop_routine_items WHERE id = ?`).get(id) as BackshopRoutineItemRow)
}

export function updateBackshopRoutineItem(
  db: Database,
  itemId: string,
  patch: {
    name?: string
    quantity?: number
    unit?: string
    category?: string | null
    sortOrder?: number
    active?: boolean
    validFrom?: string | null
    validTo?: string | null
    restrictDayType?: string | null
    notes?: string | null
  },
) {
  const row = db.prepare(`SELECT * FROM backshop_routine_items WHERE id = ?`).get(itemId) as BackshopRoutineItemRow | undefined
  if (!row) throw new Error('Artikel nicht gefunden')
  const ts = nowIso()
  const name = patch.name !== undefined ? String(patch.name).trim() : row.name
  const quantity = patch.quantity !== undefined ? Number(patch.quantity) : row.quantity
  const unit = patch.unit !== undefined ? String(patch.unit).trim() : row.unit
  const category = patch.category !== undefined ? patch.category : row.category
  const sortOrder = patch.sortOrder !== undefined ? Number(patch.sortOrder) : row.sort_order
  const active = patch.active !== undefined ? (patch.active ? 1 : 0) : row.active
  const validFrom = patch.validFrom !== undefined ? (patch.validFrom?.trim() || null) : row.valid_from
  const validTo = patch.validTo !== undefined ? (patch.validTo?.trim() || null) : row.valid_to
  const restrictDayType =
    patch.restrictDayType !== undefined ? (patch.restrictDayType?.trim() || null) : row.restrict_day_type
  const notes = patch.notes !== undefined ? (patch.notes != null ? String(patch.notes) : null) : row.notes
  db.prepare(
    `UPDATE backshop_routine_items SET name = ?, quantity = ?, unit = ?, category = ?, sort_order = ?, active = ?,
     valid_from = ?, valid_to = ?, restrict_day_type = ?, notes = ?, updated_at = ? WHERE id = ?`,
  ).run(name, quantity, unit, category, sortOrder, active, validFrom, validTo, restrictDayType, notes, ts, itemId)
  return rowToItemApi(db.prepare(`SELECT * FROM backshop_routine_items WHERE id = ?`).get(itemId) as BackshopRoutineItemRow)
}

export function deleteBackshopRoutineItem(db: Database, itemId: string) {
  const r = db.prepare(`DELETE FROM backshop_routine_items WHERE id = ?`).run(itemId)
  if (r.changes === 0) throw new Error('Artikel nicht gefunden')
}
