import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as shiftService from '../services/shiftService.js'

export const shiftsRouter = Router()

shiftsRouter.get('/open', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, shiftService.listOpenShifts(getDb(), stationId))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

shiftsRouter.get('/conflicts', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, shiftService.listConflicts(getDb(), stationId))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

shiftsRouter.post('/publish-week', (req, res) => {
  try {
    const weekMonday = String((req.body as { weekMonday?: string })?.weekMonday ?? '').trim()
    if (!weekMonday) return jsonErr(res, 'weekMonday erforderlich', 400)
    const stationId =
      typeof (req.body as { stationId?: string })?.stationId === 'string'
        ? (req.body as { stationId: string }).stationId
        : undefined
    jsonOk(res, shiftService.publishWeek(getDb(), weekMonday, stationId))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

shiftsRouter.get('/', (req, res) => {
  try {
    jsonOk(
      res,
      shiftService.listShifts(getDb(), {
        stationId: typeof req.query.stationId === 'string' ? req.query.stationId : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        employeeId: typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined,
        workAreaId: typeof req.query.workAreaId === 'string' ? req.query.workAreaId : undefined,
      }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

shiftsRouter.get('/:id', (req, res) => {
  try {
    const s = shiftService.getShift(getDb(), req.params.id)
    if (!s) return jsonErr(res, 'Schicht nicht gefunden', 404)
    jsonOk(res, s)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

shiftsRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, shiftService.createShift(getDb(), req.body ?? {}, stationId), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

shiftsRouter.put('/:id', (req, res) => {
  try {
    jsonOk(res, shiftService.updateShift(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

shiftsRouter.delete('/:id', (req, res) => {
  try {
    shiftService.deleteShift(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

shiftsRouter.post('/:id/publish', (req, res) => {
  try {
    jsonOk(res, shiftService.publishShift(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
