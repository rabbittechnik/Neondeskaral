import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr } from '../utils/http.js'
import { getFuelPricesForStation } from '../services/fuelPriceService.js'
import { touchTabletByToken } from '../services/stationTabletDeviceService.js'

export const fuelPricesRouter = Router()

fuelPricesRouter.get('/', async (req, res) => {
  try {
    const tabletToken = typeof req.query.tabletToken === 'string' ? req.query.tabletToken.trim() : ''
    let stationId = typeof req.query.stationId === 'string' ? req.query.stationId.trim() : ''
    if (tabletToken) {
      const row = touchTabletByToken(getDb(), tabletToken, req)
      if (!row) return jsonErr(res, 'Tablet-Zugang ungültig oder deaktiviert', 403)
      stationId = row.station_id
    }
    if (!stationId) return jsonErr(res, 'stationId oder tabletToken erforderlich', 400)
    const force = String(req.query.forceRefresh ?? '') === 'true' || String(req.query.forceRefresh ?? '') === '1'
    const payload = await getFuelPricesForStation(getDb(), stationId, { forceRefresh: force })
    return res.status(200).json(payload)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})
