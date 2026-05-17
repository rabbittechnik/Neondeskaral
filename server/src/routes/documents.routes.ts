import { Router } from 'express'
import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { getAccess, requirePermission, requireAnyPermission, requireStationId } from '../middleware/stationAuth.js'
import { DOCUMENT_TEMPLATE_CATALOG, type DocumentTemplateKey } from '../data/documentTemplateCatalog.js'
import * as stationDocumentService from '../services/stationDocumentService.js'
import * as employeeService from '../services/employeeService.js'
import type { StationDocumentRow } from '../services/stationDocumentService.js'

export const documentsRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ])
    if (ok.has(file.mimetype)) cb(null, true)
    else cb(new Error('Nicht unterstützter Dateityp (PDF, PNG, JPG, DOCX).'))
  },
})

function safeBaseName(name: string): string {
  return path.basename(String(name ?? 'upload').replace(/[^a-zA-Z0-9._-]+/g, '_')).slice(0, 160) || 'upload'
}

function rowToApi(row: StationDocumentRow, linkedIds: string[]) {
  return {
    id: row.id,
    stationId: row.station_id,
    globalDocument: row.global_document === 1,
    title: row.title,
    description: row.description,
    category: row.category,
    documentType: row.document_type,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    isTemplate: row.is_template === 1,
    active: row.active === 1,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    linkedEmployeeIds: linkedIds,
    templateKey: row.template_key ?? null,
    versionLabel: row.version_label ?? null,
  }
}

function sendFileResolved(res: import('express').Response, absPath: string, downloadName: string, inline: boolean) {
  if (!fs.existsSync(absPath)) {
    res.status(404).json({ ok: false, error: 'Datei nicht gefunden' })
    return
  }
  const lower = downloadName.toLowerCase()
  const mime = lower.endsWith('.pdf')
    ? 'application/pdf'
    : lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'image/jpeg'
        : lower.endsWith('.docx')
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/octet-stream'
  res.setHeader('Content-Type', mime)
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
  )
  res.sendFile(absPath, (err) => {
    if (err && !res.headersSent) res.status(500).json({ ok: false, error: 'Dateiauslieferung fehlgeschlagen' })
  })
}

documentsRouter.get('/templates/catalog', (_req, res) => {
  jsonOk(res, { templates: DOCUMENT_TEMPLATE_CATALOG })
})

documentsRouter.get('/templates', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'documents.view')) return
    const db = getDb()
    const rows = stationDocumentService.listStationDocumentTemplates(db, stationId!)
    const items = rows.map((r) => rowToApi(r, stationDocumentService.listLinkedEmployeeIds(db, r.id)))
    jsonOk(res, { templates: items })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

documentsRouter.post('/templates/:templateKey/copy', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'documents.edit')) return
    const key = String(req.params.templateKey ?? '').trim() as DocumentTemplateKey
    const body = (req.body ?? {}) as { titleSuffix?: string; employeeId?: string }
    const ctx = getAccess(req)
    const row = stationDocumentService.copyStationDocumentFromTemplate(getDb(), stationId!, key, {
      titleSuffix: body.titleSuffix,
      linkedEmployeeId: body.employeeId,
      createdBy: ctx?.userId ?? null,
    })
    const linked = stationDocumentService.listLinkedEmployeeIds(getDb(), row.id)
    jsonOk(res, { document: rowToApi(row, linked) }, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

documentsRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'documents.view')) return
    const db = getDb()
    stationDocumentService.ensureStationDocumentTemplates(db, stationId!)
    const q = typeof req.query.q === 'string' ? req.query.q : undefined
    const category = typeof req.query.category === 'string' ? req.query.category : undefined
    const documentType = typeof req.query.documentType === 'string' ? req.query.documentType : undefined
    const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true'
    const linkedEmployeeId = typeof req.query.linkedEmployeeId === 'string' ? req.query.linkedEmployeeId : undefined
    const rows = stationDocumentService.listStationDocuments(db, {
      stationId: stationId!,
      q,
      category,
      documentType,
      includeArchived,
      linkedEmployeeId,
    })
    const items = rows.map((r) => rowToApi(r, stationDocumentService.listLinkedEmployeeIds(db, r.id)))
    jsonOk(res, { documents: items })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

documentsRouter.get('/:id/download', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireAnyPermission(req, res, stationId, ['documents.view', 'documents.print'])) return
    const row = stationDocumentService.getStationDocument(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Dokument nicht gefunden', 404)
    if (!stationDocumentService.canAccessDocumentRow(row, stationId!))
      return jsonErr(res, 'Kein Zugriff auf dieses Dokument', 403)
    const abs = stationDocumentService.resolveDocumentAbsolutePath(row.file_path)
    sendFileResolved(res, abs, row.file_name, false)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

documentsRouter.get('/:id/preview', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'documents.view')) return
    const row = stationDocumentService.getStationDocument(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Dokument nicht gefunden', 404)
    if (!stationDocumentService.canAccessDocumentRow(row, stationId!))
      return jsonErr(res, 'Kein Zugriff auf dieses Dokument', 403)
    const abs = stationDocumentService.resolveDocumentAbsolutePath(row.file_path)
    sendFileResolved(res, abs, row.file_name, true)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

documentsRouter.get('/:id', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'documents.view')) return
    const row = stationDocumentService.getStationDocument(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Dokument nicht gefunden', 404)
    if (!stationDocumentService.canAccessDocumentRow(row, stationId!))
      return jsonErr(res, 'Kein Zugriff auf dieses Dokument', 403)
    const linked = stationDocumentService.listLinkedEmployeeIds(getDb(), row.id)
    jsonOk(res, { document: rowToApi(row, linked) })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

documentsRouter.post('/upload', upload.single('file'), (req, res) => {
  try {
    const stationId = typeof req.body.stationId === 'string' ? req.body.stationId.trim() : ''
    if (!requirePermission(req, res, stationId, 'documents.upload')) return
    const file = req.file
    if (!file?.buffer) return jsonErr(res, 'Datei fehlt', 400)
    const title = String(req.body.title ?? '').trim()
    if (!title) return jsonErr(res, 'Titel erforderlich', 400)
    const documentType = String(req.body.documentType ?? 'other').trim() || 'other'
    const category = String(req.body.category ?? '').trim() || null
    const description = String(req.body.description ?? '').trim() || null
    const globalDocument = req.body.globalDocument === '1' || req.body.globalDocument === 'true'
    const isTemplate = req.body.isTemplate === '1' || req.body.isTemplate === 'true'
    const active = !(req.body.active === '0' || req.body.active === 'false')
    const ctx = getAccess(req)
    const safe = safeBaseName(file.originalname || 'upload')
    const docId = randomUUID()
    const rel = stationDocumentService.relativePathForNewDocument(stationId, docId, safe)
    stationDocumentService.writeDocumentBufferToDisk(rel, file.buffer)
    const row = stationDocumentService.insertStationDocument(getDb(), {
      id: docId,
      stationId,
      globalDocument,
      title,
      description,
      category,
      documentType,
      fileName: safe,
      relativePath: rel,
      mimeType: file.mimetype,
      fileSize: file.size,
      isTemplate,
      active,
      createdBy: ctx?.userId ?? null,
    })
    const linked = stationDocumentService.listLinkedEmployeeIds(getDb(), row.id)
    jsonOk(res, { document: rowToApi(row, linked) }, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

documentsRouter.put('/:id', upload.single('file'), (req, res) => {
  try {
    const stationId = typeof req.body.stationId === 'string' ? req.body.stationId.trim() : undefined
    if (!stationId) return jsonErr(res, 'stationId erforderlich', 400)
    if (!requirePermission(req, res, stationId, 'documents.edit')) return
    const db = getDb()
    const row = stationDocumentService.getStationDocument(db, req.params.id)
    if (!row) return jsonErr(res, 'Dokument nicht gefunden', 404)
    if (!stationDocumentService.canAccessDocumentRow(row, stationId))
      return jsonErr(res, 'Kein Zugriff auf dieses Dokument', 403)

    const patch: Parameters<typeof stationDocumentService.updateStationDocumentMeta>[2] = {}
    if (typeof req.body.title === 'string') patch.title = req.body.title
    if (typeof req.body.description === 'string') patch.description = req.body.description.trim() || null
    if (typeof req.body.category === 'string') patch.category = req.body.category.trim() || null
    if (typeof req.body.documentType === 'string') patch.documentType = req.body.documentType
    if (req.body.globalDocument === '1' || req.body.globalDocument === 'true') patch.globalDocument = true
    if (req.body.globalDocument === '0' || req.body.globalDocument === 'false') patch.globalDocument = false
    if (req.body.active === '1' || req.body.active === 'true') patch.active = true
    if (req.body.active === '0' || req.body.active === 'false') patch.active = false
    if (req.body.isTemplate === '1' || req.body.isTemplate === 'true') patch.isTemplate = true
    if (req.body.isTemplate === '0' || req.body.isTemplate === 'false') patch.isTemplate = false

    let next = stationDocumentService.updateStationDocumentMeta(db, req.params.id, patch)
    if (!next) return jsonErr(res, 'Update fehlgeschlagen', 500)

    if (req.file?.buffer) {
      const safe = safeBaseName(req.file.originalname || next.file_name)
      const rel = stationDocumentService.relativePathForNewDocument(next.station_id, next.id, safe)
      stationDocumentService.writeDocumentBufferToDisk(rel, req.file.buffer)
      next = stationDocumentService.replaceStationDocumentFile(db, next.id, {
        fileName: safe,
        relativePath: rel,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      })
    }

    const linked = stationDocumentService.listLinkedEmployeeIds(db, next!.id)
    jsonOk(res, { document: rowToApi(next!, linked) })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

documentsRouter.post('/:id/archive', (req, res) => {
  try {
    const stationId =
      (typeof req.query.stationId === 'string' ? req.query.stationId : undefined) ||
      (typeof req.body.stationId === 'string' ? req.body.stationId.trim() : undefined)
    if (!requirePermission(req, res, stationId, 'documents.archive')) return
    const db = getDb()
    const row = stationDocumentService.getStationDocument(db, req.params.id)
    if (!row) return jsonErr(res, 'Dokument nicht gefunden', 404)
    if (!stationDocumentService.canAccessDocumentRow(row, stationId!))
      return jsonErr(res, 'Kein Zugriff', 403)
    const next = stationDocumentService.archiveStationDocument(db, req.params.id)
    const linked = stationDocumentService.listLinkedEmployeeIds(db, next!.id)
    jsonOk(res, { document: rowToApi(next!, linked) })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

documentsRouter.delete('/:id', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'documents.archive')) return
    const db = getDb()
    const row = stationDocumentService.getStationDocument(db, req.params.id)
    if (!row) return jsonErr(res, 'Dokument nicht gefunden', 404)
    if (!stationDocumentService.canAccessDocumentRow(row, stationId!))
      return jsonErr(res, 'Kein Zugriff', 403)
    const next = stationDocumentService.archiveStationDocument(db, req.params.id)
    const linked = stationDocumentService.listLinkedEmployeeIds(db, next!.id)
    jsonOk(res, { document: rowToApi(next!, linked) })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

documentsRouter.post('/:id/link-employee', (req, res) => {
  try {
    const stationId = typeof req.body.stationId === 'string' ? req.body.stationId.trim() : undefined
    if (!requirePermission(req, res, stationId, 'documents.edit')) return
    const employeeId = typeof req.body.employeeId === 'string' ? req.body.employeeId.trim() : ''
    if (!employeeId) return jsonErr(res, 'employeeId erforderlich', 400)
    const db = getDb()
    const row = stationDocumentService.getStationDocument(db, req.params.id)
    if (!row) return jsonErr(res, 'Dokument nicht gefunden', 404)
    if (!stationDocumentService.canAccessDocumentRow(row, stationId!))
      return jsonErr(res, 'Kein Zugriff', 403)
    const emp = employeeService.getEmployeeRowInternal(db, employeeId)
    if (!emp || emp.station_id !== stationId) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    stationDocumentService.linkDocumentToEmployee(db, req.params.id, employeeId)
    const linked = stationDocumentService.listLinkedEmployeeIds(db, req.params.id)
    jsonOk(res, { ok: true, linkedEmployeeIds: linked })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

documentsRouter.delete('/:id/link-employee/:employeeId', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'documents.edit')) return
    const db = getDb()
    const row = stationDocumentService.getStationDocument(db, req.params.id)
    if (!row) return jsonErr(res, 'Dokument nicht gefunden', 404)
    if (!stationDocumentService.canAccessDocumentRow(row, stationId!))
      return jsonErr(res, 'Kein Zugriff', 403)
    stationDocumentService.unlinkDocumentFromEmployee(db, req.params.id, req.params.employeeId)
    const linked = stationDocumentService.listLinkedEmployeeIds(db, req.params.id)
    jsonOk(res, { ok: true, linkedEmployeeIds: linked })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

documentsRouter.post('/:id/create-employee-from-form', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireStationId(req, res, stationId)) return
    const ctx = getAccess(req)!
    if (!ctx.globalAdmin) {
      if (!requirePermission(req, res, stationId, 'employees.create')) return
      if (!requirePermission(req, res, stationId, 'documents.create_employee_from_document')) return
    }
    const db = getDb()
    const doc = stationDocumentService.getStationDocument(db, req.params.id)
    if (!doc) return jsonErr(res, 'Dokument nicht gefunden', 404)
    if (!stationDocumentService.canAccessDocumentRow(doc, stationId!))
      return jsonErr(res, 'Kein Zugriff', 403)
    if (doc.document_type !== 'personal_form')
      return jsonErr(res, 'Nur für Dokumenttyp „Personalbogen“', 400)

    const body = (req.body ?? {}) as Record<string, unknown>
    const sens =
      ctx.globalAdmin ||
      Boolean(
        ctx.stationIds.includes(stationId!) &&
          (ctx.permissionsByStation.get(stationId!)?.['employees.viewSensitive'] ||
            ctx.permissionsByStation.get(stationId!)?.['employees.manageSensitive']),
      )
    const created = employeeService.createEmployee(db, body, stationId!, { allowSensitive: sens })
    if (!created || !(created as { id?: string }).id) return jsonErr(res, 'Mitarbeiter konnte nicht angelegt werden', 500)
    const newId = String((created as { id: string }).id)
    stationDocumentService.linkDocumentToEmployee(db, doc.id, newId)
    jsonOk(res, { employee: created, documentId: doc.id }, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
