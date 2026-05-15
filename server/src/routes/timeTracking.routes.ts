import { Router } from 'express'
import { getDb } from '../db/database.js'
import { jsonErr, jsonOk } from '../utils/http.js'
import { requirePermission, requireAnyPermission } from '../middleware/stationAuth.js'
import * as timeTracking from '../services/timeTrackingService.js'
import { prunePlaceholderTimeEntries } from '../services/timeEntryPlaceholderService.js'
import * as timeEntryCorrections from '../services/timeEntryCorrectionService.js'
import * as terminal from '../services/terminalService.js'
import { updateShiftChecklistReviewItems } from '../services/shiftChecklistReviewService.js'
import type { BackshopItemSnapshot } from '../services/backshopRoutineService.js'
import {
  resolveTerminalStationIdFromBody,
  touchTabletByToken,
} from '../services/stationTabletDeviceService.js'

export const timeEntriesRouter = Router()

timeEntriesRouter.get('/running', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'time.view')) return
    jsonOk(res, timeTracking.listRunning(getDb(), stationId!))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.get('/today', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'time.view')) return
    jsonOk(res, timeTracking.listToday(getDb(), stationId!))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.get('/pending-approval', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requireAnyPermission(req, res, stationId, ['time.approve', 'time.correct'])) return
    jsonOk(res, {
      items: timeTracking.listPendingApproval(getDb(), stationId!),
      count: timeTracking.countPendingApproval(getDb(), stationId!),
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.get('/card-events', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'time.view')) return
    const from = typeof req.query.from === 'string' ? req.query.from : undefined
    const to = typeof req.query.to === 'string' ? req.query.to : undefined
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined
    jsonOk(
      res,
      timeTracking.listCardEntryEvents(getDb(), {
        stationId: stationId!,
        from,
        to,
        employeeId,
      }),
    )
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.get('/', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'time.view')) return
    jsonOk(
      res,
      timeTracking.listTimeEntries(getDb(), {
        stationId: stationId!,
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

timeEntriesRouter.post('/prune-placeholders', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'time.correct')) return
    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true'
    const out = prunePlaceholderTimeEntries(getDb(), stationId!, { dryRun })
    jsonOk(res, { ...out, dryRun })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.post('/manual', (req, res) => {
  try {
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined
    if (!requirePermission(req, res, stationId, 'time.correct')) return
    jsonOk(res, timeTracking.createManualTimeEntry(getDb(), req.body ?? {}, stationId!), 201)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.post('/:id/checklist-review', (req, res) => {
  try {
    const row = timeTracking.getTimeEntryRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'time.approve')) return
    const body = (req.body ?? {}) as {
      items?: { id: string; reviewChecked: boolean; reviewComment?: string }[]
    }
    const items = Array.isArray(body.items) ? body.items : []
    const uid = req.adminUser!.sub
    updateShiftChecklistReviewItems(getDb(), {
      timeEntryId: req.params.id,
      stationId: row.station_id,
      employeeId: row.employee_id,
      items,
      reviewedBy: uid,
    })
    const d = timeTracking.getTimeEntryDetail(getDb(), req.params.id)
    jsonOk(res, d)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.get('/:id/detail', (req, res) => {
  try {
    const row = timeTracking.getTimeEntryRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    if (!requireAnyPermission(req, res, row.station_id, ['time.approve', 'time.correct'])) return
    const d = timeTracking.getTimeEntryDetail(getDb(), req.params.id)
    if (!d) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    jsonOk(res, d)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.post('/:id/approve', (req, res) => {
  try {
    const row = timeTracking.getTimeEntryRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'time.approve')) return
    const uid = req.adminUser!.sub
    jsonOk(res, timeTracking.approveTimeEntry(getDb(), req.params.id, uid))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.post('/:id/reject', (req, res) => {
  try {
    const row = timeTracking.getTimeEntryRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'time.approve')) return
    const uid = req.adminUser!.sub
    const reason = String((req.body as { rejectionReason?: string })?.rejectionReason ?? '').trim()
    jsonOk(res, timeTracking.rejectTimeEntry(getDb(), req.params.id, uid, reason))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.post('/:id/request-correction', (req, res) => {
  try {
    const row = timeTracking.getTimeEntryRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'time.approve')) return
    const note = String((req.body as { correctionNote?: string })?.correctionNote ?? '').trim()
    jsonOk(res, timeTracking.requestTimeEntryCorrection(getDb(), req.params.id, note))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.post('/:id/correct-times', (req, res) => {
  try {
    const row = timeTracking.getTimeEntryRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    if (!requireAnyPermission(req, res, row.station_id, ['time.approve', 'time.correct'])) return
    const b = (req.body ?? {}) as Record<string, unknown>
    const out = timeEntryCorrections.insertManualTimeCorrection(
      getDb(),
      req.params.id,
      {
        correctedStartAt: typeof b.correctedStartAt === 'string' ? b.correctedStartAt : undefined,
        correctedEndAt: typeof b.correctedEndAt === 'string' ? b.correctedEndAt : undefined,
        workDateYmdBerlin: typeof b.workDateYmdBerlin === 'string' ? b.workDateYmdBerlin : undefined,
        correctedStartHm: typeof b.correctedStartHm === 'string' ? b.correctedStartHm : undefined,
        correctedEndHm: typeof b.correctedEndHm === 'string' ? b.correctedEndHm : undefined,
        breakMinutes: Number(b.breakMinutes ?? 0),
        reason: String(b.reason ?? ''),
        note: typeof b.note === 'string' ? b.note : undefined,
      },
      req.adminUser!.sub,
      String(req.adminUser?.displayName || req.adminUser?.username || '').trim(),
    )
    jsonOk(res, {
      correction: timeEntryCorrections.rowToCorrectionApi(out),
      detail: timeTracking.getTimeEntryDetail(getDb(), req.params.id),
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.get('/:id', (req, res) => {
  try {
    const row = timeTracking.getTimeEntryRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'time.view')) return
    const e = timeTracking.getTimeEntry(getDb(), req.params.id)
    if (!e) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    jsonOk(res, e)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

timeEntriesRouter.put('/:id', (req, res) => {
  try {
    const row = timeTracking.getTimeEntryRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'time.correct')) return
    jsonOk(res, timeTracking.updateTimeEntry(getDb(), req.params.id, req.body ?? {}))
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

timeEntriesRouter.post('/:id/close', (req, res) => {
  try {
    const row = timeTracking.getTimeEntryRow(getDb(), req.params.id)
    if (!row) return jsonErr(res, 'Zeiteintrag nicht gefunden', 404)
    if (!requirePermission(req, res, row.station_id, 'time.correct')) return
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
    ...(out.requiresConfirmation === true ? { requiresConfirmation: true } : {}),
    ...(typeof out.reason === 'string' ? { reason: out.reason } : {}),
    ...(typeof out.actualStart === 'string' ? { actualStart: out.actualStart } : {}),
    ...(typeof out.deviationMinutes === 'number' || out.deviationMinutes === null
      ? { deviationMinutes: out.deviationMinutes }
      : {}),
    ...('plannedStart' in out ? { plannedStart: out.plannedStart } : {}),
    ...('plannedEnd' in out ? { plannedEnd: out.plannedEnd } : {}),
    ...('plannedStartAt' in out ? { plannedStartAt: out.plannedStartAt } : {}),
    ...('plannedEndAt' in out ? { plannedEndAt: out.plannedEndAt } : {}),
    ...('displayText' in out ? { displayText: out.displayText } : {}),
    ...('employee' in out ? { employee: out.employee } : {}),
    ...('timeEntry' in out ? { timeEntry: out.timeEntry } : {}),
    ...('minutesLate' in out ? { minutesLate: out.minutesLate } : {}),
    ...('warnings' in out ? { warnings: out.warnings } : {}),
    ...('requiresWarningAcknowledgement' in out
      ? { requiresWarningAcknowledgement: out.requiresWarningAcknowledgement }
      : {}),
  }
}

terminalRouter.post('/check-in', (req, res) => {
  try {
    const raw = { ...(req.body ?? {}) } as Record<string, unknown>
    const stationFromToken = resolveTerminalStationIdFromBody(getDb(), raw, req)
    if (!stationFromToken) {
      return jsonErr(res, 'stationId oder gültiger tabletToken erforderlich', 400)
    }
    raw.stationId = stationFromToken
    const card = String((raw as { cardNumber?: string }).cardNumber ?? '').trim()
    const empId = String((raw as { employeeId?: string }).employeeId ?? '').trim()
    const shiftIdIn = String((raw as { shiftId?: string }).shiftId ?? '').trim()
    const forceIn = Boolean((raw as { force?: boolean }).force)
    console.log('terminal check-in request', {
      stationId: stationFromToken,
      employeeId: empId || undefined,
      shiftId: shiftIdIn || undefined,
      force: forceIn,
      viaCard: Boolean(card),
    })
    const out = terminal.terminalCheckIn(
      getDb(),
      raw as { cardNumber?: string; employeeId?: string; stationId: string; force?: boolean; shiftId?: string },
    )
    if (!out.ok) {
      console.log('terminal check-in rejected', { stationId: stationFromToken, result: (out as { result?: string }).result })
      return res.status(200).json(terminalCheckInErrorBody(out as unknown as Record<string, unknown>))
    }
    console.log('terminal check-in ok', {
      stationId: stationFromToken,
      employeeId: (out as { employee?: { id?: string } }).employee?.id,
    })
    jsonOk(res, {
      result: out.result,
      message: out.message,
      employee: out.employee,
      timeEntry: out.timeEntry,
      ...('bakingNotice' in out && out.bakingNotice ? { bakingNotice: out.bakingNotice } : {}),
    })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

terminalRouter.post('/baking-notice', (req, res) => {
  try {
    const raw = { ...(req.body ?? {}) } as Record<string, unknown>
    const stationFromToken = resolveTerminalStationIdFromBody(getDb(), raw, req)
    if (!stationFromToken) {
      return jsonErr(res, 'stationId oder gültiger tabletToken erforderlich', 400)
    }
    const timeEntryId = String((raw as { timeEntryId?: string }).timeEntryId ?? '').trim()
    const remark = (raw as { remark?: string }).remark
    const out = terminal.terminalAckBakingNotice(getDb(), {
      stationId: stationFromToken,
      timeEntryId,
      remark: remark != null ? String(remark) : undefined,
      routineType: raw.routineType != null ? String(raw.routineType) : undefined,
      routineId: raw.routineId === undefined ? undefined : raw.routineId === null ? null : String(raw.routineId),
      title: raw.title != null ? String(raw.title) : undefined,
      itemSnapshots: Array.isArray(raw.itemSnapshots) ? (raw.itemSnapshots as BackshopItemSnapshot[]) : undefined,
      items: Array.isArray(raw.items) ? (raw.items as string[]) : undefined,
    })
    if (!out.ok) return res.status(200).json({ ok: false, error: out.error })
    jsonOk(res, { saved: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 500)
  }
})

terminalRouter.post('/check-out-start', (req, res) => {
  try {
    const raw = { ...(req.body ?? {}) } as Record<string, unknown>
    const stationFromToken = resolveTerminalStationIdFromBody(getDb(), raw, req)
    if (!stationFromToken) return jsonErr(res, 'stationId oder gültiger tabletToken erforderlich', 400)
    raw.stationId = stationFromToken
    const out = terminal.terminalCheckOutStart(
      getDb(),
      raw as { cardNumber?: string; employeeId?: string; stationId: string },
    )
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

terminalRouter.post('/check-out', (req, res) => {
  try {
    const raw = { ...(req.body ?? {}) } as Record<string, unknown>
    const stationFromToken = resolveTerminalStationIdFromBody(getDb(), raw, req)
    if (!stationFromToken) return jsonErr(res, 'stationId oder gültiger tabletToken erforderlich', 400)
    raw.stationId = stationFromToken
    const tt = typeof raw.tabletToken === 'string' ? raw.tabletToken.trim() : ''
    if (tt) touchTabletByToken(getDb(), tt, req)
    const out = terminal.terminalCheckOutFull(
      getDb(),
      raw as {
        stationId: string
        employeeId: string
        timeEntryId?: string
        confirmedAllDone: boolean
        notDoneItems?: { itemKey: string; reason: string }[]
        cashDifference?: number
        force?: boolean
        earlyLeaveAck?: { reason: string; note?: string | null }
      },
    )
    if (!out.ok) {
      if ('requiresEarlyLeaveReason' in out && out.requiresEarlyLeaveReason) {
        return res.status(200).json({
          ok: false,
          requiresEarlyLeaveReason: true,
          plannedEnd: out.plannedEnd,
          actualEnd: out.actualEnd,
          deviationMinutes: out.deviationMinutes,
          message: out.message,
        })
      }
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
      if ('result' in out && (out as { result?: string }).result === 'not_checked_in') {
        return res.status(200).json({
          ok: false,
          error: (out as { message?: string }).message,
          result: 'not_checked_in',
        })
      }
      return jsonErr(res, 'error' in out ? out.error : 'Auscheck fehlgeschlagen', 400)
    }
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

terminalRouter.post('/check-out-complete', (req, res) => {
  try {
    const raw = { ...(req.body ?? {}) } as Record<string, unknown>
    const tt = typeof raw.tabletToken === 'string' ? raw.tabletToken.trim() : ''
    if (tt) touchTabletByToken(getDb(), tt, req)
    const out = terminal.terminalCheckOutComplete(
      getDb(),
      raw as {
        timeEntryId: string
        checklist: Record<string, unknown>
        cardNumber?: string
        force?: boolean
        taskCloseDeclarations?: { taskId: string; outcome: 'done' | 'not_done'; notDoneReason?: string }[]
        taskCloseAccuracyConfirmed?: boolean
        earlyLeaveAck?: { reason: string; note?: string | null }
      },
    )
    if (!out.ok) {
      if ('requiresEarlyLeaveReason' in out && out.requiresEarlyLeaveReason) {
        return res.status(200).json({
          ok: false,
          requiresEarlyLeaveReason: true,
          plannedEnd: out.plannedEnd,
          actualEnd: out.actualEnd,
          deviationMinutes: out.deviationMinutes,
          message: out.message,
        })
      }
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
      return jsonErr(res, 'error' in out ? out.error : 'Ausstempeln fehlgeschlagen', 400)
    }
    jsonOk(res, out.data)
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})

terminalRouter.post('/shift-warnings/acknowledge', (req, res) => {
  try {
    const raw = { ...(req.body ?? {}) } as Record<string, unknown>
    const stationResolved = resolveTerminalStationIdFromBody(getDb(), raw, req)
    if (!stationResolved) return jsonErr(res, 'stationId oder gültiger tabletToken erforderlich', 400)
    raw.stationId = stationResolved
    const body = raw as { cardNumber?: string; employeeId?: string; stationId?: string; warningId?: string }
    const card = String(body.cardNumber ?? '').trim()
    const employeeId = String(body.employeeId ?? '').trim()
    const stationId = String(body.stationId ?? '').trim()
    const warningId = String(body.warningId ?? '').trim()
    if (!stationId || !warningId) return jsonErr(res, 'stationId und warningId erforderlich', 400)
    if (!card && !employeeId) return jsonErr(res, 'cardNumber oder employeeId erforderlich', 400)
    const out = terminal.terminalAcknowledgeShiftWarning(getDb(), {
      cardNumber: card || undefined,
      employeeId: employeeId || undefined,
      stationId,
      warningId,
    })
    if (!out.ok) return jsonErr(res, out.message, 400)
    jsonOk(res, { ok: true })
  } catch (e) {
    jsonErr(res, e instanceof Error ? e.message : 'Fehler', 400)
  }
})
