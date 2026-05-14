import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'
import { listShiftRowsForStationDateRange, type ShiftRow } from './shiftService.js'
import { listReviewItemsForTimeEntry, syncReviewItemsFromCloseChecklist, syncReviewItemsFromShiftCloseItems } from './shiftChecklistReviewService.js'
import { createShiftWarningsFromShiftCloseCheckout } from './employeeShiftWarningService.js'
import type { ParsedStructuredChecklist } from '../utils/shiftCloseChecklistValidate.js'
import { listShiftCloseTaskResponsesJoined } from './shiftCheckoutBlockingTasksService.js'
import { getBackshopAckByTimeEntryId, getLegacyShiftBakingNotice } from './backshopNoticeAckService.js'
import { resolveBackshopNoticeForStationAndDate, routineTypeLabelDe } from './backshopRoutineService.js'
import { isEarlyShiftForBakingNotice } from './earlyShiftForBaking.js'
import { ymdBerlinFromUtcMs } from '../utils/europeBerlinWallTime.js'
import {
  effectiveTimeBounds,
  listCorrectionsForTimeEntry,
  loadLatestCorrectionsMapForIds,
  rowToCorrectionApi,
} from './timeEntryCorrectionService.js'
import {
  MIDDAY_COLLECTIVE_HANDOVER_VARIANT,
  MIDDAY_STANDARD_HANDOVER_LABELS,
} from '../constants/middayStandardHandover.js'

export type TimeEntryRow = {
  id: string
  station_id: string
  employee_id: string
  shift_id: string | null
  start_at: string
  end_at: string | null
  break_minutes: number | null
  status: string | null
  source: string | null
  started_by: string | null
  ended_by: string | null
  start_note: string | null
  end_note: string | null
  approval_status: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  correction_note: string | null
  payroll_relevant: number | null
  planned_start_at: string | null
  start_deviation_minutes: number | null
  start_deviation_type: string | null
  planned_end_at: string | null
  end_deviation_minutes: number | null
  end_deviation_type: string | null
  early_leave_minutes: number | null
  early_leave_reason: string | null
  early_leave_note: string | null
  early_leave_confirmed_at: string | null
  early_leave_confirmed_by_employee_id: string | null
  created_at: string | null
  updated_at: string | null
}

export function enrichTimeEntryApiWithEffective(db: Database, row: TimeEntryRow) {
  const m = loadLatestCorrectionsMapForIds(db, [row.id])
  const corr = m.get(row.id)
  const eff = effectiveTimeBounds(row, corr)
  const api = rowToTimeEntryApi(row)
  const stampedBr = Math.max(0, Math.round(Number(row.break_minutes ?? 0)))
  return {
    ...api,
    stampedStartAt: row.start_at,
    stampedEndAt: row.end_at ?? undefined,
    stampedBreakMinutes: stampedBr,
    effectiveStartAt: eff.startAt,
    effectiveEndAt: eff.endAt ?? undefined,
    effectiveBreakMinutes: eff.breakMinutes,
    latestCorrectionKind: eff.correctionKind,
    startAt: eff.startAt,
    endAt: eff.endAt ?? api.endAt,
    breakMinutes: eff.breakMinutes,
    needsAutoClockOutReview:
      corr?.correction_kind === 'auto_clock_out' &&
      (api.approvalStatus === 'pending' || api.approvalStatus === 'correction_required'),
  }
}

export function rowToTimeEntryApi(r: TimeEntryRow) {
  const approval =
    r.status === 'completed'
      ? (r.approval_status && String(r.approval_status).trim() ? r.approval_status : 'pending')
      : r.approval_status && String(r.approval_status).trim()
        ? r.approval_status
        : undefined
  return {
    id: r.id,
    employeeId: r.employee_id,
    stationId: r.station_id,
    shiftId: r.shift_id ?? undefined,
    startAt: r.start_at,
    endAt: r.end_at ?? undefined,
    breakMinutes: r.break_minutes ?? 0,
    status: r.status ?? 'running',
    source: r.source ?? 'manual',
    startedBy: r.started_by ?? 'System',
    endedBy: r.ended_by ?? undefined,
    startNote: r.start_note ?? undefined,
    endNote: r.end_note ?? undefined,
    approvalStatus: approval as 'pending' | 'approved' | 'rejected' | 'correction_required' | undefined,
    approvedBy: r.approved_by ?? undefined,
    approvedAt: r.approved_at ?? undefined,
    rejectedBy: r.rejected_by ?? undefined,
    rejectedAt: r.rejected_at ?? undefined,
    rejectionReason: r.rejection_reason ?? undefined,
    correctionNote: r.correction_note ?? undefined,
    payrollRelevant: (r.payroll_relevant ?? 0) === 1,
    plannedStartAt: r.planned_start_at ?? undefined,
    startDeviationMinutes:
      r.start_deviation_minutes == null || Number.isNaN(Number(r.start_deviation_minutes))
        ? undefined
        : Number(r.start_deviation_minutes),
    startDeviationType: (r.start_deviation_type ?? undefined) as
      | 'early'
      | 'late'
      | 'no_planned_shift'
      | 'on_time'
      | undefined,
    plannedEndAt: r.planned_end_at ?? undefined,
    endDeviationMinutes:
      r.end_deviation_minutes == null || Number.isNaN(Number(r.end_deviation_minutes))
        ? undefined
        : Number(r.end_deviation_minutes),
    endDeviationType: (r.end_deviation_type ?? undefined) as
      | 'early'
      | 'late'
      | 'no_planned_shift'
      | 'on_time'
      | undefined,
    earlyLeaveMinutes:
      r.early_leave_minutes == null || Number.isNaN(Number(r.early_leave_minutes))
        ? undefined
        : Number(r.early_leave_minutes),
    earlyLeaveReason: r.early_leave_reason ? String(r.early_leave_reason) : undefined,
    earlyLeaveNote: r.early_leave_note ? String(r.early_leave_note) : undefined,
    earlyLeaveConfirmedAt: r.early_leave_confirmed_at ? String(r.early_leave_confirmed_at) : undefined,
    earlyLeaveConfirmedByEmployeeId: r.early_leave_confirmed_by_employee_id
      ? String(r.early_leave_confirmed_by_employee_id)
      : undefined,
    createdAt: r.created_at ?? nowIso(),
    updatedAt: r.updated_at ?? nowIso(),
  }
}

export function listTimeEntries(
  db: Database,
  q: { stationId?: string; employeeId?: string; from?: string; to?: string; status?: string },
) {
  const stationId = q.stationId ?? DEFAULT_STATION_ID
  let sql = `SELECT * FROM time_entries WHERE station_id = ?`
  const params: string[] = [stationId]
  if (q.employeeId) {
    sql += ` AND employee_id = ?`
    params.push(q.employeeId)
  }
  if (q.from) {
    sql += ` AND start_at >= ?`
    params.push(q.from)
  }
  if (q.to) {
    sql += ` AND start_at <= ?`
    params.push(q.to)
  }
  if (q.status) {
    sql += ` AND status = ?`
    params.push(q.status)
  }
  sql += ` ORDER BY start_at DESC`
  return (db.prepare(sql).all(...params) as TimeEntryRow[]).map((r) => enrichTimeEntryApiWithEffective(db, r))
}

export function listRunning(db: Database, stationId = DEFAULT_STATION_ID) {
  const rows = db
    .prepare(
      `SELECT te.*, e.display_name AS employee_display_name
       FROM time_entries te
       LEFT JOIN employees e ON e.id = te.employee_id AND e.station_id = te.station_id
       WHERE te.station_id = ?
         AND te.status = 'running'
         AND (te.end_at IS NULL OR trim(te.end_at) = '')
       ORDER BY te.start_at`,
    )
    .all(stationId) as (TimeEntryRow & { employee_display_name?: string | null })[]
  return rows.map((r) => {
    const employee_display_name = r.employee_display_name
    const base = rowToTimeEntryApi(r)
    return {
      ...base,
      employeeName: employee_display_name?.trim() || undefined,
    }
  })
}

export function listToday(db: Database, stationId = DEFAULT_STATION_ID) {
  const d = new Date()
  const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const rows = db
    .prepare(`SELECT * FROM time_entries WHERE station_id = ? AND start_at LIKE ? ORDER BY start_at DESC`)
    .all(stationId, `${prefix}%`) as TimeEntryRow[]
  return rows.map((r) => enrichTimeEntryApiWithEffective(db, r))
}

export function getTimeEntry(db: Database, id: string) {
  const r = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
  return r ? enrichTimeEntryApiWithEffective(db, r) : undefined
}

export function getTimeEntryRow(db: Database, id: string): TimeEntryRow | undefined {
  return db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
}

export function createManualTimeEntry(db: Database, body: Record<string, unknown>, stationId = DEFAULT_STATION_ID) {
  const employeeId = String(body.employeeId ?? '').trim()
  const startAt = String(body.startAt ?? '').trim()
  if (!employeeId) throw new Error('employee_id erforderlich')
  if (!startAt) throw new Error('start_at erforderlich')
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `te-${randomUUID()}`
  const ts = nowIso()
  db.prepare(
    `INSERT INTO time_entries (id, station_id, employee_id, shift_id, start_at, end_at, break_minutes, status, source, started_by, ended_by, start_note, end_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run(
    id,
    stationId,
    employeeId,
    body.shiftId != null ? String(body.shiftId) : null,
    startAt,
    body.endAt != null ? String(body.endAt) : null,
    Number(body.breakMinutes ?? 0),
    String(body.status ?? 'running'),
    String(body.source ?? 'manual'),
    String(body.startedBy ?? 'manual'),
    body.startNote != null ? String(body.startNote) : null,
    body.endNote != null ? String(body.endNote) : null,
    ts,
    ts,
  )
  return getTimeEntry(db, id)
}

export function updateTimeEntry(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
  if (!existing) throw new Error('Zeiteintrag nicht gefunden')
  const ts = nowIso()
  db.prepare(
    `UPDATE time_entries SET
      start_at = COALESCE(?, start_at),
      end_at = ?,
      break_minutes = COALESCE(?, break_minutes),
      status = COALESCE(?, status),
      source = COALESCE(?, source),
      end_note = ?,
      ended_by = ?,
      updated_at = ?
    WHERE id = ?`,
  ).run(
    body.startAt != null ? String(body.startAt) : null,
    body.endAt !== undefined ? (body.endAt == null ? null : String(body.endAt)) : existing.end_at,
    body.breakMinutes != null ? Number(body.breakMinutes) : null,
    body.status != null ? String(body.status) : null,
    body.source != null ? String(body.source) : null,
    body.endNote !== undefined ? (body.endNote == null ? null : String(body.endNote)) : existing.end_note,
    body.endedBy !== undefined ? (body.endedBy == null ? null : String(body.endedBy)) : existing.ended_by,
    ts,
    id,
  )
  return getTimeEntry(db, id)
}

export function closeTimeEntry(db: Database, id: string, endedBy?: string, opts?: { endAt?: string }) {
  const ts = opts?.endAt ?? nowIso()
  const r = db
    .prepare(
      `UPDATE time_entries SET
        end_at = ?,
        status = 'completed',
        ended_by = ?,
        updated_at = ?,
        approval_status = 'pending',
        payroll_relevant = 0,
        approved_by = NULL,
        approved_at = NULL,
        rejected_by = NULL,
        rejected_at = NULL,
        rejection_reason = NULL,
        correction_note = NULL
      WHERE id = ? AND status = 'running'`,
    )
    .run(ts, endedBy ?? 'System', ts, id)
  if (r.changes === 0) throw new Error('Kein laufender Eintrag oder nicht gefunden')
  return getTimeEntry(db, id)
}

export function getRunningForEmployee(db: Database, employeeId: string, stationId = DEFAULT_STATION_ID) {
  const r = db
    .prepare(
      `SELECT * FROM time_entries WHERE employee_id = ? AND station_id = ? AND status = 'running' ORDER BY start_at DESC LIMIT 1`,
    )
    .get(employeeId, stationId) as TimeEntryRow | undefined
  return r ? rowToTimeEntryApi(r) : undefined
}

function parseHM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function plannedShiftRowForEntry(
  db: Database,
  stationId: string,
  employeeId: string,
  dateIso: string,
  shiftId: string | null | undefined,
): ShiftRow | null {
  const rows = listShiftRowsForStationDateRange(db, stationId, dateIso, dateIso)
  if (shiftId) {
    const s = rows.find((r) => r.id === shiftId)
    if (s) return s
  }
  const list = rows.filter(
    (s) =>
      s.employee_id === employeeId &&
      s.date === dateIso &&
      s.shift_type !== 'frei' &&
      Boolean(s.start_time) &&
      Boolean(s.end_time),
  )
  if (list.length === 0) return null
  list.sort((a, b) => parseHM(a.start_time) - parseHM(b.start_time))
  return list[0] ?? null
}

/** Kassendifferenz aus Checkliste: optional, Standard 0 €; erlaubt z. B. -5 oder 2,5 */
export function parseChecklistCashDifferenceEuro(checklist: Record<string, unknown>): number {
  const v = checklist.cashDifference ?? checklist.cash_difference
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('Kassendifferenz ungültig')
    if (Math.abs(v) > 1_000_000) throw new Error('Kassendifferenz außerhalb des zulässigen Bereichs')
    return Math.round(v * 100) / 100
  }
  const s = String(v).trim().replace(/\s/g, '')
  if (!s) return 0
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n)) throw new Error('Kassendifferenz ungültig')
  if (Math.abs(n) > 1_000_000) throw new Error('Kassendifferenz außerhalb des zulässigen Bereichs')
  return Math.round(n * 100) / 100
}

function checklistRowToApi(r: Record<string, unknown>) {
  const cashRaw = r.cash_difference
  const cashDiff =
    cashRaw === null || cashRaw === undefined || String(cashRaw).trim() === ''
      ? 0
      : Math.round(Number(cashRaw) * 100) / 100
  return {
    id: String(r.id),
    timeEntryId: String(r.time_entry_id),
    employeeId: String(r.employee_id),
    fridgeFronted: (r.fridge_fronted as number) === 1,
    drinksFilled: (r.drinks_filled as number) === 1,
    cigarettesFilled: (r.cigarettes_filled as number) === 1,
    shelvesFilled: (r.shelves_filled as number) === 1,
    trashEmptied: (r.trash_emptied as number) === 1,
    counterClean: (r.counter_clean as number) === 1,
    coffeeAreaClean: (r.coffee_area_clean as number) === 1,
    outsideChecked: (r.outside_checked as number) === 1,
    incidentsNoted: (r.incidents_noted as number) === 1,
    handoverPossible: (r.handover_possible as number) === 1,
    closingReady: (r.closing_ready as number) === 1,
    everythingOk: (r.everything_ok as number) === 1,
    incidentNote: String(r.incident_note ?? ''),
    cashDifference: Number.isFinite(cashDiff) ? cashDiff : 0,
    completedAt: String(r.completed_at ?? ''),
  }
}

export type PendingTimeEntryListRow = ReturnType<typeof enrichTimeEntryApiWithEffective> & {
  employeeDisplayName: string
}

export function listPendingApproval(db: Database, stationId = DEFAULT_STATION_ID): PendingTimeEntryListRow[] {
  const rows = db
    .prepare(
      `SELECT te.*, e.display_name AS employee_display_name
       FROM time_entries te
       JOIN employees e ON e.id = te.employee_id
       WHERE te.station_id = ?
         AND te.status = 'completed'
         AND (te.approval_status = 'pending' OR te.approval_status = 'correction_required')
       ORDER BY datetime(te.end_at) DESC
       LIMIT 200`,
    )
    .all(stationId) as (TimeEntryRow & { employee_display_name: string })[]
  return rows.map((r) => {
    const { employee_display_name: employeeDisplayName, ...row } = r
    return { ...enrichTimeEntryApiWithEffective(db, row as TimeEntryRow), employeeDisplayName }
  })
}

export function countPendingApproval(db: Database, stationId = DEFAULT_STATION_ID): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM time_entries
       WHERE station_id = ? AND status = 'completed'
         AND (approval_status = 'pending' OR approval_status = 'correction_required')`,
    )
    .get(stationId) as { c: number }
  return row.c ?? 0
}

export function getTimeEntryDetail(db: Database, id: string) {
  const row = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
  if (!row) return undefined
  const workYmdBerlin = ymdBerlinFromUtcMs(new Date(row.start_at).getTime())
  const entry = rowToTimeEntryApi(row)
  const corrMap = loadLatestCorrectionsMapForIds(db, [id])
  const latestCorrRow = corrMap.get(id)
  const eff = effectiveTimeBounds(row, latestCorrRow)
  const correctionsHistory = listCorrectionsForTimeEntry(db, id).map(rowToCorrectionApi)
  const chkRaw = db.prepare(`SELECT * FROM shift_close_checklists WHERE time_entry_id = ?`).get(id) as
    | Record<string, unknown>
    | undefined
  const runRow = db
    .prepare(
      `SELECT handover_variant, handover_remark, created_at, checkout_source FROM shift_close_checklist_runs WHERE time_entry_id = ?`,
    )
    .get(id) as
    | {
        handover_variant?: string | null
        handover_remark?: string | null
        created_at?: string | null
        checkout_source?: string | null
      }
    | undefined
  const isMiddayCollective = String(runRow?.handover_variant ?? '').trim() === MIDDAY_COLLECTIVE_HANDOVER_VARIANT

  const shiftCloseStructured = isMiddayCollective ? null : loadStructuredShiftCloseChecklist(db, id)
  const middayCollectiveHandover = isMiddayCollective
    ? {
        confirmed: true as const,
        remark: runRow?.handover_remark ? String(runRow.handover_remark).trim() || undefined : undefined,
        completedAt: String(runRow?.created_at ?? ''),
        bulletTitles: [...MIDDAY_STANDARD_HANDOVER_LABELS],
        source: runRow?.checkout_source ? String(runRow.checkout_source) : undefined,
      }
    : null

  let reviewItems = listReviewItemsForTimeEntry(db, id)
  if (shiftCloseStructured && reviewItems.length === 0) {
    syncReviewItemsFromShiftCloseItems(db, {
      timeEntryId: id,
      employeeId: row.employee_id,
      stationId: row.station_id,
      items: shiftCloseStructured.items.map((it) => ({
        itemKey: it.itemKey,
        itemLabel: it.itemLabel,
        answer: it.answer as 'yes' | 'no' | 'not_relevant',
      })),
    })
    reviewItems = listReviewItemsForTimeEntry(db, id)
  } else if (chkRaw && reviewItems.length === 0) {
    const api = checklistRowToApi(chkRaw)
    syncReviewItemsFromCloseChecklist(db, {
      timeEntryId: id,
      employeeId: row.employee_id,
      stationId: row.station_id,
      checklist: {
        fridgeFronted: api.fridgeFronted,
        drinksFilled: api.drinksFilled,
        cigarettesFilled: api.cigarettesFilled,
        shelvesFilled: api.shelvesFilled,
        trashEmptied: api.trashEmptied,
        counterClean: api.counterClean,
        coffeeAreaClean: api.coffeeAreaClean,
        outsideChecked: api.outsideChecked,
        incidentsNoted: api.incidentsNoted,
        handoverPossible: api.handoverPossible,
        closingReady: api.closingReady,
        everythingOk: api.everythingOk,
        incidentNote: api.incidentNote,
      },
    })
    reviewItems = listReviewItemsForTimeEntry(db, id)
  }
  const planned = plannedShiftRowForEntry(db, row.station_id, row.employee_id, workYmdBerlin, row.shift_id)
  const emp = db
    .prepare(`SELECT display_name FROM employees WHERE id = ?`)
    .get(row.employee_id) as { display_name: string } | undefined
  const shiftCloseTaskResponses = listShiftCloseTaskResponsesJoined(db, id).map((r) => ({
    id: r.id,
    taskId: r.task_id,
    taskTitle: r.task_title ?? r.task_id,
    outcome: r.outcome,
    notDoneReason: r.not_done_reason ?? undefined,
    recordedAt: r.recorded_at,
    source: r.source,
  }))
  const eligibleEarlyBackshop = Boolean(planned && isEarlyShiftForBakingNotice(planned))
  const packForDay = resolveBackshopNoticeForStationAndDate(db, row.station_id, workYmdBerlin)
  const wouldOfferPopup =
    eligibleEarlyBackshop && (packForDay.displayLines.length > 0 || packForDay.routineId != null)

  const ackRow = getBackshopAckByTimeEntryId(db, id)
  const legacyRow = !ackRow ? getLegacyShiftBakingNotice(db, id) : undefined

  function linesFromSnapshotJson(json: string): string[] {
    try {
      const snap = JSON.parse(json) as unknown[]
      if (!Array.isArray(snap)) return []
      return snap
        .map((x) => {
          if (typeof x === 'string') return x.trim()
          if (x && typeof x === 'object' && 'line' in (x as object)) {
            return String((x as { line?: string }).line ?? '').trim()
          }
          return ''
        })
        .filter(Boolean)
    } catch {
      return []
    }
  }

  let bakingNotice: {
    eligible: boolean
    popupOffered: boolean
    acknowledged: boolean
    acknowledgedAt?: string
    routineType?: string
    planTypeLabel?: string
    items: string[]
    remark?: string
  } | null = null

  if (ackRow) {
    const items = linesFromSnapshotJson(ackRow.items_snapshot_json)
    bakingNotice = {
      eligible: eligibleEarlyBackshop,
      popupOffered: wouldOfferPopup,
      acknowledged: true,
      acknowledgedAt: ackRow.acknowledged_at,
      routineType: ackRow.routine_type,
      planTypeLabel: routineTypeLabelDe(ackRow.routine_type),
      items,
      remark: ackRow.remark ? String(ackRow.remark).trim() || undefined : undefined,
    }
  } else if (legacyRow) {
    let items: string[] = []
    try {
      items = JSON.parse(legacyRow.items_json) as string[]
    } catch {
      items = []
    }
    const rt = legacyRow.baking_plan_type === 'weekday' ? 'weekday' : 'weekend'
    bakingNotice = {
      eligible: eligibleEarlyBackshop,
      popupOffered: wouldOfferPopup,
      acknowledged: true,
      acknowledgedAt: legacyRow.acknowledged_at,
      routineType: rt,
      planTypeLabel: rt === 'weekday' ? 'Normaler Wochentag' : 'Wochenende / Feiertag (historisch)',
      items,
      remark: legacyRow.remark ? String(legacyRow.remark).trim() || undefined : undefined,
    }
  } else if (wouldOfferPopup) {
    bakingNotice = {
      eligible: true,
      popupOffered: true,
      acknowledged: false,
      routineType: packForDay.routineType,
      planTypeLabel: routineTypeLabelDe(packForDay.routineType),
      items: packForDay.displayLines,
    }
  }
  return {
    timeEntry: entry,
    workDateYmdBerlin: workYmdBerlin,
    effectiveForPayroll: {
      startAt: eff.startAt,
      endAt: eff.endAt ?? undefined,
      breakMinutes: eff.breakMinutes,
    },
    correctionsHistory,
    latestCorrection: correctionsHistory.length ? correctionsHistory[correctionsHistory.length - 1]! : null,
    employeeName: emp?.display_name ?? '',
    checklist: chkRaw && !isMiddayCollective ? checklistRowToApi(chkRaw) : null,
    shiftCloseStructured,
    middayCollectiveHandover,
    checklistReviewItems: reviewItems,
    shiftCloseTaskResponses,
    plannedShift: planned
      ? {
          id: planned.id,
          date: planned.date,
          startTime: planned.start_time,
          endTime: planned.end_time,
        }
      : null,
    bakingNotice,
  }
}

export function approveTimeEntry(db: Database, id: string, adminUserId: string) {
  const existing = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
  if (!existing) throw new Error('Zeiteintrag nicht gefunden')
  if (existing.status !== 'completed') throw new Error('Nur abgeschlossene Zeiten können freigegeben werden')
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE time_entries SET
        approval_status = 'approved',
        payroll_relevant = 1,
        approved_by = ?,
        approved_at = ?,
        rejected_by = NULL,
        rejected_at = NULL,
        rejection_reason = NULL,
        correction_note = NULL,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(adminUserId, ts, ts, id)
  if (r.changes === 0) throw new Error('Update fehlgeschlagen')
  return getTimeEntry(db, id)
}

export function rejectTimeEntry(db: Database, id: string, adminUserId: string, rejectionReason: string) {
  const reason = String(rejectionReason ?? '').trim()
  if (!reason) throw new Error('Ablehnungsgrund erforderlich')
  const existing = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
  if (!existing) throw new Error('Zeiteintrag nicht gefunden')
  if (existing.status !== 'completed') throw new Error('Nur abgeschlossene Zeiten können abgelehnt werden')
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE time_entries SET
        approval_status = 'rejected',
        payroll_relevant = 0,
        rejected_by = ?,
        rejected_at = ?,
        rejection_reason = ?,
        approved_by = NULL,
        approved_at = NULL,
        correction_note = NULL,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(adminUserId, ts, reason, ts, id)
  if (r.changes === 0) throw new Error('Update fehlgeschlagen')
  return getTimeEntry(db, id)
}

export function requestTimeEntryCorrection(db: Database, id: string, correctionNote: string) {
  const note = String(correctionNote ?? '').trim()
  if (!note) throw new Error('Hinweis zur Korrektur erforderlich')
  const existing = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
  if (!existing) throw new Error('Zeiteintrag nicht gefunden')
  if (existing.status !== 'completed') throw new Error('Nur abgeschlossene Zeiten')
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE time_entries SET
        approval_status = 'correction_required',
        payroll_relevant = 0,
        correction_note = ?,
        approved_by = NULL,
        approved_at = NULL,
        rejected_by = NULL,
        rejected_at = NULL,
        rejection_reason = NULL,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(note, ts, id)
  if (r.changes === 0) throw new Error('Update fehlgeschlagen')
  return getTimeEntry(db, id)
}

export function loadStructuredShiftCloseChecklist(db: Database, timeEntryId: string) {
  const run = db
    .prepare(`SELECT * FROM shift_close_checklist_runs WHERE time_entry_id = ?`)
    .get(timeEntryId) as Record<string, unknown> | undefined
  if (!run) return null
  const rows = db
    .prepare(`SELECT * FROM shift_close_checklist_items WHERE time_entry_id = ? ORDER BY rowid`)
    .all(timeEntryId) as Record<string, unknown>[]
  return {
    checklistType: String(run.checklist_type ?? ''),
    cashDifference: Number(run.cash_difference ?? 0),
    truthConfirmed: (run.truth_confirmed as number) === 1,
    createdAt: String(run.created_at ?? ''),
    items: rows.map((r) => ({
      itemKey: String(r.item_key ?? ''),
      itemLabel: String(r.item_label ?? ''),
      answer: String(r.answer ?? '') as 'yes' | 'no' | 'not_relevant',
      reason: r.reason ? String(r.reason) : undefined,
    })),
  }
}

function legacyBoolFromStructuredKeys(parsed: ParsedStructuredChecklist, keys: string[]): number {
  const matched = keys.filter((k) => parsed.items.some((i) => i.itemKey === k))
  if (matched.length === 0) return 1
  for (const k of matched) {
    const a = parsed.items.find((i) => i.itemKey === k)?.answer
    if (a === 'no') return 0
  }
  return 1
}

function insertLegacyShiftCloseRowFromStructured(
  db: Database,
  timeEntryId: string,
  employeeId: string,
  parsed: ParsedStructuredChecklist,
  ts: string,
) {
  const anyNo = parsed.items.some((i) => i.answer === 'no')
  const lines: string[] = []
  for (const it of parsed.items) {
    if (it.answer === 'no') lines.push(`${it.itemLabel}: ${it.reason ?? ''}`)
    if (it.answer === 'not_relevant' && it.reason) lines.push(`${it.itemLabel} (n. v.): ${it.reason}`)
  }
  const incidentNote = lines.join('\n')
  const id = `chk-${randomUUID()}`
  const b = (keys: string[]) => legacyBoolFromStructuredKeys(parsed, keys)
  db.prepare(
    `INSERT INTO shift_close_checklists (
      id, time_entry_id, employee_id,
      fridge_fronted, drinks_filled, cigarettes_filled, shelves_filled, trash_emptied,
      counter_clean, coffee_area_clean, outside_checked, incidents_noted, handover_possible,
      closing_ready, everything_ok, incident_note, cash_difference, completed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    timeEntryId,
    employeeId,
    b(['ho_fridges_filled', 'cl_fridges_fill', 'cl_fridges_check']),
    1,
    b(['ho_cigarettes_refilled', 'cl_cigarettes_refill']),
    b(['ho_sales_floor_clean', 'cl_chips_alcohol_sweets', 'cl_storage_tidy']),
    b(['ho_trash_inside_outside', 'cl_trash_all']),
    b(['ho_register_front_tidy', 'cl_register_front', 'cl_register_front_check']),
    b(['ho_coffee_area', 'cl_coffee_machine_clean', 'cl_backshop_clean', 'cl_oven_clean']),
    b(['cl_outdoor_area']),
    1,
    b(['ho_handover_possible', 'cl_station_closed_properly']),
    b(['cl_all_doors_locked', 'cl_lights_off', 'cl_station_closed_properly']),
    anyNo ? 0 : 1,
    incidentNote,
    parsed.cashDifference,
    ts,
    ts,
  )
  return id
}

export function insertShiftCloseChecklistParsed(
  db: Database,
  timeEntryId: string,
  employeeId: string,
  stationId: string,
  parsed: ParsedStructuredChecklist,
) {
  const ts = nowIso()
  db.prepare(`DELETE FROM shift_close_checklist_runs WHERE time_entry_id = ?`).run(timeEntryId)
  db.prepare(`DELETE FROM shift_close_checklists WHERE time_entry_id = ?`).run(timeEntryId)
  const runId = `sccr-${randomUUID()}`
  db.prepare(
    `INSERT INTO shift_close_checklist_runs (id, time_entry_id, employee_id, station_id, checklist_type, cash_difference, truth_confirmed, created_at)
     VALUES (?,?,?,?,?,?,1,?)`,
  ).run(runId, timeEntryId, employeeId, stationId, parsed.checklistType, parsed.cashDifference, ts)
  const insItem = db.prepare(
    `INSERT INTO shift_close_checklist_items (id, checklist_id, time_entry_id, employee_id, station_id, checklist_type, item_key, item_label, answer, reason, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  )
  for (const it of parsed.items) {
    insItem.run(
      `scci-${randomUUID()}`,
      runId,
      timeEntryId,
      employeeId,
      stationId,
      parsed.checklistType,
      it.itemKey,
      it.itemLabel,
      it.answer,
      it.reason ?? null,
      ts,
    )
  }
  insertLegacyShiftCloseRowFromStructured(db, timeEntryId, employeeId, parsed, ts)
  syncReviewItemsFromShiftCloseItems(db, {
    timeEntryId,
    employeeId,
    stationId,
    items: parsed.items,
  })
  createShiftWarningsFromShiftCloseCheckout(db, {
    stationId,
    employeeId,
    sourceTimeEntryId: timeEntryId,
    items: parsed.items,
  })
  return runId
}

/** Feste Mittags-Schichtübergabe (ca. 14:00): Snapshot in shift_close_checklist_* + Legacy-Zeile. */
export function insertShiftCloseMiddayCollectiveHandover(
  db: Database,
  p: {
    timeEntryId: string
    employeeId: string
    stationId: string
    shiftId: string | null | undefined
    remark: string
    checkoutSource: 'tablet' | 'employee_app'
  },
) {
  const ts = nowIso()
  const labels = [...MIDDAY_STANDARD_HANDOVER_LABELS]
  db.prepare(`DELETE FROM shift_close_checklist_runs WHERE time_entry_id = ?`).run(p.timeEntryId)
  db.prepare(`DELETE FROM shift_close_checklists WHERE time_entry_id = ?`).run(p.timeEntryId)

  const runId = `sccr-${randomUUID()}`
  db.prepare(
    `INSERT INTO shift_close_checklist_runs (
      id, time_entry_id, employee_id, station_id, checklist_type, cash_difference, truth_confirmed, created_at,
      handover_variant, handover_remark, shift_id, checkout_source
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    runId,
    p.timeEntryId,
    p.employeeId,
    p.stationId,
    'handover',
    0,
    1,
    ts,
    MIDDAY_COLLECTIVE_HANDOVER_VARIANT,
    p.remark.trim() || null,
    p.shiftId ?? null,
    p.checkoutSource,
  )

  const insItem = db.prepare(
    `INSERT INTO shift_close_checklist_items (id, checklist_id, time_entry_id, employee_id, station_id, checklist_type, item_key, item_label, answer, reason, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  )
  labels.forEach((label, i) => {
    const key = `mid_ho_${String(i + 1).padStart(2, '0')}`
    insItem.run(
      `scci-${randomUUID()}`,
      runId,
      p.timeEntryId,
      p.employeeId,
      p.stationId,
      'handover',
      key,
      label,
      'yes',
      null,
      ts,
    )
  })

  const legacyId = `chk-${randomUUID()}`
  const note = p.remark.trim()
  db.prepare(
    `INSERT INTO shift_close_checklists (
      id, time_entry_id, employee_id,
      fridge_fronted, drinks_filled, cigarettes_filled, shelves_filled, trash_emptied,
      counter_clean, coffee_area_clean, outside_checked, incidents_noted, handover_possible,
      closing_ready, everything_ok, incident_note, cash_difference, completed_at, created_at
    ) VALUES (?, ?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, ?, 0, ?, ?)`,
  ).run(legacyId, p.timeEntryId, p.employeeId, note || '', ts, ts)

  return runId
}

/** Alte Booleans-Checkliste (Fallback für alte Clients ohne strukturierte Punkte). */
export function insertChecklist(
  db: Database,
  timeEntryId: string,
  employeeId: string,
  checklist: Record<string, unknown>,
) {
  const id = `chk-${randomUUID()}`
  const ts = nowIso()
  const cashDifference = parseChecklistCashDifferenceEuro(checklist)
  db.prepare(
    `INSERT INTO shift_close_checklists (
      id, time_entry_id, employee_id,
      fridge_fronted, drinks_filled, cigarettes_filled, shelves_filled, trash_emptied,
      counter_clean, coffee_area_clean, outside_checked, incidents_noted, handover_possible,
      closing_ready, everything_ok, incident_note, cash_difference, completed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    timeEntryId,
    employeeId,
    checklist.fridgeFronted ? 1 : 0,
    checklist.drinksFilled ? 1 : 0,
    checklist.cigarettesFilled ? 1 : 0,
    checklist.shelvesFilled ? 1 : 0,
    checklist.trashEmptied ? 1 : 0,
    checklist.counterClean ? 1 : 0,
    checklist.coffeeAreaClean ? 1 : 0,
    checklist.outsideChecked ? 1 : 0,
    checklist.incidentsNoted ? 1 : 0,
    checklist.handoverPossible ? 1 : 0,
    checklist.closingReady ? 1 : 0,
    checklist.everythingOk ? 1 : 0,
    String(checklist.incidentNote ?? ''),
    cashDifference,
    ts,
    ts,
  )
  return id
}

export function listCardEntryEvents(
  db: Database,
  q: { stationId: string; from?: string; to?: string; employeeId?: string },
) {
  let sql = `SELECT * FROM card_entry_events WHERE station_id = ?`
  const params: string[] = [q.stationId]
  if (q.from) {
    sql += ` AND datetime(created_at) >= datetime(?)`
    params.push(q.from)
  }
  if (q.to) {
    sql += ` AND datetime(created_at) <= datetime(?)`
    params.push(q.to)
  }
  if (q.employeeId) {
    sql += ` AND employee_id = ?`
    params.push(q.employeeId)
  }
  sql += ` ORDER BY datetime(created_at) DESC LIMIT 500`
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: String(r.id),
    cardNumber: String(r.card_number ?? ''),
    employeeId: r.employee_id ? String(r.employee_id) : undefined,
    stationId: String(r.station_id),
    actionType: (String(r.action_type ?? 'check_in') === 'check_out' ? 'check_out' : 'check_in') as 'check_in' | 'check_out',
    scannedAt: String(r.created_at ?? r.entered_at ?? ''),
    result: String(r.result ?? 'success') as string,
    message: String(r.message ?? ''),
  }))
}

export function logCardEvent(
  db: Database,
  p: {
    cardNumber: string
    employeeId?: string | null
    stationId: string
    actionType: string
    result: string
    message: string
  },
) {
  const id = `cev-${randomUUID()}`
  const ts = nowIso()
  db.prepare(
    `INSERT INTO card_entry_events (id, card_number, employee_id, station_id, action_type, entered_at, result, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    p.cardNumber,
    p.employeeId ?? null,
    p.stationId,
    p.actionType,
    ts,
    p.result,
    p.message,
    ts,
  )
}
