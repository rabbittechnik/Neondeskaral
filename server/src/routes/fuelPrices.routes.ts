import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr } from '../utils/http.js'
import { getFuelPricesCurrent } from '../services/fuelPriceService.js'
import { touchTabletByToken } from '../services/stationTabletDeviceService.js'

export const fuelPricesRouter = Router()

function resolveStationId(req: import('express').Request, res: import('express').Response): string | null {
  const tabletToken = typeof req.query.tabletToken === 'string' ? req.query.tabletToken.trim() : ''
  let stationId = typeof req.query.stationId === 'string' ? req.query.stationId.trim() : ''
  if (tabletToken) {
    const row = touchTabletByToken(getDb(), tabletToken, req)
    if (!row) {
      jsonErr(res, 'Tablet-Zugang ungültig oder deaktiviert', 403)
      return null
    }
    stationId = row.station_id
  }
  if (!stationId) {
    jsonErr(res, 'stationId oder tabletToken erforderlich', 400)
    return null
  }
  return stationId
}

async function sendFuelPrices(req: import('express').Request, res: import('express').Response) {
  try {
    const stationId = resolveStationId(req, res)
    if (!stationId) return
    const force = String(req.query.forceRefresh ?? '') === 'true' || String(req.query.forceRefresh ?? '') === '1'
    const payload = await getFuelPricesCurrent(getDb(), stationId, { forceRefresh: force })
    return res.status(200).json(payload)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
}

/** Tablet & Clients: nur Backend-Cache / max. 1× Tankerkönig pro Station / Minute */
fuelPricesRouter.get('/current', sendFuelPrices)

/** @deprecated Alias — gleiche Antwort wie /current */
fuelPricesRouter.get('/', sendFuelPrices)
