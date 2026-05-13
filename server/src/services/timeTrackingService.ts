import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'
import { listShiftRowsForStationDateRange, type ShiftRow } from './shiftService.js'
import { listReviewItemsForTimeEntry, syncReviewItemsFromCloseChecklist } from './shiftChecklistReviewService.js'

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
  created_at: string | null
  updated_at: string | null
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
  return (db.prepare(sql).all(...params) as TimeEntryRow[]).map(rowToTimeEntryApi)
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
  return rows.map(rowToTimeEntryApi)
}

export function getTimeEntry(db: Database, id: string) {
  const r = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(id) as TimeEntryRow | undefined
  return r ? rowToTimeEntryApi(r) : undefined
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

export function closeTimeEntry(db: Database, id: string, endedBy?: string) {
  const ts = nowIso()
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

export type PendingTimeEntryListRow = ReturnType<typeof rowToTimeEntryApi> & { employeeDisplayName: string }

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
    return { ...rowToTimeEntryApi(row as TimeEntryRow), employeeDisplayName }
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
  const entry = rowToTimeEntryApi(row)
  const chkRaw = db.prepare(`SELECT * FROM shift_close_checklists WHERE time_entry_id = ?`).get(id) as
    | Record<string, unknown>
    | undefined
  let reviewItems = listReviewItemsForTimeEntry(db, id)
  if (chkRaw && reviewItems.length === 0) {
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
  const dateIso = row.start_at.slice(0, 10)
  const planned = plannedShiftRowForEntry(db, row.station_id, row.employee_id, dateIso, row.shift_id)
  const emp = db
    .prepare(`SELECT display_name FROM employees WHERE id = ?`)
    .get(row.employee_id) as { display_name: string } | undefined
  return {
    timeEntry: entry,
    employeeName: emp?.display_name ?? '',
    checklist: chkRaw ? checklistRowToApi(chkRaw) : null,
    checklistReviewItems: reviewItems,
    plannedShift: planned
      ? {
          id: planned.id,
          date: planned.date,
          startTime: planned.start_time,
          endTime: planned.end_time,
        }
      : null,
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
