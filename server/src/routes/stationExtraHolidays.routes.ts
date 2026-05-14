import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission } from '../middleware/stationAuth.js'
import * as extraHolidayService from '../services/stationExtraHolidayService.js'

function rowStationId(db: ReturnType<typeof getDb>, id: string): string | undefined {
  return extraHolidayService.getStationExtraHolidayStationId(db, id)
}

export const stationExtraHolidaysRouter = Router()

stationExtraHolidaysRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'settings.view')) return
    const includeInactive = String(req.query.includeInactive ?? '') === 'true'
    jsonOk(res, extraHolidayService.listStationExtraHolidays(getDb(), stationId!, includeInactive))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationExtraHolidaysRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'settings.edit')) return
    const uid = req.adminUser?.sub
    jsonOk(res, extraHolidayService.createStationExtraHoliday(getDb(), stationId!, req.body ?? {}, uid), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationExtraHolidaysRouter.put('/:id', (req, res) => {
  try {
    const sid = rowStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Eintrag nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'settings.edit')) return
    jsonOk(res, extraHolidayService.updateStationExtraHoliday(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
