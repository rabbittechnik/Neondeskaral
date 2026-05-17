import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'

export const REPRESENTATIVE_CATEGORY_VALUES = [
  'Tabak',
  'Gas',
  'Hauptlieferant / Aral',
  'Technik',
  'Bank / Kasse',
  'Lotto',
  'Lebensmittel',
  'Waschanlage',
  'TÜV / Sicherheit',
  'Getränke / Energy',
  'Shop / Warenlieferant',
  'Papier / Hygiene',
  'Ausbildung / IHK',
  'E-Zigaretten / Liquids',
  'Lederwaren',
  'Tankstelle / Energie',
  'Sonstige',
] as const

export type RepresentativeRow = {
  id: string
  station_id: string
  company: string
  name: string
  position: string | null
  email: string | null
  street: string | null
  house_number: string | null
  post_code: string | null
  city: string | null
  postal_address: string | null
  phone: string | null
  mobile_1: string | null
  mobile_2: string | null
  fax: string | null
  website: string | null
  category: string | null
  notes: string | null
  is_favorite: number | null
  seed_key: string | null
  business_card_path: string | null
  active: number | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  archived_at: string | null
}

export type RepresentativeApi = {
  id: string
  stationId: string
  company: string
  name: string
  position: string
  email: string
  street: string
  houseNumber: string
  postCode: string
  city: string
  postalAddress: string
  phone: string
  mobile1: string
  mobile2: string
  fax: string
  website: string
  category: string
  notes: string
  isFavorite: boolean
  businessCardPath: string | null
  active: boolean
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
  archivedAt: string | null
}

function normalizeCategory(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function rowToApi(r: RepresentativeRow): RepresentativeApi {
  return {
    id: r.id,
    stationId: r.station_id,
    company: r.company,
    name: r.name,
    position: r.position ?? '',
    email: r.email ?? '',
    street: r.street ?? '',
    houseNumber: r.house_number ?? '',
    postCode: r.post_code ?? '',
    city: r.city ?? '',
    postalAddress: r.postal_address ?? '',
    phone: r.phone ?? '',
    mobile1: r.mobile_1 ?? '',
    mobile2: r.mobile_2 ?? '',
    fax: r.fax ?? '',
    website: r.website ?? '',
    category: r.category ?? '',
    notes: r.notes ?? '',
    isFavorite: (r.is_favorite ?? 0) === 1,
    businessCardPath: r.business_card_path ?? null,
    active: (r.active ?? 1) === 1,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function getRepresentativeStationId(db: Database, id: string): string | null {
  const r = db.prepare(`SELECT station_id FROM representatives WHERE id = ?`).get(id) as
    | { station_id: string }
    | undefined
  return r?.station_id ?? null
}

export function getRepresentative(db: Database, id: string): RepresentativeApi | null {
  const r = db.prepare(`SELECT * FROM representatives WHERE id = ?`).get(id) as RepresentativeRow | undefined
  return r ? rowToApi(r) : null
}

export type ListRepresentativesOpts = {
  includeArchived?: boolean
  categoryFilter?: string
  favoritesOnly?: boolean
  sort?: 'company' | 'name'
}

export function listRepresentatives(
  db: Database,
  stationId: string,
  opts?: ListRepresentativesOpts,
): RepresentativeApi[] {
  const includeArchived = opts?.includeArchived === true
  const favoritesOnly = opts?.favoritesOnly === true
  const sort = opts?.sort === 'name' ? 'name' : 'company'
  const cat = (opts?.categoryFilter ?? '').trim()

  const clauses: string[] = ['station_id = ?']
  const params: unknown[] = [stationId]

  if (!includeArchived) {
    clauses.push(`(active IS NULL OR active = 1)`)
    clauses.push(`(archived_at IS NULL OR trim(archived_at) = '')`)
  }

  if (favoritesOnly) {
    clauses.push(`is_favorite = 1`)
  }

  if (cat && cat !== 'all') {
    clauses.push(`category = ?`)
    params.push(cat)
  }

  const where = clauses.join(' AND ')
  const sortTail =
    sort === 'name'
      ? `name COLLATE NOCASE ASC, company COLLATE NOCASE ASC`
      : `company COLLATE NOCASE ASC, name COLLATE NOCASE ASC`
  const orderBy = `is_favorite DESC, ${sortTail}`

  const rows = db.prepare(`SELECT * FROM representatives WHERE ${where} ORDER BY ${orderBy}`).all(...params) as
    RepresentativeRow[]

  return rows.map(rowToApi)
}

export function createRepresentative(
  db: Database,
  stationId: string,
  body: Record<string, unknown>,
  createdBy: string,
): RepresentativeApi {
  const company = str(body.company)
  const name = str(body.name)
  if (!company) throw new Error('Firma ist erforderlich')
  if (!name) throw new Error('Name des Vertreters ist erforderlich')

  const id = randomUUID()
  const ts = nowIso()
  const category = normalizeCategory(body.category)

  const isFavorite = body.isFavorite === true || body.is_favorite === 1 || body.is_favorite === true

  db.prepare(
    `INSERT INTO representatives (
      id, station_id, company, name, position, email, street, house_number, post_code, city,
      postal_address, phone, mobile_1, mobile_2, fax, website, category, notes,
      is_favorite, active, created_by, created_at, updated_at, archived_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    stationId,
    company,
    name,
    str(body.position) || null,
    str(body.email) || null,
    str(body.street) || null,
    str(body.houseNumber) || str(body.house_number) || null,
    str(body.postCode) || str(body.post_code) || null,
    str(body.city) || null,
    str(body.postalAddress) || str(body.postal_address) || null,
    str(body.phone) || null,
    str(body.mobile1) || str(body.mobile_1) || null,
    str(body.mobile2) || str(body.mobile_2) || null,
    str(body.fax) || null,
    str(body.website) || null,
    category || null,
    str(body.notes) || null,
    isFavorite ? 1 : 0,
    body.active === false ? 0 : 1,
    createdBy,
    ts,
    ts,
    null,
  )

  const created = getRepresentative(db, id)
  if (!created) throw new Error('Speichern fehlgeschlagen')
  return created
}

export function updateRepresentative(db: Database, id: string, body: Record<string, unknown>): RepresentativeApi {
  const existing = db.prepare(`SELECT * FROM representatives WHERE id = ?`).get(id) as RepresentativeRow | undefined
  if (!existing) throw new Error('Vertreter nicht gefunden')

  const company = body.company !== undefined ? str(body.company) : existing.company
  const name = body.name !== undefined ? str(body.name) : existing.name
  if (!company) throw new Error('Firma ist erforderlich')
  if (!name) throw new Error('Name des Vertreters ist erforderlich')

  const ts = nowIso()
  const category =
    body.category !== undefined ? normalizeCategory(body.category) : (existing.category ?? '')

  const email = body.email !== undefined ? str(body.email) || null : existing.email
  const street = body.street !== undefined ? str(body.street) || null : existing.street
  const houseNumber =
    body.houseNumber !== undefined || body.house_number !== undefined
      ? str(body.houseNumber) || str(body.house_number) || null
      : existing.house_number
  const postCode =
    body.postCode !== undefined || body.post_code !== undefined
      ? str(body.postCode) || str(body.post_code) || null
      : existing.post_code
  const city = body.city !== undefined ? str(body.city) || null : existing.city
  const phone = body.phone !== undefined ? str(body.phone) || null : existing.phone
  const mobile1 =
    body.mobile1 !== undefined || body.mobile_1 !== undefined
      ? str(body.mobile1) || str(body.mobile_1) || null
      : existing.mobile_1
  const mobile2 =
    body.mobile2 !== undefined || body.mobile_2 !== undefined
      ? str(body.mobile2) || str(body.mobile_2) || null
      : existing.mobile_2
  const fax = body.fax !== undefined ? str(body.fax) || null : existing.fax
  const website = body.website !== undefined ? str(body.website) || null : existing.website
  const position = body.position !== undefined ? str(body.position) || null : existing.position
  const postalAddress =
    body.postalAddress !== undefined || body.postal_address !== undefined
      ? str(body.postalAddress) || str(body.postal_address) || null
      : existing.postal_address
  const notes = body.notes !== undefined ? str(body.notes) || null : existing.notes
  const isFavorite =
    body.isFavorite !== undefined || body.is_favorite !== undefined
      ? body.isFavorite === true || body.is_favorite === 1 || body.is_favorite === true
        ? 1
        : 0
      : (existing.is_favorite ?? 0)
  const active =
    body.active === undefined
      ? existing.active ?? 1
      : body.active === false || body.active === 0
        ? 0
        : 1

  db.prepare(
    `UPDATE representatives SET
      company = ?, name = ?, position = ?, email = ?, street = ?, house_number = ?, post_code = ?, city = ?,
      postal_address = ?, phone = ?, mobile_1 = ?, mobile_2 = ?, fax = ?, website = ?, category = ?, notes = ?,
      is_favorite = ?, active = ?, updated_at = ?
    WHERE id = ?`,
  ).run(
    company,
    name,
    position,
    email,
    street,
    houseNumber,
    postCode,
    city,
    postalAddress,
    phone,
    mobile1,
    mobile2,
    fax,
    website,
    category || null,
    notes,
    isFavorite,
    active,
    ts,
    id,
  )

  const updated = getRepresentative(db, id)
  if (!updated) throw new Error('Aktualisierung fehlgeschlagen')
  return updated
}

export function archiveRepresentative(db: Database, id: string): RepresentativeApi {
  const existing = db.prepare(`SELECT * FROM representatives WHERE id = ?`).get(id) as RepresentativeRow | undefined
  if (!existing) throw new Error('Vertreter nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE representatives SET active = 0, archived_at = ?, updated_at = ? WHERE id = ?`,
  ).run(ts, ts, id)
  const u = getRepresentative(db, id)
  if (!u) throw new Error('Archivieren fehlgeschlagen')
  return u
}

export function restoreRepresentative(db: Database, id: string): RepresentativeApi {
  const existing = db.prepare(`SELECT * FROM representatives WHERE id = ?`).get(id) as RepresentativeRow | undefined
  if (!existing) throw new Error('Vertreter nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE representatives SET active = 1, archived_at = NULL, updated_at = ? WHERE id = ?`,
  ).run(ts, id)
  const u = getRepresentative(db, id)
  if (!u) throw new Error('Wiederherstellen fehlgeschlagen')
  return u
}

export function deleteRepresentativePermanent(db: Database, id: string): void {
  const existing = db.prepare(`SELECT id FROM representatives WHERE id = ?`).get(id)
  if (!existing) throw new Error('Vertreter nicht gefunden')
  db.prepare(`DELETE FROM representatives WHERE id = ?`).run(id)
}
