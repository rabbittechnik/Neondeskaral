import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { loginAdminUser, buildAuthMeUser } from '../services/authService.js'

export const authRouter = Router()

authRouter.post('/login', (req, res) => {
  try {
    const body = req.body as { username?: string; password?: string; rememberMe?: boolean }
    const out = loginAdminUser(getDb(), {
      username: String(body.username ?? ''),
      password: String(body.password ?? ''),
      rememberMe: Boolean(body.rememberMe),
    })
    jsonOk(res, out)
  } catch (e) {
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
