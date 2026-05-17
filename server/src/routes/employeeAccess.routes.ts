import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as access from '../services/employeeAccessService.js'
import type { BackshopItemSnapshot } from '../services/backshopRoutineService.js'
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

employeeAccessRouter.get('/:token/shifts', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const from = typeof req.query.from === 'string' ? req.query.from : ''
    const to = typeof req.query.to === 'string' ? req.query.to : ''
    const out = access.employeeAccessListMyShiftsForRange(getDb(), req.params.token, from, to, meta)
    if (!out.ok) {
      if (out.error === 'invalid_token') return jsonErr(res, denied(), 403)
      return jsonErr(res, 'Ungültiger Zeitraum: from und to als YYYY-MM-DD angeben.', 400)
    }
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.get('/:token/time-entries', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const from = typeof req.query.from === 'string' ? req.query.from : ''
    const to = typeof req.query.to === 'string' ? req.query.to : ''
    const out = access.employeeAccessListTimeEntriesReadModel(getDb(), req.params.token, from, to, meta)
    if (!out.ok) {
      if (out.error === 'invalid_token') return jsonErr(res, denied(), 403)
      return jsonErr(res, 'Ungültiger Zeitraum: from und to als YYYY-MM-DD angeben.', 400)
    }
    jsonOk(res, out.data)
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
      if (out.error === 'use_sick_tab') {
        return jsonErr(
          res,
          'Krankmeldungen bitte unter dem Tab „Krank“ erfassen, nicht im Urlaubsantrag.',
          400,
        )
      }
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

employeeAccessRouter.get('/:token/vacation-balance', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const q = req.query as Record<string, string | undefined>
    const out = access.employeeAccessVacationBalance(getDb(), req.params.token, q, meta)
    if (!out.ok) return jsonErr(res, denied(), 403)
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.get('/:token/sick-reports', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessListSickReports(getDb(), req.params.token, meta)
    if (!out.ok) return jsonErr(res, denied(), 403)
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/sick-reports', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessCreateSickReport(getDb(), req.params.token, req.body ?? {}, meta)
    if (!out.ok) {
      if (out.error === 'invalid_token') return jsonErr(res, denied(), 403)
      if (out.error === 'invalid_dates') return jsonErr(res, 'Bitte gültiges Start- und Enddatum (YYYY-MM-DD) angeben.', 400)
      if (out.error === 'invalid_certificate') {
        return jsonErr(res, 'Bitte angeben, wie die Krankschreibung vorliegt (upload, camera, digital_doctor, will_follow).', 400)
      }
      return jsonErr(res, 'Krankmeldung konnte nicht gespeichert werden.', 400)
    }
    jsonOk(res, out.data, 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

employeeAccessRouter.post('/:token/sick-reports/:id/attachments', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessAddSickReportAttachment(
      getDb(),
      req.params.token,
      req.params.id,
      req.body ?? {},
      meta,
    )
    if (!out.ok) {
      if (out.error === 'invalid_token') return jsonErr(res, denied(), 403)
      if (out.error === 'not_found') return jsonErr(res, 'Eintrag nicht gefunden.', 404)
      if (out.error === 'not_sick') return jsonErr(res, 'Nur bei Krankmeldungen möglich.', 400)
      if (out.error === 'no_file') return jsonErr(res, 'Keine Datei (fileBase64) übermittelt.', 400)
      if (out.error === 'invalid_base64') return jsonErr(res, 'Ungültige Dateiübertragung.', 400)
      return jsonErr(res, typeof out.error === 'string' ? out.error : 'Upload fehlgeschlagen', 400)
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

employeeAccessRouter.get('/:token/payroll-documents', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.employeeAccessListPayrollDocuments(getDb(), req.params.token, meta)
    if (!out.ok) return jsonErr(res, denied(), 403)
    jsonOk(res, { documents: out.documents })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.get('/:token/payroll-documents/:documentId/download', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const inline = req.query.inline === '1' || req.query.inline === 'true'
    const out = access.employeeAccessDownloadPayrollDocument(
      getDb(),
      req.params.token,
      req.params.documentId,
      meta,
      inline,
    )
    if (!out.ok) return jsonErr(res, denied(), 403)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `${out.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(out.downloadName)}`,
    )
    res.sendFile(out.absPath, (err) => {
      if (err && !res.headersSent) res.status(500).json({ ok: false, error: 'Download fehlgeschlagen' })
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.get('/:token/session', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const out = access.buildEmployeeAccessSessionSummary(getDb(), req.params.token, meta)
    if (!out.ok) return jsonErr(res, denied(), 403)
    jsonOk(res, { employee: out.employee, station: out.station })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
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
      tasksShiftClose: out.tasksShiftClose,
      taskLogs: out.taskLogs,
      absences: out.absences,
      vacationSnapshot: out.vacationSnapshot,
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
      ...('bakingNotice' in out && (out as { bakingNotice?: unknown }).bakingNotice
        ? { bakingNotice: (out as { bakingNotice: unknown }).bakingNotice }
        : {}),
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/baking-notice', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const b = (req.body ?? {}) as Record<string, unknown>
    const timeEntryId = String(b.timeEntryId ?? '').trim()
    const remark = b.remark
    const out = access.employeeAccessAcknowledgeBakingNotice(
      getDb(),
      req.params.token,
      {
        timeEntryId,
        remark: remark != null ? String(remark) : undefined,
        routineType: b.routineType != null ? String(b.routineType) : undefined,
        routineId: b.routineId === undefined ? undefined : b.routineId === null ? null : String(b.routineId),
        title: b.title != null ? String(b.title) : undefined,
        itemSnapshots: Array.isArray(b.itemSnapshots) ? (b.itemSnapshots as BackshopItemSnapshot[]) : undefined,
        items: Array.isArray(b.items) ? (b.items as string[]) : undefined,
      },
      meta,
    )
    if (!out.ok) {
      if (out.error === denied()) {
        return jsonErr(res, out.error, 403)
      }
      return res.status(200).json({ ok: false, error: out.error })
    }
    jsonOk(res, { saved: true })
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
      checklistType: out.checklistType,
      items: out.checklistItems,
      wizardGroups: out.wizardGroups,
      blockingTasks: out.blockingTasks,
      handoverUiMode: out.handoverUiMode,
      middayHandoverBullets: out.middayHandoverBullets,
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

employeeAccessRouter.post('/:token/check-out-complete', (req, res) => {
  try {
    const meta = access.parseEmployeeAccessRequestMeta(req)
    const body = req.body as {
      timeEntryId?: string
      checklist?: Record<string, unknown>
      force?: boolean
      taskCloseDeclarations?: { taskId: string; outcome: 'done' | 'not_done'; notDoneReason?: string }[]
      taskCloseAccuracyConfirmed?: boolean
    }
    const out = access.employeeAccessCheckOutComplete(
      getDb(),
      req.params.token,
      {
        timeEntryId: String(body.timeEntryId ?? ''),
        checklist: body.checklist ?? {},
        force: Boolean(body.force),
        taskCloseDeclarations: body.taskCloseDeclarations,
        taskCloseAccuracyConfirmed: body.taskCloseAccuracyConfirmed,
      },
      meta,
    )
    if (!out.ok) {
      if ('requiresConfirmation' in out && out.requiresConfirmation) {
        return res.status(200).json({
          ok: false,
          requiresConfirmation: true,
          reason: out.reason,
          plannedEnd: out.plannedEnd,
          actualEnd: out.actualEnd,
          deviationMinutes: out.deviationMinutes,
          message: out.message,
        })
      }
      if ('error' in out && out.error === access.EMPLOYEE_APP_ACCESS_DENIED_MESSAGE) {
        return jsonErr(res, out.error, 403)
      }
      return jsonErr(res, 'error' in out ? out.error : 'Fehler', 400)
    }
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
