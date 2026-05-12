import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requireStationId } from '../middleware/stationAuth.js'
import { buildNotificationsSummary } from '../services/notificationSummaryService.js'

export const notificationsRouter = Router()

notificationsRouter.get('/summary', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireStationId(req, res, stationId)) return
    const ctx = req.accessContext
    if (!ctx) return jsonErr(res, 'Interner Fehler', 500)
    const data = buildNotificationsSummary(getDb(), ctx, stationId)
    jsonOk(res, data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})
