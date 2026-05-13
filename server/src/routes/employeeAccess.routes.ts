import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as access from '../services/employeeAccessService.js'
import { revokeDeviceForEmployeeSelf } from '../services/employeeAppDeviceService.js'

export const employeeAccessRouter = Router()

const denied = () => access.EMPLOYEE_APP_ACCESS_DENIED_MESSAGE

employeeAccessRouter.get('/:token/week-schedule', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined
    const out = access.buildEmployeeWeekSchedule(getDb(), req.params.token, weekStart, meta)
    if (!out.ok) return jsonErr(res, denied(), 403)
    jsonOk(res, out)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.get('/:token/absences', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessListAbsences(getDb(), req.params.token, meta)
    if (!out.ok) return jsonErr(res, denied(), 403)
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/absences', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessCreateAbsence(getDb(), req.params.token, req.body ?? {}, meta)
    if (!out.ok) {
      if (out.error === 'invalid_token') return jsonErr(res, denied(), 403)
      return res.status(409).json({
        ok: false,
        code: 'VACATION_ACK_REQUIRED',
        error:
          typeof out.details?.message === 'string'
            ? out.details.message
            : 'Resturlaub reicht nicht aus. Bitte mit Bestätigung erneut senden.',
        details: out.details,
      })
    }
    jsonOk(res, out.data, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeeAccessRouter.get('/:token/tasks', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessGetTasks(getDb(), req.params.token, meta)
    if (!out.ok) return jsonErr(res, denied(), 403)
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/tasks/:taskId/confirm', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const body = (req.body ?? {}) as { comment?: string }
    const out = access.employeeAccessConfirmTask(getDb(), req.params.token, req.params.taskId, {
      comment: typeof body.comment === 'string' ? body.comment : undefined,
    }, meta)
    if (!out.ok) {
      return jsonErr(res, out.error === 'not_allowed' ? 'Aufgabe nicht erlaubt.' : denied(), 403)
    }
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeeAccessRouter.get('/:token/shift-warnings/active', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessListShiftWarnings(getDb(), req.params.token, meta)
    if (!out.ok) return jsonErr(res, denied(), 403)
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/shift-warnings/:warningId/acknowledge', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessAcknowledgeShiftWarning(getDb(), req.params.token, req.params.warningId, meta)
    if (!out.ok) return jsonErr(res, 'Zugang ungültig oder Bestätigung fehlgeschlagen.', 403)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeeAccessRouter.post('/:token/revoke-this-device', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const db = getDb()
    const row = access.getEmployeeRowByAccessToken(db, req.params.token)
    const d = meta.deviceId.trim()
    if (!d) return jsonErr(res, 'Geräte-ID fehlt (Header X-Employee-Device-Id).', 400)
    if (!access.validateEmployeeAppAccess(db, row, d)) {
      return jsonErr(res, denied(), 403)
    }
    revokeDeviceForEmployeeSelf(db, row!.id, d)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeeAccessRouter.get('/:token', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.buildEmployeeAccessPayload(getDb(), req.params.token, meta)
    if (!out.ok) return jsonErr(res, denied(), 403)
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
      activeShiftWarnings: out.activeShiftWarnings,
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/check-in', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const force = Boolean((req.body as { force?: boolean })?.force)
    const out = access.employeeAccessCheckIn(getDb(), req.params.token, force, meta)
    if (!out.ok) {
      if (out.result === 'invalid_token') {
        return jsonErr(res, out.message, 403)
      }
      return res.status(200).json({
        ok: false,
        error: out.message,
        result: out.result,
        ...('employee' in out ? { employee: out.employee } : {}),
        ...('timeEntry' in out ? { timeEntry: out.timeEntry } : {}),
        ...('plannedStart' in out ? { plannedStart: (out as { plannedStart?: string }).plannedStart } : {}),
        ...('minutesLate' in out ? { minutesLate: (out as { minutesLate?: number }).minutesLate } : {}),
        ...('warnings' in out ? { warnings: (out as { warnings?: unknown }).warnings } : {}),
        ...('requiresWarningAcknowledgement' in out
          ? { requiresWarningAcknowledgement: (out as { requiresWarningAcknowledgement?: boolean }).requiresWarningAcknowledgement }
          : {}),
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
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessCheckOutStart(getDb(), req.params.token, meta)
    if (!out.ok) {
      if (out.result === 'invalid_token') {
        return jsonErr(res, out.message, 403)
      }
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
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const body = req.body as { timeEntryId?: string; checklist?: Record<string, unknown> }
    const out = access.employeeAccessCheckOutComplete(
      getDb(),
      req.params.token,
      {
        timeEntryId: String(body.timeEntryId ?? ''),
        checklist: body.checklist ?? {},
      },
      meta,
    )
    if (!out.ok) {
      if (out.error === access.EMPLOYEE_APP_ACCESS_DENIED_MESSAGE) {
        return jsonErr(res, out.error, 403)
      }
      return jsonErr(res, out.error, 400)
    }
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
