import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as stationService from '../services/stationService.js'
import {
  ensureStationShiftCloseChecklistDefsSeeded,
  listShiftCloseChecklistDefsForAdmin,
  type StationShiftChecklistDefRow,
} from '../services/stationShiftChecklistDefService.js'
import type { ShiftCloseChecklistKind } from '../constants/shiftCloseChecklistCatalog.js'
import {
  listAccessibleStationRows,
  listAllActiveStationRows,
  canAccessStationsAdminUi,
  hasAnyStationPermission,
  hasPermission,
} from '../services/stationAccessService.js'
import type { AccessContext } from '../services/stationAccessService.js'

export const stationsRouter = Router()

function seesFullStationDirectory(ctx: AccessContext): boolean {
  return ctx.globalAdmin || hasAnyStationPermission(ctx, 'stations.manage')
}

function canMutateStationDirectory(ctx: AccessContext): boolean {
  return seesFullStationDirectory(ctx)
}

function canReadStation(ctx: AccessContext, stationId: string): boolean {
  if (seesFullStationDirectory(ctx)) return true
  return hasPermission(ctx, stationId, 'station.profile.edit')
}

function canEditStation(ctx: AccessContext, stationId: string): boolean {
  if (seesFullStationDirectory(ctx)) return true
  return hasPermission(ctx, stationId, 'station.profile.edit')
}

stationsRouter.get('/', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx || !canAccessStationsAdminUi(ctx)) return jsonErr(res, 'Keine Berechtigung', 403)
    const db = getDb()
    const includeArchived =
      String(req.query.includeArchived ?? '') === 'true' && seesFullStationDirectory(ctx)
    const includeCounts = String(req.query.includeCounts ?? '') === 'true'
    let rows: Record<string, unknown>[]
    if (seesFullStationDirectory(ctx)) {
      rows = listAllActiveStationRows(db, { includeArchived })
    } else {
      rows = listAccessibleStationRows(db, ctx, { forDropdown: false })
    }
    if (includeCounts) {
      rows = rows.map((r) => {
        const id = String(r.id ?? '')
        const s = stationService.getStationSummary(db, id)
        return {
          ...r,
          employeeCount: s.employeeCount,
          openShiftsCount: s.openShiftsCount,
          hasHistoricalData: s.hasHistoricalData,
        }
      })
    }
    jsonOk(res, rows)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

function shiftCloseChecklistDefRowToApi(r: StationShiftChecklistDefRow) {
  return {
    id: r.id,
    stationId: r.station_id,
    checklistType: r.checklist_type,
    itemKey: r.item_key,
    label: r.label,
    sortOrder: r.sort_order,
    answerMode: r.answer_mode,
    groupId: r.group_id,
    groupLabel: r.group_label,
    active: r.active == null ? true : Boolean(r.active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

stationsRouter.get('/:id/shift-close-checklist-defs', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx || !canAccessStationsAdminUi(ctx)) return jsonErr(res, 'Keine Berechtigung', 403)
    const id = req.params.id
    if (!canReadStation(ctx, id)) return jsonErr(res, 'Kein Zugriff auf diese Station', 403)
    const db = getDb()
    const row = stationService.getStation(db, id)
    if (!row) return jsonErr(res, 'Station nicht gefunden', 404)
    const kindRaw = String(req.query.kind ?? '').trim().toLowerCase()
    const kind: ShiftCloseChecklistKind | undefined =
      kindRaw === 'closing' || kindRaw === 'handover' ? kindRaw : undefined
    ensureStationShiftCloseChecklistDefsSeeded(db, id)
    const defs = listShiftCloseChecklistDefsForAdmin(db, id, kind).map(shiftCloseChecklistDefRowToApi)
    jsonOk(res, { defs })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationsRouter.get('/:id/summary', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx || !canAccessStationsAdminUi(ctx)) return jsonErr(res, 'Keine Berechtigung', 403)
    const id = req.params.id
    if (!canReadStation(ctx, id)) return jsonErr(res, 'Kein Zugriff auf diese Station', 403)
    const row = stationService.getStation(getDb(), id)
    if (!row) return jsonErr(res, 'Station nicht gefunden', 404)
    jsonOk(res, stationService.getStationSummary(getDb(), id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationsRouter.get('/:id', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx || !canAccessStationsAdminUi(ctx)) return jsonErr(res, 'Keine Berechtigung', 403)
    if (!canReadStation(ctx, req.params.id)) return jsonErr(res, 'Kein Zugriff auf diese Station', 403)
    const row = stationService.getStation(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Station nicht gefunden', 404)
    jsonOk(res, row)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationsRouter.post('/', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx || !canMutateStationDirectory(ctx)) return jsonErr(res, 'Keine Berechtigung', 403)
    jsonOk(res, stationService.createStation(getDb(), req.body ?? {}), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationsRouter.put('/:id', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx || !canAccessStationsAdminUi(ctx)) return jsonErr(res, 'Keine Berechtigung', 403)
    const id = req.params.id
    if (!canEditStation(ctx, id)) return jsonErr(res, 'Keine Berechtigung', 403)
    const body = { ...(req.body as Record<string, unknown>) }
    if (!canMutateStationDirectory(ctx)) {
      delete body.active
    }
    jsonOk(res, stationService.updateStation(getDb(), id, body))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationsRouter.post('/:id/archive', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx || !canMutateStationDirectory(ctx)) return jsonErr(res, 'Keine Berechtigung', 403)
    stationService.archiveStation(getDb(), req.params.id)
    jsonOk(res, { archived: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationsRouter.post('/:id/restore', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx || !canMutateStationDirectory(ctx)) return jsonErr(res, 'Keine Berechtigung', 403)
    stationService.restoreStation(getDb(), req.params.id)
    jsonOk(res, { restored: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationsRouter.delete('/:id', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx || !canMutateStationDirectory(ctx)) return jsonErr(res, 'Keine Berechtigung', 403)
    const out = stationService.deleteStationSmart(getDb(), req.params.id)
    jsonOk(res, out)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
