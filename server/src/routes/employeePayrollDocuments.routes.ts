import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { getAccess, requirePermission } from '../middleware/stationAuth.js'
import { hasPermission } from '../services/stationAccessService.js'
import * as payrollDocService from '../services/employeePayrollDocumentService.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf'
    if (ok) cb(null, true)
    else cb(new Error('Nur PDF-Dateien sind erlaubt.'))
  },
})

export const employeePayrollDocumentsRouter = Router({ mergeParams: true })

function paramEmployeeId(req: import('express').Request): string {
  return typeof req.params.employeeId === 'string' ? req.params.employeeId.trim() : ''
}

function canViewPayrollDocuments(req: import('express').Request, stationId: string): boolean {
  const ctx = getAccess(req)
  if (!ctx) return false
  if (ctx.globalAdmin) return true
  return (
    hasPermission(ctx, stationId, 'employeePayrollDocuments.view') ||
    hasPermission(ctx, stationId, 'employeePayrollDocuments.manage') ||
    hasPermission(ctx, stationId, 'payroll.view') ||
    hasPermission(ctx, stationId, 'employees.manageSensitive')
  )
}

function canManagePayrollDocuments(req: import('express').Request, stationId: string): boolean {
  const ctx = getAccess(req)
  if (!ctx) return false
  if (ctx.globalAdmin) return true
  return (
    hasPermission(ctx, stationId, 'employeePayrollDocuments.manage') ||
    hasPermission(ctx, stationId, 'employees.manageSensitive')
  )
}

function sendPdf(res: import('express').Response, absPath: string, downloadName: string, inline: boolean) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
  )
  res.sendFile(absPath, (err) => {
    if (err && !res.headersSent) res.status(500).json({ ok: false, error: 'Dateiauslieferung fehlgeschlagen' })
  })
}

employeePayrollDocumentsRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    const employeeId = paramEmployeeId(req)
    if (!stationId || !employeeId) return jsonErr(res, 'stationId erforderlich', 400)
    if (!requirePermission(req, res, stationId, 'employees.view')) return
    if (!canViewPayrollDocuments(req, stationId)) return jsonErr(res, 'Keine Berechtigung für Lohnabrechnungen', 403)

    const items = payrollDocService.listEmployeePayrollDocuments(getDb(), stationId, employeeId)
    jsonOk(res, { documents: items })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', e instanceof Error && e.message.includes('nicht gefunden') ? 404 : 500)
  }
})

employeePayrollDocumentsRouter.post('/', upload.single('file'), (req, res) => {
  try {
    const stationId = typeof req.body?.stationId === 'string' ? req.body.stationId : typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    const employeeId = paramEmployeeId(req)
    if (!stationId || !employeeId) return jsonErr(res, 'stationId erforderlich', 400)
    if (!requirePermission(req, res, stationId, 'employees.view')) return
    if (!canManagePayrollDocuments(req, stationId)) return jsonErr(res, 'Keine Berechtigung zum Hochladen', 403)

    const file = req.file
    if (!file?.buffer?.length) return jsonErr(res, 'PDF-Datei erforderlich', 400)

    const year = Number(req.body?.year)
    const month = Number(req.body?.month)
    if (!Number.isFinite(year) || !Number.isFinite(month)) return jsonErr(res, 'Jahr und Monat erforderlich', 400)

    const ctx = getAccess(req)
    const doc = payrollDocService.createEmployeePayrollDocument(getDb(), {
      stationId,
      employeeId,
      year: Math.floor(year),
      month: Math.floor(month),
      note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      uploadedByUserId: ctx?.userId ?? null,
      originalFilename: file.originalname,
      buffer: file.buffer,
    })
    jsonOk(res, { document: doc }, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeePayrollDocumentsRouter.get('/:documentId/download', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    const employeeId = paramEmployeeId(req)
    const documentId = req.params.documentId
    if (!stationId || !employeeId) return jsonErr(res, 'stationId erforderlich', 400)
    if (!requirePermission(req, res, stationId, 'employees.view')) return
    if (!canViewPayrollDocuments(req, stationId)) return jsonErr(res, 'Keine Berechtigung', 403)

    const row = payrollDocService.getEmployeePayrollDocumentForAccess(getDb(), documentId, {
      stationId,
      employeeId,
    })
    const abs = payrollDocService.resolvePayrollDocumentAbsolutePath(row.file_path)
    const inline = req.query.inline === '1' || req.query.inline === 'true'
    sendPdf(res, abs, row.original_filename || 'lohnabrechnung.pdf', inline)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fehler'
    jsonErr(res, msg, msg.includes('Berechtigung') ? 403 : msg.includes('nicht gefunden') ? 404 : 500)
  }
})

employeePayrollDocumentsRouter.put('/:documentId', upload.single('file'), (req, res) => {
  try {
    const stationId = typeof req.body?.stationId === 'string' ? req.body.stationId : typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    const employeeId = paramEmployeeId(req)
    const documentId = req.params.documentId
    if (!stationId || !employeeId) return jsonErr(res, 'stationId erforderlich', 400)
    if (!canManagePayrollDocuments(req, stationId)) return jsonErr(res, 'Keine Berechtigung', 403)

    const file = req.file
    if (!file?.buffer?.length) return jsonErr(res, 'PDF-Datei erforderlich', 400)

    const ctx = getAccess(req)
    const year = req.body?.year != null ? Number(req.body.year) : undefined
    const month = req.body?.month != null ? Number(req.body.month) : undefined

    const doc = payrollDocService.replaceEmployeePayrollDocument(getDb(), documentId, {
      stationId,
      employeeId,
      uploadedByUserId: ctx?.userId ?? null,
      originalFilename: file.originalname,
      buffer: file.buffer,
      year: Number.isFinite(year) ? Math.floor(year!) : undefined,
      month: Number.isFinite(month) ? Math.floor(month!) : undefined,
      note: typeof req.body?.note === 'string' ? req.body.note : undefined,
    })
    jsonOk(res, { document: doc })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeePayrollDocumentsRouter.delete('/:documentId', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    const employeeId = paramEmployeeId(req)
    const documentId = req.params.documentId
    if (!stationId || !employeeId) return jsonErr(res, 'stationId erforderlich', 400)
    if (!canManagePayrollDocuments(req, stationId)) return jsonErr(res, 'Keine Berechtigung', 403)

    payrollDocService.softDeleteEmployeePayrollDocument(getDb(), documentId, stationId, employeeId)
    jsonOk(res, { deleted: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fehler'
    jsonErr(res, msg, msg.includes('Berechtigung') ? 403 : msg.includes('nicht gefunden') ? 404 : 500)
  }
})

/** Hilfsroute: Mitarbeiter-Anzeigename für Upload-Dialog */
employeePayrollDocumentsRouter.get('/meta/employee-display', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    const employeeId = paramEmployeeId(req)
    if (!stationId) return jsonErr(res, 'stationId erforderlich', 400)
    if (!requirePermission(req, res, stationId, 'employees.view')) return
    const row = getDb()
      .prepare(`SELECT station_id, display_name FROM employees WHERE id = ?`)
      .get(employeeId) as { station_id: string; display_name: string } | undefined
    if (!row || row.station_id !== stationId) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    jsonOk(res, { displayName: row.display_name })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})
