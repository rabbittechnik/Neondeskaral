import { Router } from 'express'
import { getDb } from '../db/database.js'
import { seedImportedStationGuideSchedule } from '../db/seedSchedule.js'
import { jsonErr, jsonOk } from '../utils/http.js'

export const devRouter = Router()

devRouter.post('/import-stationguide-schedule', (_req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_IMPORT !== '1') {
    res.status(404).json({ ok: false, error: 'Nicht gefunden' })
    return
  }
  try {
    const r = seedImportedStationGuideSchedule(getDb())
    jsonOk(res, r)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
