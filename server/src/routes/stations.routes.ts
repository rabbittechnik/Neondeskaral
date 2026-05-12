import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as stationService from '../services/stationService.js'
import { listAccessibleStationRows, listAllActiveStationRows } from '../services/stationAccessService.js'
import { requireGlobalAdmin } from '../middleware/stationAuth.js'

export const stationsRouter = Router()

stationsRouter.get('/', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx) return jsonErr(res, 'Intern', 500)
    const rows = ctx.globalAdmin ? listAllActiveStationRows(getDb()) : listAccessibleStationRows(getDb(), ctx)
    jsonOk(res, rows)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationsRouter.get('/:id', (req, res) => {
  try {
    const ctx = req.accessContext
    if (!ctx) return jsonErr(res, 'Intern', 500)
    if (!ctx.globalAdmin && !ctx.stationIds.includes(req.params.id)) {
      return jsonErr(res, 'Kein Zugriff auf diese Station', 403)
    }
    const row = stationService.getStation(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Station nicht gefunden', 404)
    jsonOk(res, row)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationsRouter.post('/', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    jsonOk(res, stationService.createStation(getDb(), req.body ?? {}), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationsRouter.put('/:id', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    jsonOk(res, stationService.updateStation(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationsRouter.delete('/:id', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    stationService.deleteStation(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
