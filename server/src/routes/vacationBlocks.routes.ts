import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission } from '../middleware/stationAuth.js'
import * as vacationBlockService from '../services/vacationBlockService.js'

function vbStationId(db: ReturnType<typeof getDb>, id: string): string | undefined {
  const r = db.prepare(`SELECT station_id FROM vacation_blocks WHERE id = ?`).get(id) as { station_id: string } | undefined
  return r?.station_id
}

export const vacationBlocksRouter = Router()

vacationBlocksRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'absences.view')) return
    const includeInactive = String(req.query.includeInactive ?? '') === 'true'
    jsonOk(res, vacationBlockService.listVacationBlocks(getDb(), stationId!, includeInactive))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

vacationBlocksRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'absences.create')) return
    jsonOk(res, vacationBlockService.createVacationBlock(getDb(), req.body ?? {}, stationId!), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

vacationBlocksRouter.put('/:id', (req, res) => {
  try {
    const sid = vbStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Block nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'absences.create')) return
    jsonOk(res, vacationBlockService.updateVacationBlock(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

vacationBlocksRouter.delete('/:id', (req, res) => {
  try {
    const sid = vbStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Block nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'absences.create')) return
    vacationBlockService.deleteVacationBlock(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
