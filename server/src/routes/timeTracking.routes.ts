import { Router } from 'express'
import { getDb } from '../db/database.js'
import { canUserApproveTimeEntries } from '../constants/timeApproval.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import * as timeTracking from '../services/timeTrackingService.js'
import * as terminal from '../services/terminalService.js'

export const timeEntriesRouter = Router()

function requireTimeApprover(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  if (!canUserApproveTimeEntries(req.adminUser?.sub)) {
    jsonErr(res, 'Keine Berechtigung für Zeitfreigaben', 403)
    return
  }
  next()
}

timeEntriesRouter.get('/running', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, timeTracking.listRunning(getDb(), stationId))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.get('/today', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, timeTracking.listToday(getDb(), stationId))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.get('/pending-approval', requireTimeApprover, (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, {
      items: timeTracking.listPendingApproval(getDb(), stationId),
      count: timeTracking.countPendingApproval(getDb(), stationId),
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.get('/', (req, res) => {
  try {
    jsonOk(
      res,
      timeTracking.listTimeEntries(getDb(), {
        stationId: typeof req.query.stationId === 'string' ? req.query.stationId : undefined,
        employeeId: typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.post('/manual', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    jsonOk(res, timeTracking.createManualTimeEntry(getDb(), req.body ?? {}, stationId), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.get('/:id/detail', requireTimeApprover, (req, res) => {
  try {
    const d = timeTracking.getTimeEntryDetail(getDb(), req.params.id)
    if (!d) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    jsonOk(res, d)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.post('/:id/approve', requireTimeApprover, (req, res) => {
  try {
    const uid = req.adminUser!.sub
    jsonOk(res, timeTracking.approveTimeEntry(getDb(), req.params.id, uid))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.post('/:id/reject', requireTimeApprover, (req, res) => {
  try {
    const uid = req.adminUser!.sub
    const reason = String((req.body as { rejectionReason?: string })?.rejectionReason ?? '').trim()
    jsonOk(res, timeTracking.rejectTimeEntry(getDb(), req.params.id, uid, reason))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.post('/:id/request-correction', requireTimeApprover, (req, res) => {
  try {
    const note = String((req.body as { correctionNote?: string })?.correctionNote ?? '').trim()
    jsonOk(res, timeTracking.requestTimeEntryCorrection(getDb(), req.params.id, note))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.get('/:id', (req, res) => {
  try {
    const e = timeTracking.getTimeEntry(getDb(), req.params.id)
    if (!e) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    jsonOk(res, e)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.put('/:id', (req, res) => {
  try {
    jsonOk(res, timeTracking.updateTimeEntry(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.post('/:id/close', (req, res) => {
  try {
    const endedBy = typeof (req.body as { endedBy?: string })?.endedBy === 'string' ? (req.body as { endedBy: string }).endedBy : undefined
    jsonOk(res, timeTracking.closeTimeEntry(getDb(), req.params.id, endedBy))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

export const terminalRouter = Router()

function terminalCheckInErrorBody(out: Record<string, unknown>) {
  return {
    ok: false,
    error: out.message,
    result: out.result,
    ...('employee' in out ? { employee: out.employee } : {}),
    ...('timeEntry' in out ? { timeEntry: out.timeEntry } : {}),
    ...('plannedStart' in out ? { plannedStart: out.plannedStart } : {}),
    ...('minutesLate' in out ? { minutesLate: out.minutesLate } : {}),
  }
}

terminalRouter.post('/check-in', (req, res) => {
  try {
    const out = terminal.terminalCheckIn(getDb(), (req.body ?? {}) as { cardNumber: string; stationId: string; force?: boolean })
    if (!out.ok) {
      return res.status(200).json(terminalCheckInErrorBody(out as unknown as Record<string, unknown>))
    }
    jsonOk(res, { result: out.result, message: out.message, employee: out.employee, timeEntry: out.timeEntry })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

terminalRouter.post('/check-out-start', (req, res) => {
  try {
    const out = terminal.terminalCheckOutStart(getDb(), (req.body ?? {}) as { cardNumber: string; stationId: string })
    if (!out.ok) {
      return res.status(200).json({
        ok: false,
        error: out.message,
        result: out.result,
        ...('employee' in out ? { employee: out.employee } : {}),
        ...('timeEntry' in out ? { timeEntry: out.timeEntry } : {}),
      })
    }
    jsonOk(res, { result: out.result, message: out.message, employee: out.employee, timeEntry: out.timeEntry })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

terminalRouter.post('/check-out-complete', (req, res) => {
  try {
    const out = terminal.terminalCheckOutComplete(getDb(), (req.body ?? {}) as { timeEntryId: string; checklist: Record<string, unknown> })
    if (!out.ok) return jsonErr(res, out.error, 400)
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
