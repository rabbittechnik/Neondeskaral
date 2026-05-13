import { Router, type Request, type Response } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as stationService from '../services/stationService.js'
import {
  getTabletWeekSchedule,
  getTabletTasksPayload,
  listEmployeesTabletClock,
  listTabletRunningPresence,
  listTabletShiftsRange,
  listTabletTimeEntriesWide,
  listTabletWorkAreas,
} from '../services/tabletDataService.js'
import { confirmTaskFromTablet } from '../services/taskService.js'

export const tabletRouter = Router()

function requireStation(req: Request, res: Response): string | null {
  const stationId = typeof req.query.stationId === 'string' ? req.query.stationId.trim() : ''
  if (!stationId) {
    jsonErr(res, 'stationId erforderlich', 400)
    return null
  }
  const row = stationService.getStation(getDb(), stationId)
  if (!row) {
    jsonErr(res, 'Station nicht gefunden', 404)
    return null
  }
  return stationId
}

tabletRouter.get('/shifts-range', (req, res) => {
  try {
    const sid = requireStation(req, res)
    if (!sid) return
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return jsonErr(res, 'from und to als YYYY-MM-DD erforderlich', 400)
    }
    jsonOk(res, listTabletShiftsRange(getDb(), sid, from, to))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tabletRouter.get('/employees', (req, res) => {
  try {
    const sid = requireStation(req, res)
    if (!sid) return
    jsonOk(res, listEmployeesTabletClock(getDb(), sid))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tabletRouter.get('/time-entries', (req, res) => {
  try {
    const sid = requireStation(req, res)
    if (!sid) return
    jsonOk(res, listTabletTimeEntriesWide(getDb(), sid))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tabletRouter.get('/running-presence', (req, res) => {
  try {
    const sid = requireStation(req, res)
    if (!sid) return
    jsonOk(res, listTabletRunningPresence(getDb(), sid))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tabletRouter.get('/week-schedule', (req, res) => {
  try {
    const sid = requireStation(req, res)
    if (!sid) return
    const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart.trim() : ''
    jsonOk(res, getTabletWeekSchedule(getDb(), sid, weekStart))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tabletRouter.get('/work-areas', (req, res) => {
  try {
    const sid = requireStation(req, res)
    if (!sid) return
    jsonOk(res, listTabletWorkAreas(getDb(), sid))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tabletRouter.get('/tasks-today', (req, res) => {
  try {
    const sid = requireStation(req, res)
    if (!sid) return
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId.trim() : undefined
    jsonOk(res, getTabletTasksPayload(getDb(), sid, employeeId || null))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tabletRouter.post('/tasks/:taskId/complete', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId.trim() : ''
    if (!stationId) return jsonErr(res, 'stationId erforderlich', 400)
    const row = stationService.getStation(getDb(), stationId)
    if (!row) return jsonErr(res, 'Station nicht gefunden', 404)
    const taskId = String(req.params.taskId ?? '').trim()
    if (!taskId) return jsonErr(res, 'taskId erforderlich', 400)
    const body = (req.body ?? {}) as { date?: string; employeeId?: string; displayName?: string; comment?: string }
    const date = String(body.date ?? '').trim()
    const employeeId = String(body.employeeId ?? '').trim()
    const displayName = String(body.displayName ?? '').trim()
    if (!date) return jsonErr(res, 'date erforderlich', 400)
    if (!employeeId) return jsonErr(res, 'employeeId erforderlich', 400)
    if (!displayName) return jsonErr(res, 'displayName erforderlich', 400)
    const logs = confirmTaskFromTablet(getDb(), taskId, {
      date,
      employeeId,
      displayName,
      comment: body.comment,
      stationId,
    })
    jsonOk(res, { logs })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
