import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { emptyStationHolidayOverlay, type StationHolidayOverlay } from '../types/stationHolidayOverlay.js'

export type StationExtraHolidayRow = {
  id: string
  station_id: string
  date: string
  name: string
  federal_state: string | null
  is_legal: number | null
  is_special: number | null
  counts_as_public: number | null
  counts_as_special: number | null
  opening_hours_note: string | null
  remark: string | null
  active: number | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
}

function rowToApi(r: StationExtraHolidayRow) {
  return {
    id: r.id,
    date: r.date,
    name: r.name,
    federalState: r.federal_state ?? '',
    isLegal: (r.is_legal ?? 0) === 1,
    isSpecial: (r.is_special ?? 0) === 1,
    countsAsPublic: (r.counts_as_public ?? 1) === 1,
    countsAsSpecial: (r.counts_as_special ?? 0) === 1,
    openingHoursNote: r.opening_hours_note ?? '',
    remark: r.remark ?? '',
    active: (r.active ?? 1) === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
  }
}

export function listStationExtraHolidays(db: Database, stationId: string, includeInactive?: boolean) {
  let sql = `SELECT * FROM station_extra_holidays WHERE station_id = ?`
  if (!includeInactive) sql += ` AND (active IS NULL OR active = 1)`
  sql += ` ORDER BY date`
  const rows = db.prepare(sql).all(stationId) as StationExtraHolidayRow[]
  return rows.map(rowToApi)
}

export function createStationExtraHoliday(
  db: Database,
  stationId: string,
  body: Record<string, unknown>,
  createdBy?: string | null,
) {
  const date = String(body.date ?? '').trim()
  const name = String(body.name ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date als YYYY-MM-DD')
  if (!name) throw new Error('name erforderlich')
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `seh-${randomUUID()}`
  const ts = nowIso()
  db.prepare(
    `INSERT INTO station_extra_holidays (
      id, station_id, date, name, federal_state, is_legal, is_special,
      counts_as_public, counts_as_special, opening_hours_note, remark, active, created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).run(
    id,
    stationId,
    date,
    name,
    body.federalState != null ? String(body.federalState).trim() || null : null,
    body.isLegal === true || Number(body.isLegal) === 1 ? 1 : 0,
    body.isSpecial === true || Number(body.isSpecial) === 1 ? 1 : 0,
    body.countsAsPublic === false || Number(body.countsAsPublic) === 0 ? 0 : 1,
    body.countsAsSpecial === true || Number(body.countsAsSpecial) === 1 ? 1 : 0,
    body.openingHoursNote != null ? String(body.openingHoursNote) : null,
    body.remark != null ? String(body.remark) : null,
    ts,
    ts,
    createdBy ?? null,
  )
  return rowToApi(db.prepare(`SELECT * FROM station_extra_holidays WHERE id = ?`).get(id) as StationExtraHolidayRow)
}

export function updateStationExtraHoliday(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM station_extra_holidays WHERE id = ?`).get(id) as StationExtraHolidayRow | undefined
  if (!existing) throw new Error('Eintrag nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE station_extra_holidays SET
      date = COALESCE(?, date),
      name = COALESCE(?, name),
      federal_state = COALESCE(?, federal_state),
      is_legal = COALESCE(?, is_legal),
      is_special = COALESCE(?, is_special),
      counts_as_public = COALESCE(?, counts_as_public),
      counts_as_special = COALESCE(?, counts_as_special),
      opening_hours_note = COALESCE(?, opening_hours_note),
      remark = COALESCE(?, remark),
      active = COALESCE(?, active),
      updated_at = ?
    WHERE id = ?`,
  ).run(
    body.date != null ? String(body.date) : null,
    body.name != null ? String(body.name) : null,
    body.federalState !== undefined ? (body.federalState == null ? null : String(body.federalState)) : null,
    body.isLegal != null ? (body.isLegal === true || Number(body.isLegal) === 1 ? 1 : 0) : null,
    body.isSpecial != null ? (body.isSpecial === true || Number(body.isSpecial) === 1 ? 1 : 0) : null,
    body.countsAsPublic != null ? (body.countsAsPublic === false || Number(body.countsAsPublic) === 0 ? 0 : 1) : null,
    body.countsAsSpecial != null ? (body.countsAsSpecial === true || Number(body.countsAsSpecial) === 1 ? 1 : 0) : null,
    body.openingHoursNote !== undefined ? (body.openingHoursNote == null ? null : String(body.openingHoursNote)) : null,
    body.remark !== undefined ? (body.remark == null ? null : String(body.remark)) : null,
    body.active != null ? (body.active === false || Number(body.active) === 0 ? 0 : 1) : null,
    ts,
    id,
  )
  return rowToApi(db.prepare(`SELECT * FROM station_extra_holidays WHERE id = ?`).get(id) as StationExtraHolidayRow)
}

export function getStationExtraHolidayStationId(db: Database, id: string): string | undefined {
  const r = db.prepare(`SELECT station_id FROM station_extra_holidays WHERE id = ?`).get(id) as { station_id: string } | undefined
  return r?.station_id
}

/** Für Lohn-/Zuschlagslogik: aktive Zusatz-Tage mit Flags. */
export function buildStationHolidayOverlay(db: Database, stationId: string): StationHolidayOverlay {
  const rows = db
    .prepare(
      `SELECT date, name, counts_as_public, counts_as_special FROM station_extra_holidays
       WHERE station_id = ? AND (active IS NULL OR active = 1)`,
    )
    .all(stationId) as { date: string; name: string; counts_as_public: number | null; counts_as_special: number | null }[]

  if (!rows.length) return emptyStationHolidayOverlay()

  const extraPublicDates = new Set<string>()
  const extraNames = new Map<string, string>()
  const specialAllDayDates = new Set<string>()

  for (const r of rows) {
    const d = String(r.date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
    const nm = String(r.name ?? '').trim() || 'Zusatz-Feiertag'
    if ((r.counts_as_public ?? 1) === 1) extraPublicDates.add(d)
    extraNames.set(d, nm)
    if ((r.counts_as_special ?? 0) === 1) specialAllDayDates.add(d)
  }
  return { extraPublicDates, extraNames, specialAllDayDates }
}
