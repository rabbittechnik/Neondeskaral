import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission, getAccess, requireAnyPermission } from '../middleware/stationAuth.js'
import { canAccessStation, hasPermission } from '../services/stationAccessService.js'
import * as employeeService from '../services/employeeService.js'
import {
  revokeAllDevicesForEmployee,
  RB_ADMIN_ALL,
} from '../services/employeeAppDeviceService.js'
import { listActiveShiftWarningsForEmployee, acknowledgeShiftWarningByAdmin } from '../services/employeeShiftWarningService.js'

export const employeesRouter = Router()

function canViewEmployeeSensitive(req: import('express').Request, stationId: string): boolean {
  const ctx = getAccess(req)
  if (!ctx?.userId) return false
  if (ctx.globalAdmin) return true
  return (
    hasPermission(ctx, stationId, 'employees.viewSensitive') ||
    hasPermission(ctx, stationId, 'payroll.view') ||
    hasPermission(ctx, stationId, 'employees.manageSensitive')
  )
}

employeesRouter.get('/by-card/:cardNumber', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'employees.view')) return
    const emp = employeeService.getEmployeeByCard(getDb(), req.params.cardNumber, stationId!)
    if (!emp) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    jsonOk(res, emp)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeesRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'employees.view')) return
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true'
    const sens = canViewEmployeeSensitive(req, stationId!)
    const ctx = getAccess(req)
    const includeAccessTokens = Boolean(ctx && hasPermission(ctx, stationId!, 'employees.qr'))
    jsonOk(
      res,
      employeeService.listEmployees(getDb(), stationId!, {
        includeInactive,
        includeSensitive: sens,
        includeAccessTokens,
      }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeesRouter.post('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'employees.create')) return
    const sens = canViewEmployeeSensitive(req, stationId!)
    jsonOk(res, employeeService.createEmployee(getDb(), req.body ?? {}, stationId!, { allowSensitive: sens }), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.post('/:id/regenerate-access-token', (req, res) => {
  try {
    const row = employeeService.getEmployeeRowInternal(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'employees.qr')) return
    jsonOk(res, employeeService.regenerateEmployeeAccessToken(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.post('/:id/revoke-all-devices', (req, res) => {
  try {
    const row = employeeService.getEmployeeRowInternal(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    if (
      !requireAnyPermission(req, res, row.station_id, [
        'employees.revokeDevices',
        'employees.manageAppAccess',
        'employees.qr',
      ])
    )
      return
    const ctx = getAccess(req)
    revokeAllDevicesForEmployee(getDb(), req.params.id, ctx?.userId ? `user:${ctx.userId}` : RB_ADMIN_ALL)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.post('/:id/disable-access', (req, res) => {
  try {
    const row = employeeService.getEmployeeRowInternal(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'employees.qr')) return
    jsonOk(res, employeeService.setEmployeeAccessEnabled(getDb(), req.params.id, false))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.post('/:id/enable-access', (req, res) => {
  try {
    const row = employeeService.getEmployeeRowInternal(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'employees.qr')) return
    jsonOk(res, employeeService.setEmployeeAccessEnabled(getDb(), req.params.id, true))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.get('/:id/shift-warnings/active', (req, res) => {
  try {
    const row = employeeService.getEmployeeRowInternal(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'employees.view')) return
    jsonOk(res, listActiveShiftWarningsForEmployee(getDb(), req.params.id))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeesRouter.post('/:id/shift-warnings/:warningId/acknowledge', (req, res) => {
  try {
    const row = employeeService.getEmployeeRowInternal(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'time.approve')) return
    acknowledgeShiftWarningByAdmin(getDb(), req.params.warningId, req.params.id)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.get('/:id', (req, res) => {
  try {
    const row = employeeService.getEmployeeRowInternal(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'employees.view')) return
    const ctx = getAccess(req)
    const sens = canViewEmployeeSensitive(req, row.station_id)
    const includeAccessToken = Boolean(ctx && hasPermission(ctx, row.station_id, 'employees.qr'))
    jsonOk(
      res,
      employeeService.getEmployee(getDb(), req.params.id, { includeSensitive: sens, includeAccessToken }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeesRouter.put('/:id', (req, res) => {
  try {
    const row = employeeService.getEmployeeRowInternal(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'employees.edit')) return
    const sens = canViewEmployeeSensitive(req, row.station_id)
    jsonOk(res, employeeService.updateEmployee(getDb(), req.params.id, req.body ?? {}, { allowSensitive: sens }))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeesRouter.delete('/:id', (req, res) => {
  try {
    const row = employeeService.getEmployeeRowInternal(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Mitarbeiter nicht gefunden', 404)
    const ctx = getAccess(req)
    if (!ctx) return jsonErr(res, 'Intern', 500)
    if (!canAccessStation(ctx, row.station_id)) return jsonErr(res, 'Kein Zugriff auf diese Station', 403)

    const modeRaw = typeof req.query.mode === 'string' ? req.query.mode.trim() : 'soft'
    const mode = modeRaw === 'hard' ? 'hard' : 'soft'

    if (mode === 'soft') {
      if (!hasPermission(ctx, row.station_id, 'employees.deactivate')) {
        jsonErr(res, 'Keine Berechtigung', 403)
        return
      }
      employeeService.softDeleteEmployee(getDb(), req.params.id)
      jsonOk(res, { deleted: true, mode: 'soft' as const })
      return
    }

    const canHard =
      ctx.globalAdmin ||
      hasPermission(ctx, row.station_id, 'employees.manageSensitive') ||
      hasPermission(ctx, row.station_id, 'employees.delete')
    if (!canHard) {
      jsonErr(res, 'Keine Berechtigung für endgültiges Löschen', 403)
      return
    }
    const out = employeeService.deleteEmployeeHardOrFallback(getDb(), req.params.id)
    jsonOk(res, { deleted: true, mode: out.outcome, message: out.message })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
