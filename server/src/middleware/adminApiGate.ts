import type { NextFunction, Request, Response } from 'express'
import { verifyAdminToken } from '../services/authService.js'
import { getDb } from '../db/database.js'
import { buildAccessContext } from '../services/stationAccessService.js'

/**
 * Schützt alle /api/* Routen außer Health, Login, Mitarbeiter-Zugang und Terminal.
 */
export function adminApiGate(req: Request, res: Response, next: NextFunction) {
  const p = (req.originalUrl ?? req.url ?? '').split('?')[0] || req.path
  if (p === '/api/health') return next()
  if (p === '/api/auth/login') return next()
  if (p.startsWith('/api/employee-access')) return next()
  if (p.startsWith('/api/terminal')) return next()

  if (!p.startsWith('/api')) return next()

  const h = req.headers.authorization
  const token = typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7).trim() : ''
  if (!token) {
    res.status(401).json({ ok: false, error: 'Nicht angemeldet' })
    return
  }
  const payload = verifyAdminToken(token)
  if (!payload) {
    res.status(401).json({ ok: false, error: 'Sitzung abgelaufen' })
    return
  }
  const row = getDb()
    .prepare(`SELECT id FROM users WHERE id = ? AND (active IS NULL OR active = 1)`)
    .get(payload.sub) as { id: string } | undefined
  if (!row) {
    res.status(401).json({ ok: false, error: 'Benutzer ungültig' })
    return
  }
  req.accessContext = buildAccessContext(getDb(), payload.sub)
  req.adminUser = payload
  next()
}
