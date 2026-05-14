import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'

export type MinimumWageRateRow = {
  id: string
  valid_from: string
  hourly_rate: number
  note: string | null
  created_at: string | null
  updated_at: string | null
}

export function listMinimumWageRates(db: Database): MinimumWageRateRow[] {
  return db
    .prepare(`SELECT * FROM minimum_wage_rates ORDER BY valid_from ASC`)
    .all() as MinimumWageRateRow[]
}

export function createMinimumWageRate(
  db: Database,
  body: { validFrom: string; hourlyRate: number; note?: string | null },
): MinimumWageRateRow {
  const vf = String(body.validFrom ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vf)) throw new Error('validFrom als YYYY-MM-DD erforderlich')
  const hr = Number(body.hourlyRate)
  if (!Number.isFinite(hr) || hr <= 0) throw new Error('hourlyRate muss > 0 sein')
  const dup = db.prepare(`SELECT id FROM minimum_wage_rates WHERE valid_from = ?`).get(vf) as { id: string } | undefined
  if (dup) throw new Error('Für dieses Gültig-ab-Datum existiert bereits ein Eintrag')
  const ts = nowIso()
  const id = randomUUID()
  db.prepare(
    `INSERT INTO minimum_wage_rates (id, valid_from, hourly_rate, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, vf, hr, body.note != null ? String(body.note) : null, ts, ts)
  return db.prepare(`SELECT * FROM minimum_wage_rates WHERE id = ?`).get(id) as MinimumWageRateRow
}

export function updateMinimumWageRate(
  db: Database,
  id: string,
  body: { validFrom?: string; hourlyRate?: number; note?: string | null },
): MinimumWageRateRow {
  const cur = db.prepare(`SELECT * FROM minimum_wage_rates WHERE id = ?`).get(id) as MinimumWageRateRow | undefined
  if (!cur) throw new Error('Eintrag nicht gefunden')
  const vf = body.validFrom != null ? String(body.validFrom).trim() : cur.valid_from
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vf)) throw new Error('validFrom als YYYY-MM-DD erforderlich')
  if (vf !== cur.valid_from) {
    const dup = db
      .prepare(`SELECT id FROM minimum_wage_rates WHERE valid_from = ? AND id != ?`)
      .get(vf, id) as { id: string } | undefined
    if (dup) throw new Error('Für dieses Gültig-ab-Datum existiert bereits ein Eintrag')
  }
  const hr = body.hourlyRate != null ? Number(body.hourlyRate) : cur.hourly_rate
  if (!Number.isFinite(hr) || hr <= 0) throw new Error('hourlyRate muss > 0 sein')
  const note = body.note !== undefined ? (body.note == null ? null : String(body.note)) : cur.note
  const ts = nowIso()
  db.prepare(
    `UPDATE minimum_wage_rates SET valid_from = ?, hourly_rate = ?, note = ?, updated_at = ? WHERE id = ?`,
  ).run(vf, hr, note, ts, id)
  return db.prepare(`SELECT * FROM minimum_wage_rates WHERE id = ?`).get(id) as MinimumWageRateRow
}

export function deleteMinimumWageRate(db: Database, id: string) {
  const r = db.prepare(`DELETE FROM minimum_wage_rates WHERE id = ?`).run(id)
  if (r.changes === 0) throw new Error('Eintrag nicht gefunden')
}
