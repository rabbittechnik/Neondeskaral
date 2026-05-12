import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as access from '../services/employeeAccessService.js'

export const employeeAccessRouter = Router()

employeeAccessRouter.get('/:token/week-schedule', (req, res) => {
  try {
    const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined
    const out = access.buildEmployeeWeekSchedule(getDb(), req.params.token, weekStart)
    if (!out.ok) return jsonErr(res, 'Zugang ungültig oder deaktiviert.', 403)
    jsonOk(res, out)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.get('/:token/absences', (req, res) => {
  try {
    const out = access.employeeAccessListAbsences(getDb(), req.params.token)
    if (!out.ok) return jsonErr(res, 'Zugang ungültig oder deaktiviert.', 403)
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/absences', (req, res) => {
  try {
    const out = access.employeeAccessCreateAbsence(getDb(), req.params.token, req.body ?? {})
    if (!out.ok) return jsonErr(res, 'Zugang ungültig oder deaktiviert.', 403)
    jsonOk(res, out.data, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeeAccessRouter.get('/:token/tasks', (req, res) => {
  try {
    const out = access.employeeAccessGetTasks(getDb(), req.params.token)
    if (!out.ok) return jsonErr(res, 'Zugang ungültig oder deaktiviert.', 403)
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/tasks/:taskId/confirm', (req, res) => {
  try {
    const body = (req.body ?? {}) as { comment?: string }
    const out = access.employeeAccessConfirmTask(getDb(), req.params.token, req.params.taskId, {
      comment: typeof body.comment === 'string' ? body.comment : undefined,
    })
    if (!out.ok) {
      const code = out.error === 'not_allowed' ? 403 : 403
      return jsonErr(res, out.error === 'not_allowed' ? 'Aufgabe nicht erlaubt.' : 'Zugang ungültig oder deaktiviert.', code)
    }
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeeAccessRouter.get('/:token', (req, res) => {
  try {
    const out = access.buildEmployeeAccessPayload(getDb(), req.params.token)
    if (!out.ok) return jsonErr(res, 'Zugang ungültig oder deaktiviert.', 403)
    jsonOk(res, {
      employee: out.employee,
      station: out.station,
      workAreas: out.workAreas,
      shifts: out.shifts,
      tasks: out.tasks,
      taskLogs: out.taskLogs,
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
