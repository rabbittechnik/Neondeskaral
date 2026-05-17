import type { Request } from 'express'
import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requireAnyPermission, requirePermission } from '../middleware/stationAuth.js'
import { hasPermission } from '../services/stationAccessService.js'
import * as representativeService from '../services/representativeService.js'

export const representativesRouter = Router()

function canViewRepresentatives(req: Request, stationId: string): boolean {
  const ctx = req.accessContext
  if (!ctx) return false
  if (ctx.globalAdmin) return true
  return (
    hasPermission(ctx, stationId, 'representatives.view') || hasPermission(ctx, stationId, 'representatives.edit')
  )
}

representativesRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireAnyPermission(req, res, stationId, ['representatives.view', 'representatives.edit'])) return
    const includeArchived =
      req.query.includeArchived === '1' || String(req.query.includeArchived).toLowerCase() === 'true'
    const sort = req.query.sort === 'name' ? 'name' : 'company'
    const categoryFilter = typeof req.query.category === 'string' ? req.query.category : undefined
    const favoritesOnly =
      req.query.favoritesOnly === '1' || String(req.query.favoritesOnly).toLowerCase() === 'true'
    const rows = representativeService.listRepresentatives(getDb(), stationId!, {
      includeArchived,
      sort,
      categoryFilter,
      favoritesOnly,
    })
    jsonOk(res, rows)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

representativesRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'representatives.edit')) return
    const uid = req.adminUser?.sub
    if (!uid) return jsonErr(res, 'Nicht angemeldet', 401)
    const row = representativeService.createRepresentative(
      getDb(),
      stationId!,
      (req.body ?? {}) as Record<string, unknown>,
      uid,
    )
    jsonOk(res, row, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

representativesRouter.post('/:id/archive', (req, res) => {
  try {
    const sid = representativeService.getRepresentativeStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Vertreter nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'representatives.edit')) return
    jsonOk(res, representativeService.archiveRepresentative(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

representativesRouter.post('/:id/restore', (req, res) => {
  try {
    const sid = representativeService.getRepresentativeStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Vertreter nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'representatives.edit')) return
    jsonOk(res, representativeService.restoreRepresentative(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

representativesRouter.get('/:id', (req, res) => {
  try {
    const row = representativeService.getRepresentative(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Vertreter nicht gefunden', 404)
    if (!canViewRepresentatives(req, row.stationId)) {
      return jsonErr(res, 'Keine Berechtigung', 403)
    }
    jsonOk(res, row)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

representativesRouter.put('/:id', (req, res) => {
  try {
    const sid = representativeService.getRepresentativeStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Vertreter nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'representatives.edit')) return
    jsonOk(
      res,
      representativeService.updateRepresentative(getDb(), req.params.id, (req.body ?? {}) as Record<string, unknown>),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

representativesRouter.delete('/:id', (req, res) => {
  try {
    const sid = representativeService.getRepresentativeStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Vertreter nicht gefunden', 404)
    const permanent =
      req.query.permanent === '1' || String(req.query.permanent).toLowerCase() === 'true'
    if (permanent) {
      if (!requirePermission(req, res, sid, 'representatives.delete')) return
      representativeService.deleteRepresentativePermanent(getDb(), req.params.id)
      jsonOk(res, { deleted: true })
      return
    }
    if (!requirePermission(req, res, sid, 'representatives.edit')) return
    jsonOk(res, representativeService.archiveRepresentative(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
