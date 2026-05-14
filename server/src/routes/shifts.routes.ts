import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission } from '../middleware/stationAuth.js'
import * as shiftService from '../services/shiftService.js'
import { generateDynamicWeekendTasks } from '../services/weekendDynamicTasksService.js'
import { mondayOfCalendarWeekBerlin } from '../services/bwHolidayCalendar.js'

export const shiftsRouter = Router()

shiftsRouter.get('/open', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'schedule.view')) return
    jsonOk(res, shiftService.listOpenShifts(getDb(), stationId!))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

shiftsRouter.get('/conflicts', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'schedule.view')) return
    const from = typeof req.query.from === 'string' ? req.query.from : undefined
    const to = typeof req.query.to === 'string' ? req.query.to : undefined
    jsonOk(res, shiftService.listConflicts(getDb(), stationId!, { from, to }))
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
    if (!requirePermission(req, res, stationId, 'schedule.publish')) return
    const db = getDb()
    const published = shiftService.publishWeek(db, weekMonday, stationId!)
    try {
      generateDynamicWeekendTasks(db, stationId!, weekMonday)
    } catch (e) {
      console.warn('[weekend-tasks] publish-week', e)
    }
    jsonOk(res, published)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

shiftsRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'schedule.view')) return
    jsonOk(
      res,
      shiftService.listShifts(getDb(), {
        stationId: stationId!,
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
    const row = shiftService.getShiftRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Schicht nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'schedule.view')) return
    jsonOk(res, shiftService.getShift(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

shiftsRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'schedule.create')) return
    jsonOk(res, shiftService.createShift(getDb(), req.body ?? {}, stationId!), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

shiftsRouter.put('/:id', (req, res) => {
  try {
    const row = shiftService.getShiftRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Schicht nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'schedule.edit')) return
    jsonOk(res, shiftService.updateShift(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

shiftsRouter.delete('/:id', (req, res) => {
  try {
    const row = shiftService.getShiftRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Schicht nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'schedule.delete')) return
    shiftService.deleteShift(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

shiftsRouter.post('/:id/publish', (req, res) => {
  try {
    const row = shiftService.getShiftRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Schicht nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'schedule.publish')) return
    const db = getDb()
    const out = shiftService.publishShift(db, req.params.id)
    try {
      const mon = mondayOfCalendarWeekBerlin(String(row.date))
      generateDynamicWeekendTasks(db, row.station_id, mon)
    } catch (e) {
      console.warn('[weekend-tasks] publish-shift', e)
    }
    jsonOk(res, out)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
