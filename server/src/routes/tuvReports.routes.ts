import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission, requireGlobalAdmin, getAccess, requireStationId } from '../middleware/stationAuth.js'
import { hasPermission } from '../services/stationAccessService.js'
import * as tuvReportService from '../services/tuvReportService.js'

export const tuvReportsRouter = Router()

function actorName(req: import('express').Request): string {
  const j = req.adminUser
  return String((j as { displayName?: string } | undefined)?.displayName ?? j?.username ?? j?.sub ?? 'Benutzer')
}

tuvReportsRouter.get('/check-current-month', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireStationId(req, res, stationId)) return
    const ctx = getAccess(req)!
    const can =
      hasPermission(ctx, stationId!, 'tuvReports.view') || hasPermission(ctx, stationId!, 'tuvReports.create')
    if (!can) return res.status(403).json({ ok: false, error: 'Keine Berechtigung' })
    const out = tuvReportService.checkCurrentMonth(getDb(), stationId!)
    jsonOk(res, out)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tuvReportsRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'tuvReports.view')) return
    const year = req.query.year != null ? Number(req.query.year) : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    jsonOk(
      res,
      tuvReportService.listTuvReports(getDb(), {
        stationId: stationId!,
        year: Number.isFinite(year) ? year : undefined,
        status: status && status !== 'all' ? status : undefined,
      }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tuvReportsRouter.get('/:id', (req, res) => {
  try {
    const detail = tuvReportService.getTuvReportWithItems(getDb(), req.params.id)
    if (!detail) return jsonErr(res, 'Bericht nicht gefunden', 404)
    if (!requirePermission(req, res, detail.report.stationId, 'tuvReports.view')) return
    jsonOk(res, detail)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tuvReportsRouter.post('/open-month', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'tuvReports.create')) return
    const b = (req.body ?? {}) as Record<string, unknown>
    const month = Number(b.month ?? new Date().getMonth() + 1)
    const year = Number(b.year ?? new Date().getFullYear())
    if (!Number.isFinite(month) || month < 1 || month > 12) return jsonErr(res, 'Monat ungültig', 400)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return jsonErr(res, 'Jahr ungültig', 400)
    const { report, created } = tuvReportService.getOrOpenTuvReportForMonth(getDb(), {
      stationId: stationId!,
      month,
      year,
      reportDate: String(b.reportDate ?? new Date().toISOString().slice(0, 10)).trim(),
      createdBy: req.adminUser!.sub,
      createdByName: actorName(req),
      inspectorRole: b.inspectorRole != null ? String(b.inspectorRole) : undefined,
      weatherNote: b.weatherNote != null ? String(b.weatherNote) : undefined,
      generalNote: b.generalNote != null ? String(b.generalNote) : undefined,
    })
    jsonOk(res, { ...report, created }, created ? 201 : 200)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

tuvReportsRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'tuvReports.create')) return
    const b = (req.body ?? {}) as Record<string, unknown>
    const month = Number(b.month)
    const year = Number(b.year)
    if (!Number.isFinite(month) || month < 1 || month > 12) return jsonErr(res, 'Monat ungültig', 400)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return jsonErr(res, 'Jahr ungültig', 400)
    const out = tuvReportService.createTuvReport(getDb(), {
      stationId: stationId!,
      month,
      year,
      reportDate: String(b.reportDate ?? '').trim(),
      createdBy: req.adminUser!.sub,
      createdByName: actorName(req),
      inspectorRole: b.inspectorRole != null ? String(b.inspectorRole) : undefined,
      weatherNote: b.weatherNote != null ? String(b.weatherNote) : undefined,
      generalNote: b.generalNote != null ? String(b.generalNote) : undefined,
    })
    jsonOk(res, out, 201)
  } catch (e) {
    const err = e as Error & { code?: string; existingId?: string }
    if (err.code === 'DUPLICATE_TUV_REPORT') {
      return res.status(409).json({
        ok: false,
        error: 'Für diesen Monat existiert bereits ein TÜV-Bericht.',
        existingId: err.existingId,
      })
    }
    jsonErr(res, err.message ?? 'Fehler', 400)
  }
})

tuvReportsRouter.put('/:id', (req, res) => {
  try {
    const detail = tuvReportService.getTuvReportWithItems(getDb(), req.params.id)
    if (!detail) return jsonErr(res, 'Bericht nicht gefunden', 404)
    const sid = detail.report.stationId
    const completedLike = detail.report.status === 'completed' || detail.report.status === 'printed'
    if (completedLike) {
      if (!requirePermission(req, res, sid, 'tuvReports.manage')) return
      jsonOk(
        res,
        tuvReportService.updateTuvReport(getDb(), req.params.id, req.body ?? {}, {
          allowWhenCompleted: true,
          auditUserId: req.adminUser!.sub,
          auditUserName: actorName(req),
        }),
      )
      return
    }
    if (!requirePermission(req, res, sid, 'tuvReports.edit')) return
    jsonOk(res, tuvReportService.updateTuvReport(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

tuvReportsRouter.post('/:id/confirm', (req, res) => {
  try {
    const detail = tuvReportService.getTuvReportWithItems(getDb(), req.params.id)
    if (!detail) return jsonErr(res, 'Bericht nicht gefunden', 404)
    if (!requirePermission(req, res, detail.report.stationId, 'tuvReports.sign')) return
    const b = (req.body ?? {}) as { signatureDataUrl?: string; confirmationText?: string }
    jsonOk(
      res,
      tuvReportService.confirmTuvReport(getDb(), req.params.id, {
        signatureDataUrl: b.signatureDataUrl,
        confirmationText: b.confirmationText,
        confirmedBy: req.adminUser!.sub,
        confirmedByName: actorName(req),
      }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

tuvReportsRouter.post('/:id/complete', (req, res) => {
  try {
    const detail = tuvReportService.getTuvReportWithItems(getDb(), req.params.id)
    if (!detail) return jsonErr(res, 'Bericht nicht gefunden', 404)
    if (!requirePermission(req, res, detail.report.stationId, 'tuvReports.complete')) return
    jsonOk(res, tuvReportService.completeTuvReport(getDb(), req.params.id, req.adminUser!.sub, actorName(req)))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

tuvReportsRouter.post('/:id/mark-printed', (req, res) => {
  try {
    const detail = tuvReportService.getTuvReportWithItems(getDb(), req.params.id)
    if (!detail) return jsonErr(res, 'Bericht nicht gefunden', 404)
    if (!requirePermission(req, res, detail.report.stationId, 'tuvReports.print')) return
    jsonOk(res, tuvReportService.markTuvReportPrinted(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

tuvReportsRouter.delete('/:id', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    const detail = tuvReportService.getTuvReportWithItems(getDb(), req.params.id)
    if (!detail) return jsonErr(res, 'Bericht nicht gefunden', 404)
    tuvReportService.deleteTuvReport(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
