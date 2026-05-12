import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission } from '../middleware/stationAuth.js'
import * as workAreaService from '../services/workAreaService.js'

export const workAreasRouter = Router()

workAreasRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    jsonOk(res, workAreaService.listWorkAreas(getDb(), stationId!))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

workAreasRouter.get('/:id', (req, res) => {
  try {
    const sid = workAreaService.getWorkAreaStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Arbeitsbereich nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'settings.view')) return
    const w = workAreaService.getWorkArea(getDb(), req.params.id)
    if (!w) return jsonErr(res, 'Arbeitsbereich nicht gefunden', 404)
    jsonOk(res, w)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

workAreasRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    jsonOk(res, workAreaService.createWorkArea(getDb(), req.body ?? {}, stationId!), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

workAreasRouter.put('/:id', (req, res) => {
  try {
    const sid = workAreaService.getWorkAreaStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Arbeitsbereich nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'settings.edit')) return
    jsonOk(res, workAreaService.updateWorkArea(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

workAreasRouter.delete('/:id', (req, res) => {
  try {
    const sid = workAreaService.getWorkAreaStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Arbeitsbereich nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'settings.edit')) return
    workAreaService.deleteWorkArea(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
