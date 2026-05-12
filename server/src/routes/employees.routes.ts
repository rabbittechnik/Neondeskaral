import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as employeeService from '../services/employeeService.js'

export const employeesRouter = Router()

employeesRouter.get('/by-card/:cardNumber', (req, res) => {
  try {
    const emp = employeeService.getEmployeeByCard(getDb(), req.params.cardNumber)
    if (!emp) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    jsonOk(res, emp)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeesRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true'
    jsonOk(res, employeeService.listEmployees(getDb(), stationId, { includeInactive }))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeesRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, employeeService.createEmployee(getDb(), req.body ?? {}, stationId), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.post('/:id/regenerate-access-token', (req, res) => {
  try {
    jsonOk(res, employeeService.regenerateEmployeeAccessToken(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.post('/:id/disable-access', (req, res) => {
  try {
    jsonOk(res, employeeService.setEmployeeAccessEnabled(getDb(), req.params.id, false))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.post('/:id/enable-access', (req, res) => {
  try {
    jsonOk(res, employeeService.setEmployeeAccessEnabled(getDb(), req.params.id, true))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.get('/:id', (req, res) => {
  try {
    const emp = employeeService.getEmployee(getDb(), req.params.id)
    if (!emp) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    jsonOk(res, emp)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeesRouter.put('/:id', (req, res) => {
  try {
    jsonOk(res, employeeService.updateEmployee(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.delete('/:id', (req, res) => {
  try {
    employeeService.softDeleteEmployee(getDb(), req.params.id)
    jsonOk(res, { deleted: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
