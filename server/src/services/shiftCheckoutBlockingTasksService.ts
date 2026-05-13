import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { getEmployeeRowInternal } from './employeeService.js'
import { listShifts } from './shiftService.js'
import { listTaskRows, rowToTaskApi, upsertTaskLogAtShiftCheckoutDone, type TaskRow } from './taskService.js'
import {
  buildTaskTimeCaption,
  isTaskDueOnDateRow,
  taskEligibleForEmployeeRow,
  type TodayShiftLite,
} from './taskEligibilityService.js'

export type ShiftCloseTaskDeclaration = { taskId: string; outcome: 'done' | 'not_done'; notDoneReason?: string }

export type CheckoutBlockingTaskApi = ReturnType<typeof rowToTaskApi> & {
  timeCaption: string
  blockingMandatory: boolean
  blockingShiftClose: boolean
}

function employmentRoleFromRow(row: Record<string, unknown>): string {
  const raw = row.employment_role
  return typeof raw === 'string' ? raw.trim() : ''
}

function employeeWorkAreaIds(db: Database, employeeId: string): string[] {
  const rows = db
    .prepare(`SELECT work_area_id FROM employee_work_areas WHERE employee_id = ?`)
    .all(employeeId) as { work_area_id: string }[]
  return [...new Set(rows.map((r) => String(r.work_area_id ?? '')).filter(Boolean))]
}

function workDateYmdFromTimeEntryStart(startAt: string): string {
  return String(startAt ?? '').slice(0, 10)
}

function isShiftCloseKindRow(r: TaskRow): boolean {
  const k = String(r.task_kind ?? '').trim().toLowerCase()
  return k === 'shift_close' || (r.required_for_shift_close ?? 0) === 1
}

function taskLogResolvedForShiftEnd(db: Database, taskId: string, dateYmd: string): boolean {
  const log = db
    .prepare(`SELECT status FROM task_logs WHERE task_id = ? AND date = ?`)
    .get(taskId, dateYmd) as { status: string | null } | undefined
  if (!log) return false
  const st = String(log.status ?? '').trim().toLowerCase()
  return st === 'done' || st === 'controlled' || st === 'in_control'
}

/**
 * Pflicht- und Abschlussaufgaben, die vor dem Schichtende noch nicht als erledigt/kontrolliert gelten.
 * Nur echte DB-Zeilen, gleiche Sichtlogik wie in der Mitarbeiter-App.
 */
export function listCheckoutBlockingTaskRows(
  db: Database,
  p: { stationId: string; employeeId: string; timeEntryStartAt: string },
): TaskRow[] {
  const dateYmd = workDateYmdFromTimeEntryStart(p.timeEntryStartAt)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return []

  const row = getEmployeeRowInternal(db, p.employeeId)
  if (!row || String(row.station_id) !== p.stationId) return []

  const empRole = String(row.role ?? '').trim()
  const empJobTitle = employmentRoleFromRow(row as Record<string, unknown>)
  const todayShiftsRaw = listShifts(db, { stationId: p.stationId, employeeId: p.employeeId, from: dateYmd, to: dateYmd })
  const todayShiftLites: TodayShiftLite[] = todayShiftsRaw.map((s) => ({
    startTime: s.startTime,
    endTime: s.endTime,
    workAreaId: s.workAreaId,
    shiftType: s.shiftType,
  }))
  const todayShiftAreas = new Set(todayShiftsRaw.map((s) => s.workAreaId).filter(Boolean) as string[])
  const ewaIds = employeeWorkAreaIds(db, p.employeeId)

  const taskRows = listTaskRows(db, p.stationId)
  const eligible = taskRows.filter(
    (r) =>
      isTaskDueOnDateRow(r, dateYmd) &&
      taskEligibleForEmployeeRow(r, p.employeeId, empRole, empJobTitle, ewaIds, todayShiftAreas, todayShiftLites),
  )

  return eligible.filter((r) => {
    const mandatory = (r.mandatory ?? 0) === 1
    const close = isShiftCloseKindRow(r)
    if (!mandatory && !close) return false
    if (taskLogResolvedForShiftEnd(db, r.id, dateYmd)) return false
    return true
  })
}

export function mapCheckoutBlockingTasksToApi(
  db: Database,
  p: { stationId: string; employeeId: string; timeEntryStartAt: string },
): CheckoutBlockingTaskApi[] {
  const dateYmd = workDateYmdFromTimeEntryStart(p.timeEntryStartAt)
  const rows = listCheckoutBlockingTaskRows(db, p)
  const todayShiftsRaw = listShifts(db, { stationId: p.stationId, employeeId: p.employeeId, from: dateYmd, to: dateYmd })
  const primaryShift: TodayShiftLite | null =
    todayShiftsRaw.length > 0
      ? {
          startTime: todayShiftsRaw[0]!.startTime,
          endTime: todayShiftsRaw[0]!.endTime,
          workAreaId: todayShiftsRaw[0]!.workAreaId,
          shiftType: todayShiftsRaw[0]!.shiftType,
        }
      : null
  return rows.map((r) => ({
    ...rowToTaskApi(r),
    timeCaption: buildTaskTimeCaption(r, { todayYmd: dateYmd, primaryShift }),
    blockingMandatory: (r.mandatory ?? 0) === 1,
    blockingShiftClose: isShiftCloseKindRow(r),
  }))
}

export function validateShiftCloseTaskDeclarations(
  blockingIds: string[],
  decl: ShiftCloseTaskDeclaration[] | undefined,
  accuracyConfirmed: boolean | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!blockingIds.length) return { ok: true }
  if (!accuracyConfirmed) {
    return { ok: false, error: 'Bitte bestätigen, dass die Angaben zu den Aufgaben korrekt sind.' }
  }
  if (!Array.isArray(decl) || decl.length !== blockingIds.length) {
    return { ok: false, error: 'Alle markierten Aufgaben müssen vor dem Schichtabschluss geprüft werden.' }
  }
  const byId = new Map(decl.map((x) => [String(x.taskId ?? '').trim(), x]))
  for (const id of blockingIds) {
    const d = byId.get(id)
    if (!d || (d.outcome !== 'done' && d.outcome !== 'not_done')) {
      return { ok: false, error: 'Bitte jede Aufgabe als „Erledigt“ oder „Nicht erledigt“ kennzeichnen.' }
    }
    if (d.outcome === 'not_done' && !String(d.notDoneReason ?? '').trim()) {
      return { ok: false, error: 'Bei „Nicht erledigt“ ist eine Begründung erforderlich.' }
    }
  }
  return { ok: true }
}

export function replaceShiftCloseTaskResponses(
  db: Database,
  p: {
    timeEntryId: string
    employeeId: string
    stationId: string
    shiftId: string | null | undefined
    source: 'employee_app' | 'tablet'
    items: ShiftCloseTaskDeclaration[]
  },
) {
  const ts = nowIso()
  db.prepare(`DELETE FROM shift_close_task_responses WHERE time_entry_id = ?`).run(p.timeEntryId)
  const ins = db.prepare(
    `INSERT INTO shift_close_task_responses (
      id, time_entry_id, task_id, employee_id, station_id, shift_id, outcome, not_done_reason, recorded_at, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const it of p.items) {
    ins.run(
      `sctr-${randomUUID()}`,
      p.timeEntryId,
      it.taskId,
      p.employeeId,
      p.stationId,
      p.shiftId?.trim() ? p.shiftId.trim() : null,
      it.outcome,
      it.outcome === 'not_done' ? String(it.notDoneReason ?? '').trim() || null : null,
      ts,
      p.source,
      ts,
    )
  }
}

export function listShiftCloseTaskResponsesJoined(db: Database, timeEntryId: string) {
  return db
    .prepare(
      `SELECT r.*, t.title AS task_title
       FROM shift_close_task_responses r
       LEFT JOIN tasks t ON t.id = r.task_id
       WHERE r.time_entry_id = ?
       ORDER BY r.recorded_at ASC, r.task_id ASC`,
    )
    .all(timeEntryId) as {
    id: string
    time_entry_id: string
    task_id: string
    employee_id: string
    station_id: string
    shift_id: string | null
    outcome: string
    not_done_reason: string | null
    recorded_at: string
    source: string
    created_at: string | null
    task_title: string | null
  }[]
}

export function persistShiftCloseTaskResponsesAndTaskLogs(
  db: Database,
  p: {
    timeEntryId: string
    employeeId: string
    stationId: string
    shiftId: string | null | undefined
    source: 'employee_app' | 'tablet'
    dateYmd: string
    displayName: string
    items: ShiftCloseTaskDeclaration[]
  },
) {
  replaceShiftCloseTaskResponses(db, {
    timeEntryId: p.timeEntryId,
    employeeId: p.employeeId,
    stationId: p.stationId,
    shiftId: p.shiftId,
    source: p.source,
    items: p.items,
  })
  for (const it of p.items) {
    if (it.outcome === 'done') {
      upsertTaskLogAtShiftCheckoutDone(db, {
        taskId: it.taskId,
        dateYmd: p.dateYmd,
        employeeId: p.employeeId,
        stationId: p.stationId,
        timeEntryId: p.timeEntryId,
        source: p.source,
        displayName: p.displayName,
      })
    }
  }
}
