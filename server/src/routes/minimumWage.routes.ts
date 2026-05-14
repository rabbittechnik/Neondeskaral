import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { getAccess } from '../middleware/stationAuth.js'
import { hasAnyStationPermission } from '../services/stationAccessService.js'
import {
  createMinimumWageRate,
  deleteMinimumWageRate,
  listMinimumWageRates,
  updateMinimumWageRate,
} from '../services/minimumWageRateService.js'

export const minimumWageRouter = Router()

function canViewMinWage(req: import('express').Request): boolean {
  const ctx = getAccess(req)
  if (!ctx) return false
  if (ctx.globalAdmin) return true
  return hasAnyStationPermission(ctx, 'payroll.view') || hasAnyStationPermission(ctx, 'settings.view')
}

function canEditMinWage(req: import('express').Request): boolean {
  const ctx = getAccess(req)
  if (!ctx) return false
  if (ctx.globalAdmin) return true
  return hasAnyStationPermission(ctx, 'settings.edit')
}

minimumWageRouter.get('/', (req, res) => {
  try {
    if (!canViewMinWage(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    const rows = listMinimumWageRates(getDb())
    jsonOk(res, { items: rows })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

minimumWageRouter.post('/', (req, res) => {
  try {
    if (!canEditMinWage(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    const b = (req.body ?? {}) as Record<string, unknown>
    const validFrom = String(b.validFrom ?? b.valid_from ?? '').trim()
    const hourlyRate = Number(b.hourlyRate ?? b.hourly_rate)
    const note = b.note != null ? String(b.note) : null
    const row = createMinimumWageRate(getDb(), { validFrom, hourlyRate, note })
    jsonOk(res, row, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

minimumWageRouter.patch('/:id', (req, res) => {
  try {
    if (!canEditMinWage(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    const b = (req.body ?? {}) as Record<string, unknown>
    const row = updateMinimumWageRate(getDb(), req.params.id, {
      validFrom: b.validFrom != null ? String(b.validFrom) : undefined,
      hourlyRate: b.hourlyRate != null ? Number(b.hourlyRate) : undefined,
      note: b.note !== undefined ? (b.note == null ? null : String(b.note)) : undefined,
    })
    jsonOk(res, row)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

minimumWageRouter.delete('/:id', (req, res) => {
  try {
    if (!canEditMinWage(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    deleteMinimumWageRate(getDb(), req.params.id)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
