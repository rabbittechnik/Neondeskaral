import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { loginAdminUser, buildAuthMeUser, findUserByUsername, updateAdminUserProfile } from '../services/authService.js'
import { appendUserAudit } from '../services/userAuditLogService.js'

export const authRouter = Router()

authRouter.post('/login', (req, res) => {
  const body = req.body as { username?: string; password?: string; rememberMe?: boolean }
  const usernameRaw = String(body.username ?? '').trim()
  try {
    const out = loginAdminUser(getDb(), {
      username: usernameRaw,
      password: String(body.password ?? ''),
      rememberMe: Boolean(body.rememberMe),
    })
    jsonOk(res, out)
  } catch (e) {
    try {
      const db = getDb()
      const u = usernameRaw ? findUserByUsername(db, usernameRaw) : undefined
      appendUserAudit(db, {
        userId: u?.id ?? null,
        action: 'login.failed',
        details: { username: usernameRaw.toLowerCase() },
      })
    } catch {
      /* ignore */
    }
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 401)
  }
})

authRouter.get('/me', (req, res) => {
  const t0 = Date.now()
  if (!req.adminUser) {
    jsonErr(res, 'Nicht angemeldet', 401)
    return
  }
  const me = buildAuthMeUser(getDb(), req.adminUser.sub)
  const ms = Date.now() - t0
  if (ms >= 300) console.info(`[startup] GET /auth/me ${ms}ms`)
  if (!me) {
    jsonErr(res, 'Benutzer nicht gefunden', 404)
    return
  }
  jsonOk(res, me)
})

authRouter.put('/me', (req, res) => {
  if (!req.adminUser) {
    jsonErr(res, 'Nicht angemeldet', 401)
    return
  }
  try {
    const me = updateAdminUserProfile(getDb(), req.adminUser.sub, (req.body ?? {}) as Record<string, unknown>)
    if (!me) {
      jsonErr(res, 'Benutzer nicht gefunden', 404)
      return
    }
    jsonOk(res, me)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
