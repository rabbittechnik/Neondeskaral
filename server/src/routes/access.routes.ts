import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requireGlobalAdmin } from '../middleware/stationAuth.js'
import * as accessManagement from '../services/accessManagementService.js'
import { listUserAuditLog } from '../services/userAuditLogService.js'

export const accessRouter = Router()

accessRouter.get('/audit-log', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    const lim = typeof req.query.limit === 'string' ? Number(req.query.limit) : 200
    jsonOk(res, listUserAuditLog(getDb(), lim))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

accessRouter.get('/users', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    jsonOk(res, accessManagement.listManagedUsers(getDb()))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

accessRouter.post('/users', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    const b = (req.body ?? {}) as Record<string, unknown>
    const stationIds = Array.isArray(b.stationIds) ? (b.stationIds as unknown[]).map(String) : []
    const permissions = (typeof b.permissions === 'object' && b.permissions && !Array.isArray(b.permissions)
      ? (b.permissions as Record<string, boolean>)
      : {}) as Record<string, boolean>
    const row = accessManagement.createManagedUser(
      getDb(),
      {
        displayName: String(b.displayName ?? ''),
        username: String(b.username ?? ''),
        email: b.email != null ? String(b.email) : undefined,
        password: b.password != null ? String(b.password) : undefined,
        globalAdmin: b.globalAdmin === true,
        active: b.active !== false,
        stationIds,
        role: String(b.role ?? 'teamleiter'),
        permissions,
      },
      req.adminUser!.sub,
    )
    jsonOk(res, row, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

accessRouter.put('/users/:id', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    const b = (req.body ?? {}) as Record<string, unknown>
    const stationIds = Array.isArray(b.stationIds) ? (b.stationIds as unknown[]).map(String) : []
    const permissions = (typeof b.permissions === 'object' && b.permissions && !Array.isArray(b.permissions)
      ? (b.permissions as Record<string, boolean>)
      : {}) as Record<string, boolean>
    const row = accessManagement.updateManagedUser(
      getDb(),
      req.params.id,
      {
        displayName: String(b.displayName ?? ''),
        username: String(b.username ?? ''),
        email: b.email != null ? String(b.email) : undefined,
        password: b.password != null ? String(b.password) : undefined,
        globalAdmin: b.globalAdmin === true,
        active: b.active !== false,
        stationIds,
        role: String(b.role ?? 'teamleiter'),
        permissions,
      },
      req.adminUser!.sub,
    )
    jsonOk(res, row)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

accessRouter.post('/users/:id/reset-password', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    const pwd = String((req.body as { password?: string })?.password ?? '')
    accessManagement.resetUserPassword(getDb(), req.params.id, pwd, req.adminUser!.sub)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

accessRouter.post('/users/:id/disable', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    accessManagement.setUserActive(getDb(), req.params.id, false, req.adminUser!.sub)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

accessRouter.post('/users/:id/enable', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    accessManagement.setUserActive(getDb(), req.params.id, true, req.adminUser!.sub)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

accessRouter.delete('/users/:id', (req, res) => {
  try {
    if (!requireGlobalAdmin(req, res)) return
    accessManagement.deleteManagedUser(getDb(), req.params.id, req.adminUser!.sub)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
