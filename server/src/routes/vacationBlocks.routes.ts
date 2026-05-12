import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as vacationBlockService from '../services/vacationBlockService.js'

export const vacationBlocksRouter = Router()

vacationBlocksRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, vacationBlockService.listVacationBlocks(getDb(), stationId))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

vacationBlocksRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, vacationBlockService.createVacationBlock(getDb(), req.body ?? {}, stationId), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

vacationBlocksRouter.put('/:id', (req, res) => {
  try {
    jsonOk(res, vacationBlockService.updateVacationBlock(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

vacationBlocksRouter.delete('/:id', (req, res) => {
  try {
    vacationBlockService.deleteVacationBlock(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
