import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import type { ShiftCloseChecklistKind } from '../constants/shiftCloseChecklistCatalog.js'
import {
  SHIFT_CLOSING_CATALOG,
  SHIFT_CLOSING_GROUP_LABELS,
  SHIFT_HANDOVER_CATALOG,
} from '../constants/shiftCloseChecklistCatalog.js'

export type ShiftCloseAnswerMode = 'yes_no' | 'yes_no_not_relevant'

export type StationShiftChecklistDefRow = {
  id: string
  station_id: string
  checklist_type: string
  item_key: string
  label: string
  sort_order: number
  answer_mode: string
  group_id: string | null
  group_label: string | null
  active: number | null
  created_at: string | null
  updated_at: string | null
}

export type ShiftCloseChecklistClientItem = {
  key: string
  label: string
  group: string | null
  groupLabel: string | null
  answerMode: ShiftCloseAnswerMode
}

export type ShiftCloseChecklistWizardGroup = {
  id: string
  label: string
  itemKeys: string[]
}

function normAnswerMode(raw: string | null | undefined): ShiftCloseAnswerMode {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'yes_no_not_relevant' || s === 'tri' || s === 'three') return 'yes_no_not_relevant'
  return 'yes_no'
}

/** Gruppen in Anzeigereihenfolge (erstes Vorkommen pro group_id). */
export function buildWizardGroupsFromClosingItems(
  items: { key: string; group?: string | null; groupLabel?: string | null }[],
): ShiftCloseChecklistWizardGroup[] {
  const order: ShiftCloseChecklistWizardGroup[] = []
  const byId = new Map<string, ShiftCloseChecklistWizardGroup>()
  for (const it of items) {
    const has = it.group && String(it.group).trim() !== ''
    const id = has ? String(it.group).trim() : '_other'
    const label = has ? String(it.groupLabel ?? it.group).trim() || id : 'Sonstiges'
    let g = byId.get(id)
    if (!g) {
      g = { id, label, itemKeys: [] }
      byId.set(id, g)
      order.push(g)
    }
    g!.itemKeys.push(it.key)
  }
  return order
}

export function defRowToClientItem(r: StationShiftChecklistDefRow): {
  key: string
  label: string
  group: string | null
  groupLabel: string | null
  answerMode: ShiftCloseAnswerMode
} {
  return {
    key: r.item_key,
    label: r.label,
    group: r.group_id,
    groupLabel: r.group_label,
    answerMode: normAnswerMode(r.answer_mode),
  }
}

export function countShiftCloseChecklistDefs(db: Database, stationId: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM station_shift_close_checklist_defs WHERE station_id = ?`)
    .get(stationId) as { c: number }
  return row.c ?? 0
}

/** Alle Zeilen (auch inaktiv) — z. B. für spätere Stations-Einstellungen. */
export function listShiftCloseChecklistDefsForAdmin(
  db: Database,
  stationId: string,
  kind?: ShiftCloseChecklistKind,
): StationShiftChecklistDefRow[] {
  let sql = `SELECT * FROM station_shift_close_checklist_defs WHERE station_id = ?`
  const params: unknown[] = [stationId]
  if (kind) {
    sql += ` AND checklist_type = ?`
    params.push(kind)
  }
  sql += ` ORDER BY checklist_type ASC, sort_order ASC, item_key ASC`
  return db.prepare(sql).all(...params) as StationShiftChecklistDefRow[]
}

export function listActiveShiftCloseChecklistDefs(
  db: Database,
  stationId: string,
  kind: ShiftCloseChecklistKind,
): StationShiftChecklistDefRow[] {
  return db
    .prepare(
      `SELECT * FROM station_shift_close_checklist_defs
       WHERE station_id = ? AND checklist_type = ? AND (active IS NULL OR active = 1)
       ORDER BY sort_order ASC, item_key ASC`,
    )
    .all(stationId, kind) as StationShiftChecklistDefRow[]
}

/** Standard-Checklisten aus eingebautem Katalog (nur wenn Station noch keine Definitionen hat). */
export function seedStationShiftCloseChecklistDefsFromBuiltInCatalog(db: Database, stationId: string) {
  if (countShiftCloseChecklistDefs(db, stationId) > 0) return
  const ts = nowIso()
  const ins = db.prepare(
    `INSERT INTO station_shift_close_checklist_defs (
      id, station_id, checklist_type, item_key, label, sort_order, answer_mode, group_id, group_label, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
  let o = 0
  for (const it of SHIFT_HANDOVER_CATALOG) {
    ins.run(`sscd-${randomUUID()}`, stationId, 'handover', it.key, it.label, o++, 'yes_no', null, null, ts, ts)
  }
  o = 0
  for (const it of SHIFT_CLOSING_CATALOG) {
    const gid = it.group ?? null
    const gl = gid ? SHIFT_CLOSING_GROUP_LABELS[it.group!] ?? null : null
    ins.run(
      `sscd-${randomUUID()}`,
      stationId,
      'closing',
      it.key,
      it.label,
      o++,
      'yes_no_not_relevant',
      gid,
      gl,
      ts,
      ts,
    )
  }
}

export function seedAllStationsShiftCloseChecklistDefsIfMissing(db: Database) {
  const stations = db.prepare(`SELECT id FROM stations`).all() as { id: string }[]
  for (const { id } of stations) {
    seedStationShiftCloseChecklistDefsFromBuiltInCatalog(db, id)
  }
}

export function ensureStationShiftCloseChecklistDefsSeeded(db: Database, stationId: string) {
  seedStationShiftCloseChecklistDefsFromBuiltInCatalog(db, stationId)
}

export type ShiftCloseChecklistStartPayload = {
  checklistType: ShiftCloseChecklistKind
  items: ShiftCloseChecklistClientItem[]
  wizardGroups?: ShiftCloseChecklistWizardGroup[]
}

export function buildShiftCloseChecklistStartPayload(
  db: Database,
  stationId: string,
  kind: ShiftCloseChecklistKind,
): ShiftCloseChecklistStartPayload {
  ensureStationShiftCloseChecklistDefsSeeded(db, stationId)
  const rows = listActiveShiftCloseChecklistDefs(db, stationId, kind)
  const items = rows.map(defRowToClientItem)
  const payload: ShiftCloseChecklistStartPayload = { checklistType: kind, items }
  if (kind === 'closing' && items.length > 0) {
    const wg = buildWizardGroupsFromClosingItems(items)
    payload.wizardGroups = wg.length > 0 ? wg : [{ id: '_all', label: 'Ladenschluss', itemKeys: items.map((i) => i.key) }]
  }
  return payload
}
