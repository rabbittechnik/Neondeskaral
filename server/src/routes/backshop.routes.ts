import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { getAccess, requireAnyPermission, requirePermission } from '../middleware/stationAuth.js'
import { hasAnyStationPermission } from '../services/stationAccessService.js'
import {
  createBackshopRoutineItem,
  deleteBackshopRoutineItem,
  listBackshopRoutinesWithItems,
  resolveBackshopNoticeForStationAndDate,
  updateBackshopRoutine,
  updateBackshopRoutineItem,
} from '../services/backshopRoutineService.js'

export const backshopRoutinesRouter = Router()

function canViewBackshop(req: import('express').Request): boolean {
  const ctx = getAccess(req)
  if (!ctx) return false
  if (ctx.globalAdmin) return true
  return hasAnyStationPermission(ctx, 'tasks.view') || hasAnyStationPermission(ctx, 'tasks.edit')
}

function canEditBackshop(req: import('express').Request): boolean {
  const ctx = getAccess(req)
  if (!ctx) return false
  if (ctx.globalAdmin) return true
  return hasAnyStationPermission(ctx, 'tasks.edit')
}

backshopRoutinesRouter.get('/', (req, res) => {
  try {
    if (!canViewBackshop(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : ''
    if (!stationId.trim()) return jsonErr(res, 'stationId erforderlich', 400)
    if (!requireAnyPermission(req, res, stationId, ['tasks.view', 'tasks.edit'])) return
    const routines = listBackshopRoutinesWithItems(getDb(), stationId.trim())
    jsonOk(res, { routines })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

backshopRoutinesRouter.get('/current', (req, res) => {
  try {
    if (!canViewBackshop(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : ''
    const date = typeof req.query.date === 'string' ? req.query.date : ''
    if (!stationId.trim()) return jsonErr(res, 'stationId erforderlich', 400)
    if (!requireAnyPermission(req, res, stationId, ['tasks.view', 'tasks.edit'])) return
    const ymd = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10)
    const resolved = resolveBackshopNoticeForStationAndDate(getDb(), stationId.trim(), ymd)
    jsonOk(res, resolved)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

backshopRoutinesRouter.put('/:id', (req, res) => {
  try {
    if (!canEditBackshop(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    const routine = getDb().prepare(`SELECT station_id FROM backshop_routines WHERE id = ?`).get(req.params.id) as
      | { station_id: string }
      | undefined
    if (!routine) return jsonErr(res, 'Routine nicht gefunden', 404)
    if (!requirePermission(req, res, routine.station_id, 'tasks.edit')) return
    const b = (req.body ?? {}) as Record<string, unknown>
    const row = updateBackshopRoutine(getDb(), req.params.id, {
      title: b.title != null ? String(b.title) : undefined,
      description: b.description !== undefined ? (b.description == null ? null : String(b.description)) : undefined,
      active: b.active !== undefined ? Boolean(b.active) : undefined,
    })
    jsonOk(res, row)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

backshopRoutinesRouter.post('/:id/items', (req, res) => {
  try {
    if (!canEditBackshop(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    const routine = getDb().prepare(`SELECT station_id FROM backshop_routines WHERE id = ?`).get(req.params.id) as
      | { station_id: string }
      | undefined
    if (!routine) return jsonErr(res, 'Routine nicht gefunden', 404)
    if (!requirePermission(req, res, routine.station_id, 'tasks.edit')) return
    const b = (req.body ?? {}) as Record<string, unknown>
    const row = createBackshopRoutineItem(getDb(), req.params.id, {
      name: String(b.name ?? ''),
      quantity: b.quantity != null ? Number(b.quantity) : undefined,
      unit: b.unit != null ? String(b.unit) : undefined,
      category: b.category !== undefined ? (b.category == null ? null : String(b.category)) : undefined,
      sortOrder: b.sortOrder != null ? Number(b.sortOrder) : undefined,
      active: b.active !== undefined ? Boolean(b.active) : undefined,
      validFrom: b.validFrom !== undefined ? (b.validFrom == null ? null : String(b.validFrom)) : undefined,
      validTo: b.validTo !== undefined ? (b.validTo == null ? null : String(b.validTo)) : undefined,
      restrictDayType:
        b.restrictDayType !== undefined ? (b.restrictDayType == null ? null : String(b.restrictDayType)) : undefined,
      notes: b.notes !== undefined ? (b.notes == null ? null : String(b.notes)) : undefined,
    })
    jsonOk(res, row, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

backshopRoutinesRouter.put('/items/:itemId', (req, res) => {
  try {
    if (!canEditBackshop(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    const meta = getDb()
      .prepare(
        `SELECT r.station_id FROM backshop_routine_items i JOIN backshop_routines r ON r.id = i.routine_id WHERE i.id = ?`,
      )
      .get(req.params.itemId) as { station_id: string } | undefined
    if (!meta) return jsonErr(res, 'Artikel nicht gefunden', 404)
    if (!requirePermission(req, res, meta.station_id, 'tasks.edit')) return
    const b = (req.body ?? {}) as Record<string, unknown>
    const row = updateBackshopRoutineItem(getDb(), req.params.itemId, {
      name: b.name != null ? String(b.name) : undefined,
      quantity: b.quantity != null ? Number(b.quantity) : undefined,
      unit: b.unit != null ? String(b.unit) : undefined,
      category: b.category !== undefined ? (b.category == null ? null : String(b.category)) : undefined,
      sortOrder: b.sortOrder != null ? Number(b.sortOrder) : undefined,
      active: b.active !== undefined ? Boolean(b.active) : undefined,
      validFrom: b.validFrom !== undefined ? (b.validFrom == null ? null : String(b.validFrom)) : undefined,
      validTo: b.validTo !== undefined ? (b.validTo == null ? null : String(b.validTo)) : undefined,
      restrictDayType:
        b.restrictDayType !== undefined ? (b.restrictDayType == null ? null : String(b.restrictDayType)) : undefined,
      notes: b.notes !== undefined ? (b.notes == null ? null : String(b.notes)) : undefined,
    })
    jsonOk(res, row)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

backshopRoutinesRouter.delete('/items/:itemId', (req, res) => {
  try {
    if (!canEditBackshop(req)) return jsonErr(res, 'Keine Berechtigung', 403)
    const meta = getDb()
      .prepare(
        `SELECT r.station_id FROM backshop_routine_items i JOIN backshop_routines r ON r.id = i.routine_id WHERE i.id = ?`,
      )
      .get(req.params.itemId) as { station_id: string } | undefined
    if (!meta) return jsonErr(res, 'Artikel nicht gefunden', 404)
    if (!requirePermission(req, res, meta.station_id, 'tasks.edit')) return
    deleteBackshopRoutineItem(getDb(), req.params.itemId)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
