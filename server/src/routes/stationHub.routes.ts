import { Router } from 'express'
import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission } from '../middleware/stationAuth.js'
import * as hub from '../services/stationHubService.js'

export const stationHubRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

function sid(req: { query: unknown }): string | undefined {
  const q = req.query as { stationId?: string }
  return typeof q.stationId === 'string' ? q.stationId : undefined
}

stationHubRouter.get('/announcements', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    const q = typeof (req.query as { q?: string }).q === 'string' ? (req.query as { q: string }).q : undefined
    const includeArchived = String((req.query as { includeArchived?: string }).includeArchived ?? '') === 'true'
    jsonOk(res, hub.listAnnouncements(getDb(), stationId!, q, includeArchived))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.post('/announcements', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, hub.upsertAnnouncement(getDb(), stationId!, req.body ?? {}, req.adminUser?.sub), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.post('/announcements/:id/archive', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    hub.archiveAnnouncement(getDb(), stationId!, req.params.id)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.get('/chat-groups', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    const q = typeof (req.query as { q?: string }).q === 'string' ? (req.query as { q: string }).q : undefined
    const includeArchived = String((req.query as { includeArchived?: string }).includeArchived ?? '') === 'true'
    jsonOk(res, hub.listChatGroups(getDb(), stationId!, q, includeArchived))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.get('/chat-groups/:id/members', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    jsonOk(res, hub.listChatGroupMembers(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.post('/chat-groups', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, hub.upsertChatGroup(getDb(), stationId!, req.body ?? {}, req.adminUser?.sub), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.post('/chat-groups/:id/archive', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    hub.archiveChatGroup(getDb(), stationId!, req.params.id)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.get('/lists', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    const q = typeof (req.query as { q?: string }).q === 'string' ? (req.query as { q: string }).q : undefined
    const category = typeof (req.query as { category?: string }).category === 'string' ? (req.query as { category: string }).category : undefined
    const includeArchived = String((req.query as { includeArchived?: string }).includeArchived ?? '') === 'true'
    jsonOk(res, hub.listOrgLists(getDb(), stationId!, category, q, includeArchived))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.get('/lists/:listId/items', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    jsonOk(res, hub.listOrgListItems(getDb(), req.params.listId))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.post('/lists', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, hub.upsertOrgList(getDb(), stationId!, req.body ?? {}, req.adminUser?.sub), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.post('/lists/:listId/items', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, hub.upsertOrgListItem(getDb(), req.params.listId, req.body ?? {}), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.get('/calendar-events', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    const from = typeof (req.query as { from?: string }).from === 'string' ? (req.query as { from: string }).from : undefined
    const to = typeof (req.query as { to?: string }).to === 'string' ? (req.query as { to: string }).to : undefined
    const category = typeof (req.query as { category?: string }).category === 'string' ? (req.query as { category: string }).category : undefined
    jsonOk(res, hub.listCalendarEvents(getDb(), stationId!, from, to, category))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.post('/calendar-events', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, hub.upsertCalendarEvent(getDb(), stationId!, req.body ?? {}, req.adminUser?.sub), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.get('/contacts', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    const q = typeof (req.query as { q?: string }).q === 'string' ? (req.query as { q: string }).q : undefined
    const includeArchived = String((req.query as { includeArchived?: string }).includeArchived ?? '') === 'true'
    jsonOk(res, hub.listOrgContacts(getDb(), stationId!, q, includeArchived))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.post('/contacts', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, hub.upsertOrgContact(getDb(), stationId!, req.body ?? {}), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.get('/meters', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    const includeArchived = String((req.query as { includeArchived?: string }).includeArchived ?? '') === 'true'
    jsonOk(res, hub.listMeters(getDb(), stationId!, includeArchived))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.get('/meters/:meterId/readings', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    jsonOk(res, hub.listMeterReadings(getDb(), stationId!, req.params.meterId))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.post('/meters', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, hub.upsertMeter(getDb(), stationId!, req.body ?? {}), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.post('/meters/:meterId/readings', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, hub.addMeterReading(getDb(), stationId!, req.params.meterId, req.body ?? {}, req.adminUser?.sub), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.get('/invoices', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    jsonOk(res, hub.listInvoices(getDb(), stationId!))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.get('/invoices/:id/file', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    const row = getDb()
      .prepare(`SELECT pdf_path, invoice_number FROM account_invoices WHERE id = ? AND station_id = ? AND active = 1`)
      .get(req.params.id, stationId!) as { pdf_path: string | null; invoice_number: string } | undefined
    if (!row?.pdf_path?.trim()) return jsonErr(res, 'Keine PDF-Datei hinterlegt', 404)
    const abs = hub.resolveBillingAbs(row.pdf_path)
    if (!fs.existsSync(abs)) return jsonErr(res, 'Datei nicht gefunden', 404)
    const base = path.basename(abs) || 'rechnung.pdf'
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(base)}`)
    res.sendFile(abs, (err) => {
      if (err && !res.headersSent) res.status(500).json({ ok: false, error: 'Download fehlgeschlagen' })
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.post('/invoices', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, hub.upsertInvoice(getDb(), stationId!, req.body ?? {}), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.get('/billing-documents', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    jsonOk(res, hub.listBillingDocuments(getDb(), stationId!))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationHubRouter.post('/billing-documents/upload', upload.single('file'), (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    const f = req.file
    if (!f?.buffer?.length) return jsonErr(res, 'Datei fehlt', 400)
    const title = String(req.body?.title ?? 'Unterlage').trim() || 'Unterlage'
    const category = req.body?.category != null ? String(req.body.category) : undefined
    const docId = `bd-${Date.now()}`
    const safeName = path.basename(f.originalname || 'upload').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'upload'
    const dir = hub.ensureBillingDir(stationId!, docId)
    const abs = path.join(dir, safeName)
    fs.writeFileSync(abs, f.buffer)
    const rel = path.posix.join('server', 'data', 'station-billing', stationId!, docId, safeName)
    const row = hub.insertBillingDocument(getDb(), stationId!, {
      title,
      category,
      fileName: safeName,
      relPath: rel,
      mime: f.mimetype || 'application/octet-stream',
      size: f.size,
      uid: req.adminUser?.sub,
    })
    jsonOk(res, row, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.get('/billing-documents/:id/file', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    const row = getDb()
      .prepare(`SELECT * FROM account_billing_documents WHERE id = ? AND station_id = ?`)
      .get(req.params.id, stationId!) as { file_path: string; file_name: string; mime_type: string } | undefined
    if (!row) return jsonErr(res, 'Nicht gefunden', 404)
    const abs = hub.resolveBillingAbs(row.file_path)
    if (!fs.existsSync(abs)) return jsonErr(res, 'Datei nicht gefunden', 404)
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`)
    res.sendFile(abs, (err) => {
      if (err && !res.headersSent) res.status(500).json({ ok: false, error: 'Download fehlgeschlagen' })
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationHubRouter.post('/billing-documents/:id/archive', (req, res) => {
  try {
    const stationId = sid(req)
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    hub.archiveBillingDocument(getDb(), stationId!, req.params.id)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
