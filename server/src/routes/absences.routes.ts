import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission } from '../middleware/stationAuth.js'
import { getUserDisplayName } from '../services/authService.js'
import * as absenceService from '../services/absenceService.js'

function absenceStationId(db: ReturnType<typeof getDb>, id: string): string | undefined {
  const r = db.prepare(`SELECT station_id FROM absences WHERE id = ?`).get(id) as { station_id: string } | undefined
  return r?.station_id
}

export const absencesRouter = Router()

absencesRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'absences.view')) return
    jsonOk(
      res,
      absenceService.listAbsences(getDb(), {
        stationId: stationId!,
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
    const sid = absenceStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Abwesenheit nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'absences.view')) return
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
    if (!requirePermission(req, res, stationId, 'absences.create')) return
    jsonOk(res, absenceService.createAbsence(getDb(), req.body ?? {}, stationId!), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

absencesRouter.put('/:id', (req, res) => {
  try {
    const sid = absenceStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Abwesenheit nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'absences.create')) return
    jsonOk(res, absenceService.updateAbsence(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

absencesRouter.delete('/:id', (req, res) => {
  try {
    const sid = absenceStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Abwesenheit nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'absences.create')) return
    absenceService.deleteAbsence(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

absencesRouter.post('/:id/approve', (req, res) => {
  try {
    const db = getDb()
    const sid = absenceStationId(db, req.params.id)
    if (!sid) return jsonErr(res, 'Abwesenheit nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'absences.approve')) return
    const uid = req.adminUser?.sub
    if (!uid) return jsonErr(res, 'Nicht angemeldet', 401)
    const by = getUserDisplayName(db, uid)
    const body = (req.body ?? {}) as { acknowledgeVacationDebt?: boolean }
    try {
      const a = absenceService.approveAbsence(db, req.params.id, by, {
        acknowledgeVacationDebt: body.acknowledgeVacationDebt,
      })
      jsonOk(res, a)
    } catch (e) {
      if (e instanceof absenceService.VacationAckRequiredError) {
        return res.status(409).json({
          ok: false,
          code: 'VACATION_ACK_REQUIRED',
          error:
            typeof e.details.message === 'string'
              ? e.details.message
              : 'Dieser Mitarbeiter hat nicht genügend Resturlaub.',
          details: e.details,
        })
      }
      throw e
    }
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

absencesRouter.post('/:id/reject', (req, res) => {
  try {
    const db = getDb()
    const sid = absenceStationId(db, req.params.id)
    if (!sid) return jsonErr(res, 'Abwesenheit nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'absences.reject')) return
    const uid = req.adminUser?.sub
    if (!uid) return jsonErr(res, 'Nicht angemeldet', 401)
    const reason = typeof (req.body as { reason?: string })?.reason === 'string' ? (req.body as { reason: string }).reason : undefined
    jsonOk(res, absenceService.rejectAbsence(db, req.params.id, reason, uid))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

absencesRouter.post('/:id/cancel', (req, res) => {
  try {
    const sid = absenceStationId(getDb(), req.params.id)
    if (!sid) return jsonErr(res, 'Abwesenheit nicht gefunden', 404)
    if (!requirePermission(req, res, sid, 'absences.create')) return
    jsonOk(res, absenceService.cancelAbsence(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
