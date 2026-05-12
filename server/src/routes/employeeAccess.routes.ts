import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as access from '../services/employeeAccessService.js'

export const employeeAccessRouter = Router()

employeeAccessRouter.get('/:token', (req, res) => {
  try {
    const out = access.buildEmployeeAccessPayload(getDb(), req.params.token)
    if (!out.ok) return jsonErr(res, 'Zugang ungültig oder deaktiviert.', 403)
    jsonOk(res, {
      employee: out.employee,
      station: out.station,
      shifts: out.shifts,
      tasks: out.tasks,
      absences: out.absences,
      timeEntries: out.timeEntries,
      runningTimeEntry: out.runningTimeEntry,
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/check-in', (req, res) => {
  try {
    const force = Boolean((req.body as { force?: boolean })?.force)
    const out = access.employeeAccessCheckIn(getDb(), req.params.token, force)
    if (!out.ok) {
      return res.status(200).json({
        ok: false,
        error: out.message,
        result: out.result,
        ...('employee' in out ? { employee: out.employee } : {}),
        ...('timeEntry' in out ? { timeEntry: out.timeEntry } : {}),
        ...('plannedStart' in out ? { plannedStart: (out as { plannedStart?: string }).plannedStart } : {}),
        ...('minutesLate' in out ? { minutesLate: (out as { minutesLate?: number }).minutesLate } : {}),
      })
    }
    jsonOk(res, {
      result: out.result,
      message: out.message,
      employee: out.employee,
      timeEntry: out.timeEntry,
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/check-out-start', (req, res) => {
  try {
    const out = access.employeeAccessCheckOutStart(getDb(), req.params.token)
    if (!out.ok) {
      return res.status(200).json({
        ok: false,
        error: out.message,
        result: out.result,
        ...('employee' in out ? { employee: out.employee } : {}),
        ...('timeEntry' in out ? { timeEntry: out.timeEntry } : {}),
      })
    }
    jsonOk(res, {
      result: out.result,
      message: out.message,
      employee: out.employee,
      timeEntry: out.timeEntry,
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/check-out-complete', (req, res) => {
  try {
    const body = req.body as { timeEntryId?: string; checklist?: Record<string, unknown> }
    const out = access.employeeAccessCheckOutComplete(getDb(), req.params.token, {
      timeEntryId: String(body.timeEntryId ?? ''),
      checklist: body.checklist ?? {},
    })
    if (!out.ok) return jsonErr(res, out.error, 400)
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
