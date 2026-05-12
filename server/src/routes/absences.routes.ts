import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as absenceService from '../services/absenceService.js'

export const absencesRouter = Router()

absencesRouter.get('/', (req, res) => {
  try {
    jsonOk(
      res,
      absenceService.listAbsences(getDb(), {
        stationId: typeof req.query.stationId === 'string' ? req.query.stationId : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        employeeId: typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
      }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

absencesRouter.get('/:id', (req, res) => {
  try {
    const a = absenceService.getAbsence(getDb(), req.params.id)
    if (!a) return jsonErr(res, 'Abwesenheit nicht gefunden', 404)
    jsonOk(res, a)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

absencesRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, absenceService.createAbsence(getDb(), req.body ?? {}, stationId), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

absencesRouter.put('/:id', (req, res) => {
  try {
    jsonOk(res, absenceService.updateAbsence(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

absencesRouter.delete('/:id', (req, res) => {
  try {
    absenceService.deleteAbsence(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

absencesRouter.post('/:id/approve', (req, res) => {
  try {
    const by = typeof (req.body as { by?: string })?.by === 'string' ? (req.body as { by: string }).by : undefined
    jsonOk(res, absenceService.approveAbsence(getDb(), req.params.id, by))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

absencesRouter.post('/:id/reject', (req, res) => {
  try {
    const reason = typeof (req.body as { reason?: string })?.reason === 'string' ? (req.body as { reason: string }).reason : undefined
    jsonOk(res, absenceService.rejectAbsence(getDb(), req.params.id, reason))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
