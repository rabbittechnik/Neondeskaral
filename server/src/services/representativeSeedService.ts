import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { ARAL_BODELSHAUSEN_REPRESENTATIVE_SEEDS, type RepresentativeSeedEntry } from '../data/representativeSeedCatalog.js'
import { nowIso } from '../utils/timestamps.js'

const BODELSHAUSEN_ID = 'aral-bodelshausen'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function findExistingId(db: Database, stationId: string, seed: RepresentativeSeedEntry): string | null {
  const byKey = db
    .prepare(`SELECT id FROM representatives WHERE station_id = ? AND seed_key = ? LIMIT 1`)
    .get(stationId, seed.seedKey) as { id: string } | undefined
  if (byKey) return byKey.id

  const byName = db
    .prepare(
      `SELECT id FROM representatives
       WHERE station_id = ?
         AND lower(trim(company)) = lower(trim(?))
         AND lower(trim(name)) = lower(trim(?))
       LIMIT 1`,
    )
    .get(stationId, seed.company, seed.name) as { id: string } | undefined
  return byName?.id ?? null
}

function upsertSeed(db: Database, stationId: string, seed: RepresentativeSeedEntry, ts: string): 'inserted' | 'updated' {
  const existingId = findExistingId(db, stationId, seed)

  if (existingId) {
    db.prepare(
      `UPDATE representatives SET
        company = ?, name = ?, position = ?, category = ?,
        street = ?, house_number = ?, post_code = ?, city = ?, postal_address = ?,
        phone = ?, mobile_1 = ?, mobile_2 = ?, fax = ?, email = ?, website = ?, notes = ?,
        is_favorite = ?, seed_key = ?, active = 1, archived_at = NULL, updated_at = ?
      WHERE id = ?`,
    ).run(
      seed.company,
      seed.name,
      seed.position || null,
      seed.category,
      seed.street || null,
      seed.houseNumber || null,
      seed.postCode || null,
      seed.city || null,
      seed.postalAddress || null,
      seed.phone || null,
      seed.mobile1 || null,
      seed.mobile2 || null,
      seed.fax || null,
      seed.email || null,
      seed.website || null,
      seed.notes || null,
      seed.isFavorite ? 1 : 0,
      seed.seedKey,
      ts,
      existingId,
    )
    return 'updated'
  }

  db.prepare(
    `INSERT INTO representatives (
      id, station_id, company, name, position, email, street, house_number, post_code, city,
      postal_address, phone, mobile_1, mobile_2, fax, website, category, notes,
      is_favorite, seed_key, active, created_by, created_at, updated_at, archived_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    randomUUID(),
    stationId,
    seed.company,
    seed.name,
    seed.position || null,
    seed.email || null,
    seed.street || null,
    seed.houseNumber || null,
    seed.postCode || null,
    seed.city || null,
    seed.postalAddress || null,
    seed.phone || null,
    seed.mobile1 || null,
    seed.mobile2 || null,
    seed.fax || null,
    seed.website || null,
    seed.category,
    seed.notes || null,
    seed.isFavorite ? 1 : 0,
    seed.seedKey,
    1,
    'system-seed',
    ts,
    ts,
    null,
  )
  return 'inserted'
}

/** Legt/aktualisiert Startkontakte für Aral Bodelshausen (idempotent). */
export function seedAralBodelshausenRepresentatives(db: Database): { inserted: number; updated: number } {
  const station = db.prepare(`SELECT id FROM stations WHERE id = ?`).get(BODELSHAUSEN_ID) as { id: string } | undefined
  if (!station) return { inserted: 0, updated: 0 }

  let inserted = 0
  let updated = 0
  const ts = nowIso()
  const seen = new Set<string>()

  for (const s of ARAL_BODELSHAUSEN_REPRESENTATIVE_SEEDS) {
    const dedupeKey = `${norm(s.company)}|${norm(s.name)}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const result = upsertSeed(db, BODELSHAUSEN_ID, s, ts)
    if (result === 'inserted') inserted += 1
    else updated += 1
  }

  return { inserted, updated }
}
