import type { Request, Response } from 'express'
import { jsonErr } from '../utils/http.js'
import type { AccessContext } from '../services/stationAccessService.js'
import { canAccessStation, hasPermission } from '../services/stationAccessService.js'

export function getAccess(req: Request): AccessContext | undefined {
  return req.accessContext
}

export function requireStationId(req: Request, res: Response, stationId: string | undefined | null): stationId is string {
  const sid = typeof stationId === 'string' ? stationId.trim() : ''
  if (!sid) {
    jsonErr(res, 'stationId erforderlich', 400)
    return false
  }
  const ctx = getAccess(req)
  if (!ctx) {
    jsonErr(res, 'Interner Fehler', 500)
    return false
  }
  if (!canAccessStation(ctx, sid)) {
    jsonErr(res, 'Kein Zugriff auf diese Station', 403)
    return false
  }
  return true
}

export function requirePermission(
  req: Request,
  res: Response,
  stationId: string | undefined | null,
  key: string,
): stationId is string {
  if (!requireStationId(req, res, stationId)) return false
  const ctx = getAccess(req)!
  if (!hasPermission(ctx, stationId!, key)) {
    jsonErr(res, 'Keine Berechtigung', 403)
    return false
  }
  return true
}

export function requireGlobalAdmin(req: Request, res: Response): boolean {
  const ctx = getAccess(req)
  if (!ctx?.globalAdmin) {
    jsonErr(res, 'Keine Berechtigung', 403)
    return false
  }
  return true
}
