import type { Request, Response } from 'express'
import type { Database } from 'better-sqlite3'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { eachYmdInRangeInclusive } from '../utils/berlinCalendarWorkHours.js'
import { preloadMinimumWageRates } from '../services/minimumWageCache.js'
import { getPayrollCached, setPayrollCached, type PayrollCacheMode } from '../services/payrollCache.js'
import { PayrollPerfTimer, PayrollTimeoutError, runWithPayrollTimeout } from '../services/payrollPerformance.js'
import {
  calculatePayrollCombinedReport,
  calculatePayrollForEmployeeRange,
  calculatePayrollScheduleReport,
  calculatePayrollTimeTrackingReport,
} from '../services/payrollReportService.js'

const PAYROLL_TIMEOUT_MS = 45_000

function parseBoolQuery(v: unknown): boolean {
  if (v === '1' || v === 'true') return true
  return false
}

function daysBetween(from: string, to: string): number {
  return eachYmdInRangeInclusive(from, to).length
}

function handlePayroll<T>(
  res: Response,
  meta: { endpoint: string; stationId: string; from: string; to: string; mode: PayrollCacheMode; cacheExtra?: string },
  compute: (db: Database, timer: PayrollPerfTimer) => T,
  counts?: (data: T) => Partial<{
    employeeCount: number
    shiftCount: number
    timeEntryCount: number
    absenceCount: number
    resultRowsCount: number
  }>,
): void {
  const timer = new PayrollPerfTimer({
    endpoint: meta.endpoint,
    stationId: meta.stationId,
    from: meta.from,
    to: meta.to,
    mode: meta.mode,
    daysCount: daysBetween(meta.from, meta.to),
  })

  const cached = getPayrollCached<T>(meta.mode, meta.stationId, meta.from, meta.to, meta.cacheExtra)
  if (cached) {
    timer.finish({ cached: true, resultRowsCount: counts?.(cached)?.resultRowsCount })
    jsonOk(res, cached)
    return
  }

  try {
    const db = getDb()
    timer.start('preload wages')
    preloadMinimumWageRates(db)
    timer.end('preload wages')

    const data = runWithPayrollTimeout(PAYROLL_TIMEOUT_MS, () => compute(db, timer))
    setPayrollCached(meta.mode, meta.stationId, meta.from, meta.to, data, meta.cacheExtra)
    timer.finish(counts?.(data))
    jsonOk(res, data)
  } catch (e) {
    timer.finish()
    if (e instanceof PayrollTimeoutError) {
      jsonErr(res, e.message, 504)
      return
    }
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
}

export function payrollTimeTrackingHandler(req: Request, res: Response): void {
  const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : ''
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''
  const employmentType = typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined
  const employeeIds = typeof req.query.employeeIds === 'string' ? req.query.employeeIds : undefined
  const includeDetailLines = parseBoolQuery(req.query.includeDetailLines)

  handlePayroll(
    res,
    {
      endpoint: 'payroll-time-tracking',
      stationId,
      from,
      to,
      mode: 'time',
      cacheExtra: `${employmentType ?? 'all'}|${employeeIds ?? ''}|d=${includeDetailLines ? '1' : '0'}`,
    },
    (db, timer) => {
      timer.start('load employees')
      timer.start('calculate')
      const data = calculatePayrollTimeTrackingReport(db, {
        stationId,
        fromDate: from,
        toDate: to,
        employmentFilter: employmentType,
        employeeIds,
        includeDetailLines,
      })
      timer.end('calculate')
      timer.end('load employees')
      return data
    },
    (data) => ({ resultRowsCount: data.rows.length, employeeCount: data.rows.length }),
  )
}

export function payrollScheduleHandler(req: Request, res: Response): void {
  const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : ''
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''
  const employmentType = typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined
  const employeeIds = typeof req.query.employeeIds === 'string' ? req.query.employeeIds : undefined
  const includeDetailLines = parseBoolQuery(req.query.includeDetailLines)

  handlePayroll(
    res,
    {
      endpoint: 'payroll-schedule',
      stationId,
      from,
      to,
      mode: 'schedule',
      cacheExtra: `${employmentType ?? 'all'}|${employeeIds ?? ''}|d=${includeDetailLines ? '1' : '0'}`,
    },
    (db, timer) => {
      timer.start('calculate')
      const data = calculatePayrollScheduleReport(db, {
        stationId,
        fromDate: from,
        toDate: to,
        employmentFilter: employmentType,
        employeeIds,
        includeDetailLines,
      })
      timer.end('calculate')
      return data
    },
    (data) => ({ resultRowsCount: data.rows.length, employeeCount: data.rows.length }),
  )
}

export function payrollCombinedHandler(req: Request, res: Response): void {
  const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : ''
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''
  const employmentType = typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined
  const employeeIds = typeof req.query.employeeIds === 'string' ? req.query.employeeIds : undefined
  const includeDetails = parseBoolQuery(req.query.includeDetails)

  const mode: PayrollCacheMode = includeDetails ? 'combined' : 'combined_summary'
  const cacheExtra = `${employmentType ?? 'all'}|${employeeIds ?? ''}|d=${includeDetails ? '1' : '0'}`

  handlePayroll(
    res,
    { endpoint: 'payroll-combined', stationId, from, to, mode, cacheExtra },
    (db, timer) => {
      timer.start('calculate')
      const data = calculatePayrollCombinedReport(db, {
        stationId,
        fromDate: from,
        toDate: to,
        employmentFilter: employmentType,
        employeeIds,
        includeDetails,
      })
      timer.end('calculate')
      return data
    },
    (data) => ({ resultRowsCount: data.rows.length, employeeCount: data.rows.length }),
  )
}

export function payrollCombinedEmployeeHandler(req: Request, res: Response): void {
  const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : ''
  const employeeId = typeof req.params.employeeId === 'string' ? req.params.employeeId.trim() : ''
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''

  const timer = new PayrollPerfTimer({
    endpoint: 'payroll-combined/employee',
    stationId,
    from,
    to,
    mode: 'employee',
    daysCount: daysBetween(from, to),
  })

  const cached = getPayrollCached<ReturnType<typeof calculatePayrollForEmployeeRange>>(
    'employee',
    stationId,
    from,
    to,
    employeeId,
  )
  if (cached) {
    timer.finish({ cached: true, resultRowsCount: 1 })
    jsonOk(res, cached)
    return
  }

  try {
    const db = getDb()
    preloadMinimumWageRates(db)
    timer.start('calculate')
    const data = runWithPayrollTimeout(PAYROLL_TIMEOUT_MS, () =>
      calculatePayrollForEmployeeRange(db, { stationId, employeeId, fromDate: from, toDate: to }),
    )
    timer.end('calculate')
    if (!data) {
      timer.finish()
      jsonErr(res, 'Keine Daten für diesen Mitarbeiter im Zeitraum', 404)
      return
    }
    setPayrollCached('employee', stationId, from, to, data, employeeId)
    timer.finish({ resultRowsCount: 1, employeeCount: 1 })
    jsonOk(res, data)
  } catch (e) {
    timer.finish()
    if (e instanceof PayrollTimeoutError) {
      jsonErr(res, e.message, 504)
      return
    }
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
}
