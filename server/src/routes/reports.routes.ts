import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requireAnyPermission } from '../middleware/stationAuth.js'
import { buildAbsenceYearSummary, type AbsenceSummaryCohort } from '../services/absenceSummaryReportService.js'
import type { AbsenceCountMode } from '../utils/absenceYearCalculator.js'
import {
  calculatePayrollCombinedReport,
  calculatePayrollScheduleReport,
  calculatePayrollTimeTrackingReport,
  listPayrollTimeEntryDetails,
} from '../services/payrollReportService.js'

export const reportsRouter = Router()

const REPORT_ABSENCE_KEYS = ['reports.view', 'absences.view', 'payroll.view']
const PAYROLL_TIME_KEYS = ['payroll.view', 'reports.payroll']

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

reportsRouter.get('/payroll-time-tracking', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireAnyPermission(req, res, stationId, PAYROLL_TIME_KEYS)) return
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''
    if (!from || !to) {
      jsonErr(res, 'from und to (YYYY-MM-DD) erforderlich', 400)
      return
    }
    const employmentType = typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined
    const data = calculatePayrollTimeTrackingReport(getDb(), {
      stationId: stationId!,
      fromDate: from,
      toDate: to,
      employmentFilter: employmentType,
    })
    jsonOk(res, data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

reportsRouter.get('/payroll-schedule', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireAnyPermission(req, res, stationId, PAYROLL_TIME_KEYS)) return
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''
    if (!from || !to) {
      jsonErr(res, 'from und to (YYYY-MM-DD) erforderlich', 400)
      return
    }
    const employmentType = typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined
    const data = calculatePayrollScheduleReport(getDb(), {
      stationId: stationId!,
      fromDate: from,
      toDate: to,
      employmentFilter: employmentType,
    })
    jsonOk(res, data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

reportsRouter.get('/payroll-combined', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireAnyPermission(req, res, stationId, PAYROLL_TIME_KEYS)) return
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''
    if (!from || !to) {
      jsonErr(res, 'from und to (YYYY-MM-DD) erforderlich', 400)
      return
    }
    const employmentType = typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined
    const employeeIds = typeof req.query.employeeIds === 'string' ? req.query.employeeIds : undefined
    const data = calculatePayrollCombinedReport(getDb(), {
      stationId: stationId!,
      fromDate: from,
      toDate: to,
      employmentFilter: employmentType,
      employeeIds,
    })
    jsonOk(res, data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

reportsRouter.get('/payroll-time-tracking/time-entries', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireAnyPermission(req, res, stationId, PAYROLL_TIME_KEYS)) return
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''
    if (!from || !to) {
      jsonErr(res, 'from und to (YYYY-MM-DD) erforderlich', 400)
      return
    }
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId.trim() : undefined
    const items = listPayrollTimeEntryDetails(getDb(), {
      stationId: stationId!,
      fromDate: from,
      toDate: to,
      employeeId: employeeId || undefined,
    })
    jsonOk(res, { stationId: stationId!, fromDate: from, toDate: to, items })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})
