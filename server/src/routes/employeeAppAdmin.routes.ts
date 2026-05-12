import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requireAnyPermission, getAccess } from '../middleware/stationAuth.js'
import { listEmployeeAppAccessOverview, revokeDeviceRowById } from '../services/employeeAppDeviceService.js'

export const employeeAppAdminRouter = Router()

const VIEW_KEYS = ['employees.viewAppAccess', 'employees.viewDevices', 'employees.qr'] as const
const MUTATE_DEVICE_KEYS = ['employees.revokeDevices', 'employees.manageAppAccess', 'employees.qr'] as const

employeeAppAdminRouter.get('/devices', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireAnyPermission(req, res, stationId, [...VIEW_KEYS])) return
    const ctx = getAccess(req)
    const includeIp = Boolean(ctx?.globalAdmin)
    const rows = listEmployeeAppAccessOverview(getDb(), stationId!)
    const data = includeIp
      ? rows
      : rows.map((r) => ({
          ...r,
          devices: r.devices.map(({ lastIp: _omit, ...d }) => {
            void _omit
            return d
          }),
        }))
    jsonOk(res, data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAppAdminRouter.post('/devices/:deviceRowId/revoke', (req, res) => {
  try {
    const devRowId = req.params.deviceRowId
    const device = getDb()
      .prepare(`SELECT station_id FROM employee_app_devices WHERE id = ?`)
      .get(devRowId) as { station_id: string } | undefined
    if (!device) return jsonErr(res, 'Gerät nicht gefunden', 404)
    if (!requireAnyPermission(req, res, device.station_id, [...MUTATE_DEVICE_KEYS])) return
    const ctx = getAccess(req)
    const revokedBy = ctx?.userId ? `user:${ctx.userId}` : 'admin'
    revokeDeviceRowById(getDb(), devRowId, device.station_id, revokedBy)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
