import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { loginAdminUser } from '../services/authService.js'

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
  jsonOk(res, {
    id: req.adminUser.sub,
    username: req.adminUser.username,
    displayName: req.adminUser.displayName,
    roleId: req.adminUser.roleId,
  })
})
