import type { Database } from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'

export type StationDocumentRow = {
  id: string
  station_id: string
  global_document: number
  title: string
  description: string | null
  category: string | null
  document_type: string
  file_name: string
  file_path: string
  mime_type: string
  file_size: number
  preview_path: string | null
  is_template: number
  active: number
  previous_file_path: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

/** Relativer Pfad unter dem Arbeitsverzeichnis (z. B. server/data/station-documents/…). */
export function documentsRootDir(): string {
  const fromEnv = process.env.STATION_DOCUMENTS_DIR?.trim()
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv)
  return path.join(process.cwd(), 'server', 'data', 'station-documents')
}

export function resolveDocumentAbsolutePath(storedRelative: string): string {
  const rel = String(storedRelative ?? '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel || rel.includes('..')) throw new Error('Ungültiger Dateipfad')
  const abs = path.resolve(process.cwd(), rel)
  const root = path.resolve(documentsRootDir())
  if (!abs.startsWith(root)) throw new Error('Pfad außerhalb des Dokumentenordners')
  return abs
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

export function relativePathForNewDocument(stationId: string, documentId: string, safeFileName: string): string {
  const rel = path.posix.join('server', 'data', 'station-documents', stationId, documentId, safeFileName)
  return rel
}

export function listStationDocuments(
  db: Database,
  opts: {
    stationId: string
    q?: string
    category?: string
    documentType?: string
    includeArchived?: boolean
    linkedEmployeeId?: string
  },
): StationDocumentRow[] {
  const { stationId, q, category, documentType, includeArchived, linkedEmployeeId } = opts
  const terms = (q ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  let sql = `SELECT DISTINCT d.* FROM station_documents d`
  const params: (string | number)[] = []

  if (linkedEmployeeId) {
    sql += ` INNER JOIN station_document_employees l ON l.document_id = d.id AND l.employee_id = ?`
    params.push(linkedEmployeeId)
  }

  sql += ` WHERE (d.station_id = ? OR d.global_document = 1)`
  params.push(stationId)

  if (!includeArchived) {
    sql += ` AND (d.archived_at IS NULL OR trim(d.archived_at) = '')`
  }

  if (category?.trim()) {
    sql += ` AND lower(trim(d.category)) = lower(trim(?))`
    params.push(category.trim())
  }

  if (documentType?.trim()) {
    sql += ` AND d.document_type = ?`
    params.push(documentType.trim())
  }

  sql += ` ORDER BY d.updated_at DESC, d.created_at DESC`

  const rows = db.prepare(sql).all(...params) as StationDocumentRow[]

  if (terms.length === 0) return rows

  return rows.filter((d) => {
    const hay = [
      d.title,
      d.description ?? '',
      d.category ?? '',
      d.document_type ?? '',
      d.file_name ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}

export function getStationDocument(db: Database, id: string): StationDocumentRow | undefined {
  return db.prepare(`SELECT * FROM station_documents WHERE id = ?`).get(id) as StationDocumentRow | undefined
}

/** Zugriff: Station passt oder globales Dokument (für Anzeige in dieser Station). */
export function canAccessDocumentRow(row: StationDocumentRow, stationId: string): boolean {
  if (row.global_document === 1) return true
  return row.station_id === stationId
}

export function listLinkedEmployeeIds(db: Database, documentId: string): string[] {
  return (
    db.prepare(`SELECT employee_id FROM station_document_employees WHERE document_id = ?`).all(documentId) as {
      employee_id: string
    }[]
  ).map((r) => r.employee_id)
}

export function insertStationDocument(
  db: Database,
  p: {
    id?: string
    stationId: string
    globalDocument: boolean
    title: string
    description?: string | null
    category?: string | null
    documentType: string
    fileName: string
    relativePath: string
    mimeType: string
    fileSize: number
    isTemplate?: boolean
    active?: boolean
    createdBy?: string | null
  },
): StationDocumentRow {
  const id = p.id?.trim() || randomUUID()
  const ts = nowIso()
  const rel = p.relativePath.replace(/\\/g, '/')
  db.prepare(
    `INSERT INTO station_documents (
      id, station_id, global_document, title, description, category, document_type,
      file_name, file_path, mime_type, file_size, preview_path, is_template, active,
      previous_file_path, created_by, created_at, updated_at, archived_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    p.stationId,
    p.globalDocument ? 1 : 0,
    p.title.trim(),
    p.description?.trim() || null,
    p.category?.trim() || null,
    p.documentType.trim() || 'other',
    p.fileName,
    rel,
    p.mimeType,
    Math.max(0, Math.floor(p.fileSize)),
    null,
    p.isTemplate ? 1 : 0,
    p.active === false ? 0 : 1,
    null,
    p.createdBy ?? null,
    ts,
    ts,
    null,
  )
  return getStationDocument(db, id)!
}

export function updateStationDocumentMeta(
  db: Database,
  id: string,
  patch: Partial<{
    title: string
    description: string | null
    category: string | null
    documentType: string
    stationId: string
    globalDocument: boolean
    active: boolean
    isTemplate: boolean
  }>,
): StationDocumentRow | undefined {
  const row = getStationDocument(db, id)
  if (!row) return undefined
  const ts = nowIso()
  const title = patch.title !== undefined ? patch.title.trim() : row.title
  const description = patch.description !== undefined ? patch.description : row.description
  const category = patch.category !== undefined ? patch.category : row.category
  const documentType = patch.documentType !== undefined ? patch.documentType.trim() : row.document_type
  const stationId = patch.stationId !== undefined ? patch.stationId.trim() : row.station_id
  const globalDocument = patch.globalDocument !== undefined ? (patch.globalDocument ? 1 : 0) : row.global_document
  const active = patch.active !== undefined ? (patch.active ? 1 : 0) : row.active
  const isTemplate = patch.isTemplate !== undefined ? (patch.isTemplate ? 1 : 0) : row.is_template

  db.prepare(
    `UPDATE station_documents SET
      title = ?, description = ?, category = ?, document_type = ?,
      station_id = ?, global_document = ?, active = ?, is_template = ?,
      updated_at = ?
    WHERE id = ?`,
  ).run(title, description, category, documentType, stationId, globalDocument, active, isTemplate, ts, id)
  return getStationDocument(db, id)
}

export function replaceStationDocumentFile(
  db: Database,
  id: string,
  p: { fileName: string; relativePath: string; mimeType: string; fileSize: number },
): StationDocumentRow | undefined {
  const row = getStationDocument(db, id)
  if (!row) return undefined
  const ts = nowIso()
  const oldRel = row.file_path
  const newRel = p.relativePath.replace(/\\/g, '/')
  const archiveDir = path.join(documentsRootDir(), row.station_id, id, 'replaced')
  ensureDir(archiveDir)
  let previous = row.previous_file_path
  try {
    const oldAbs = resolveDocumentAbsolutePath(oldRel)
    if (fs.existsSync(oldAbs)) {
      const stamp = ts.replace(/[:.]/g, '-')
      const base = path.basename(oldAbs)
      const dest = path.join(archiveDir, `${stamp}_${base}`)
      fs.renameSync(oldAbs, dest)
      const prevRel = path.relative(process.cwd(), dest).replace(/\\/g, '/')
      previous = prevRel
    }
  } catch {
    /* alte Datei fehlt — ignorieren */
  }

  db.prepare(
    `UPDATE station_documents SET
      file_name = ?, file_path = ?, mime_type = ?, file_size = ?,
      previous_file_path = ?, preview_path = NULL, updated_at = ?
    WHERE id = ?`,
  ).run(p.fileName, newRel, p.mimeType, Math.max(0, Math.floor(p.fileSize)), previous, ts, id)
  return getStationDocument(db, id)
}

export function archiveStationDocument(db: Database, id: string): StationDocumentRow | undefined {
  const row = getStationDocument(db, id)
  if (!row) return undefined
  const ts = nowIso()
  db.prepare(`UPDATE station_documents SET archived_at = ?, active = 0, updated_at = ? WHERE id = ?`).run(ts, ts, id)
  return getStationDocument(db, id)
}

export function linkDocumentToEmployee(db: Database, documentId: string, employeeId: string): void {
  const id = randomUUID()
  const ts = nowIso()
  db.prepare(
    `INSERT OR IGNORE INTO station_document_employees (id, document_id, employee_id, created_at) VALUES (?,?,?,?)`,
  ).run(id, documentId, employeeId, ts)
}

export function unlinkDocumentFromEmployee(db: Database, documentId: string, employeeId: string): void {
  db.prepare(`DELETE FROM station_document_employees WHERE document_id = ? AND employee_id = ?`).run(documentId, employeeId)
}

export function writeDocumentBufferToDisk(relativePosix: string, buf: Buffer): void {
  const abs = path.join(process.cwd(), ...relativePosix.split('/'))
  ensureDir(path.dirname(abs))
  fs.writeFileSync(abs, buf)
}
