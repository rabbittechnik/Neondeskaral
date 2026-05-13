import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr } from '../utils/http.js'
import { getFuelPricesForStation } from '../services/fuelPriceService.js'

export const fuelPricesRouter = Router()

fuelPricesRouter.get('/', async (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId.trim() : ''
    if (!stationId) return jsonErr(res, 'stationId erforderlich', 400)
    const force = String(req.query.forceRefresh ?? '') === 'true' || String(req.query.forceRefresh ?? '') === '1'
    const payload = await getFuelPricesForStation(getDb(), stationId, { forceRefresh: force })
    return res.status(200).json(payload)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})
