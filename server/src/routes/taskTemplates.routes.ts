import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission } from '../middleware/stationAuth.js'
import {
  dynamicTemplateAssignmentStats,
  listTaskTemplates,
  updateTaskTemplate,
  yearlyTemplateCompletionStats,
} from '../services/taskTemplateService.js'

export const taskTemplatesRouter = Router()

taskTemplatesRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'tasks.view')) return
    const templateType = typeof req.query.templateType === 'string' ? req.query.templateType : undefined
    jsonOk(res, listTaskTemplates(getDb(), stationId!, templateType))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

taskTemplatesRouter.get('/stats/year', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'tasks.view')) return
    const y = typeof req.query.year === 'string' ? Number(req.query.year) : new Date().getFullYear()
    const year = Number.isFinite(y) ? Math.floor(y) : new Date().getFullYear()
    jsonOk(res, {
      yearly: yearlyTemplateCompletionStats(getDb(), stationId!, year),
      dynamic: dynamicTemplateAssignmentStats(getDb(), stationId!, year),
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

taskTemplatesRouter.patch('/:id', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'tasks.edit')) return
    jsonOk(res, updateTaskTemplate(getDb(), req.params.id, req.body ?? {}, stationId!))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
