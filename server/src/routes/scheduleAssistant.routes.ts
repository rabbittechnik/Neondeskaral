import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission } from '../middleware/stationAuth.js'
import * as assistant from '../services/scheduleAssistantService.js'

export const scheduleAssistantRouter = Router()

scheduleAssistantRouter.post('/generate', (req, res) => {
  try {
    const stationId = String((req.body as { stationId?: string })?.stationId ?? '').trim()
    if (!requirePermission(req, res, stationId, 'schedule.edit')) return
    const out = assistant.generateScheduleSuggestions(getDb(), req.body ?? {})
    jsonOk(res, out)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

scheduleAssistantRouter.post('/apply', (req, res) => {
  try {
    const stationId = String((req.body as { stationId?: string })?.stationId ?? '').trim()
    if (!requirePermission(req, res, stationId, 'schedule.edit')) return
    const out = assistant.applyScheduleSuggestions(getDb(), req.body ?? {})
    jsonOk(res, out)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
