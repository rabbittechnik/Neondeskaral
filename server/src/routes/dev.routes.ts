import { Router } from 'express'
import { getDb, getDbPath } from '../db/database.js'
import { seedImportedStationGuideSchedule } from '../db/seedSchedule.js'
import { jsonErr, jsonOk } from '../utils/http.js'

export const devRouter = Router()

const PERSISTENCE_TABLES = [
  'stations',
  'roles',
  'users',
  'user_station_access',
  'employees',
  'employee_work_areas',
  'work_areas',
  'shifts',
  'absences',
  'vacation_blocks',
  'tasks',
  'task_logs',
  'time_entries',
  'shift_close_checklists',
  'card_entry_events',
  'tuv_reports',
  'tuv_report_items',
  'employee_access_logs',
] as const

function devDiagnosticsAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  return process.env.ALLOW_PERSISTENCE_DIAG === '1' || process.env.ALLOW_DEV_IMPORT === '1'
}

devRouter.get('/persistence-summary', (_req, res) => {
  if (!devDiagnosticsAllowed()) {
    res.status(404).json({ ok: false, error: 'Nicht gefunden' })
    return
  }
  try {
    const db = getDb()
    const tableCounts: Record<string, number | null> = {}
    for (const name of PERSISTENCE_TABLES) {
      const exists = db.prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`).get(name) as
        | { ok: number }
        | undefined
      if (!exists) {
        tableCounts[name] = null
        continue
      }
      const c = (db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get() as { c: number }).c
      tableCounts[name] = c
    }
    jsonOk(res, {
      databasePath: getDbPath(),
      tableCounts,
      note:
        'Nur Metadaten (Zeilenanzahl). In Produktion nur mit ALLOW_PERSISTENCE_DIAG=1 oder ALLOW_DEV_IMPORT=1.',
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

devRouter.post('/import-stationguide-schedule', (_req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_IMPORT !== '1') {
    res.status(404).json({ ok: false, error: 'Nicht gefunden' })
    return
  }
  try {
    const r = seedImportedStationGuideSchedule(getDb())
    jsonOk(res, r)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
