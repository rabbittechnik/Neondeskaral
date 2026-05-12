import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as assistant from '../services/scheduleAssistantService.js'

export const scheduleAssistantRouter = Router()

scheduleAssistantRouter.post('/generate', (req, res) => {
  try {
    const out = assistant.generateScheduleSuggestions(getDb(), req.body ?? {})
    jsonOk(res, out)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

scheduleAssistantRouter.post('/apply', (req, res) => {
  try {
    const out = assistant.applyScheduleSuggestions(getDb(), req.body ?? {})
    jsonOk(res, out)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
