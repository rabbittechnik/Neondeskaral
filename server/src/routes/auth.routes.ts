import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { loginAdminUser, buildAuthMeUser, findUserByUsername } from '../services/authService.js'
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
  if (!req.adminUser) {
    jsonErr(res, 'Nicht angemeldet', 401)
    return
  }
  const me = buildAuthMeUser(getDb(), req.adminUser.sub)
  if (!me) {
    jsonErr(res, 'Benutzer nicht gefunden', 404)
    return
  }
  jsonOk(res, me)
})
