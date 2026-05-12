import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as taskService from '../services/taskService.js'

export const tasksRouter = Router()

tasksRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, taskService.listTasks(getDb(), stationId))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tasksRouter.get('/:id', (req, res) => {
  try {
    const t = taskService.getTask(getDb(), req.params.id)
    if (!t) return jsonErr(res, 'Aufgabe nicht gefunden', 404)
    jsonOk(res, t)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

tasksRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, taskService.createTask(getDb(), req.body ?? {}, stationId), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

tasksRouter.put('/:id', (req, res) => {
  try {
    jsonOk(res, taskService.updateTask(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

tasksRouter.delete('/:id', (req, res) => {
  try {
    taskService.deleteTask(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

tasksRouter.post('/:id/confirm', (req, res) => {
  try {
    const body = (req.body ?? {}) as { date?: string; comment?: string; by?: string; employeeId?: string }
    if (!body.date?.trim()) return jsonErr(res, 'date erforderlich', 400)
    jsonOk(res, taskService.confirmTask(getDb(), req.params.id, { ...body, date: body.date }))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

tasksRouter.post('/:id/control', (req, res) => {
  try {
    const body = (req.body ?? {}) as { date?: string; result?: string; comment?: string; by?: string }
    if (!body.date?.trim()) return jsonErr(res, 'date erforderlich', 400)
    jsonOk(
      res,
      taskService.controlTask(getDb(), req.params.id, {
        ...body,
        date: body.date,
        result: body.result ?? 'ok',
      }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

export const taskLogsRouter = Router()

taskLogsRouter.get('/', (req, res) => {
  try {
    jsonOk(
      res,
      taskService.listTaskLogs(getDb(), {
        taskId: typeof req.query.taskId === 'string' ? req.query.taskId : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
      }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})
