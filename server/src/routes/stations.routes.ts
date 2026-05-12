import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as stationService from '../services/stationService.js'

export const stationsRouter = Router()

stationsRouter.get('/', (_req, res) => {
  try {
    jsonOk(res, stationService.listStations(getDb()))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationsRouter.get('/:id', (req, res) => {
  try {
    const row = stationService.getStation(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Station nicht gefunden', 404)
    jsonOk(res, row)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

stationsRouter.post('/', (req, res) => {
  try {
    jsonOk(res, stationService.createStation(getDb(), req.body ?? {}), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationsRouter.put('/:id', (req, res) => {
  try {
    jsonOk(res, stationService.updateStation(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

stationsRouter.delete('/:id', (req, res) => {
  try {
    stationService.deleteStation(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
