import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requireAnyPermission } from '../middleware/stationAuth.js'
import { buildAbsenceYearSummary, type AbsenceSummaryCohort } from '../services/absenceSummaryReportService.js'
import type { AbsenceCountMode } from '../utils/absenceYearCalculator.js'

export const reportsRouter = Router()

const REPORT_ABSENCE_KEYS = ['reports.view', 'absences.view', 'payroll.view']

reportsRouter.get('/absences-summary', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireAnyPermission(req, res, stationId, REPORT_ABSENCE_KEYS)) return

    const yearRaw = typeof req.query.year === 'string' ? Number.parseInt(req.query.year, 10) : NaN
    const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear()
    if (year < 2000 || year > 2100) return jsonErr(res, 'year ungültig', 400)

    const cohortRaw = typeof req.query.cohort === 'string' ? req.query.cohort : 'active'
    const cohort: AbsenceSummaryCohort = cohortRaw === 'exited_year' ? 'exited_year' : 'active'

    const modeRaw = typeof req.query.countMode === 'string' ? req.query.countMode : 'calendar_days'
    const countMode: AbsenceCountMode = modeRaw === 'work_days' ? 'work_days' : 'calendar_days'

    const data = buildAbsenceYearSummary(getDb(), {
      stationId: stationId!,
      year,
      cohort,
      countMode,
    })
    jsonOk(res, data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})
