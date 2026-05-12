import type { Response } from 'express'

export function jsonOk<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data })
}

export function jsonErr(res: Response, message: string, status = 400) {
  return res.status(status).json({ ok: false, error: message })
}
