import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { ARAL_BODELSHAUSEN_REPRESENTATIVE_SEEDS } from '../data/representativeSeedCatalog.js'
import { nowIso } from '../utils/timestamps.js'

const BODELSHAUSEN_ID = 'aral-bodelshausen'

/** Legt Startkontakte für Aral Bodelshausen an (idempotent über seed_key). */
export function seedAralBodelshausenRepresentatives(db: Database): { inserted: number; updated: number } {
  const station = db.prepare(`SELECT id FROM stations WHERE id = ?`).get(BODELSHAUSEN_ID) as { id: string } | undefined
  if (!station) return { inserted: 0, updated: 0 }

  let inserted = 0
  let updated = 0
  const ts = nowIso()

  for (const s of ARAL_BODELSHAUSEN_REPRESENTATIVE_SEEDS) {
    const existing = db
      .prepare(`SELECT id FROM representatives WHERE station_id = ? AND seed_key = ?`)
      .get(BODELSHAUSEN_ID, s.seedKey) as { id: string } | undefined

    if (existing) {
      db.prepare(
        `UPDATE representatives SET
          company = ?, name = ?, position = ?, category = ?,
          street = ?, house_number = ?, post_code = ?, city = ?, postal_address = ?,
          phone = ?, mobile_1 = ?, email = ?, website = ?, notes = ?,
          is_favorite = ?, active = 1, archived_at = NULL, updated_at = ?
        WHERE id = ?`,
      ).run(
        s.company,
        s.name,
        s.position,
        s.category,
        s.street || null,
        s.houseNumber || null,
        s.postCode || null,
        s.city || null,
        s.postalAddress || null,
        s.phone || null,
        s.mobile1 || null,
        s.email || null,
        s.website || null,
        s.notes || null,
        s.isFavorite ? 1 : 0,
        ts,
        existing.id,
      )
      updated += 1
    } else {
      db.prepare(
        `INSERT INTO representatives (
          id, station_id, company, name, position, email, street, house_number, post_code, city,
          postal_address, phone, mobile_1, mobile_2, fax, website, category, notes,
          is_favorite, seed_key, active, created_by, created_at, updated_at, archived_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        randomUUID(),
        BODELSHAUSEN_ID,
        s.company,
        s.name,
        s.position,
        s.email || null,
        s.street || null,
        s.houseNumber || null,
        s.postCode || null,
        s.city || null,
        s.postalAddress || null,
        s.phone || null,
        s.mobile1 || null,
        null,
        null,
        s.website || null,
        s.category,
        s.notes || null,
        s.isFavorite ? 1 : 0,
        s.seedKey,
        1,
        'system-seed',
        ts,
        ts,
        null,
      )
      inserted += 1
    }
  }

  return { inserted, updated }
}
