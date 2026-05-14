import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'

const PRIO_TO_DE: Record<string, string> = {
  low: 'niedrig',
  normal: 'normal',
  high: 'hoch',
  critical: 'kritisch',
}

const DE_TO_PRIO: Record<string, string> = Object.fromEntries(
  Object.entries(PRIO_TO_DE).map(([k, v]) => [v, k]),
)

const LOG_STATUS_TO_DE: Record<string, string> = {
  open: 'offen',
  done: 'erledigt',
  overdue: 'überfällig',
  in_control: 'in_kontrolle',
  controlled: 'kontrolliert',
  issue: 'mangel',
  disabled: 'deaktiviert',
}

const DE_TO_LOG_STATUS: Record<string, string> = Object.fromEntries(
  Object.entries(LOG_STATUS_TO_DE).map(([k, v]) => [v, k]),
)

const CTRL_TO_DE: Record<string, string> = {
  ok: 'ok',
  mangel: 'mangel',
  nacharbeiten: 'nacharbeiten',
}

export type TaskRow = {
  id: string
  station_id: string
  title: string
  description: string | null
  work_area_id: string | null
  assigned_type: string | null
  assigned_employee_id: string | null
  assigned_role: string | null
  recurrence_type: string | null
  start_date: string | null
  end_date: string | null
  weekdays_json: string | null
  month_day: number | null
  start_time: string | null
  end_time: string | null
  confirm_required: number | null
  control_required: number | null
  mandatory: number | null
  priority: string | null
  active: number | null
  icon: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  task_kind?: string | null
  employee_self_service?: number | null
  tablet_station_board?: number | null
  assigned_shift_type?: string | null
  required_for_shift_close?: number | null
  source_shift_id?: string | null
  weekend_task_template_slug?: string | null
  task_category?: string | null
}

function normalizeAssignedTypeDb(raw: string | null | undefined): string {
  const s = String(raw ?? 'all').trim()
  if (s === 'work_area') return 'workArea'
  return s || 'all'
}

export function rowToTaskApi(r: TaskRow) {
  let weekdays: number[] | undefined
  try {
    weekdays = r.weekdays_json ? (JSON.parse(r.weekdays_json) as number[]) : undefined
  } catch {
    weekdays = undefined
  }
  const pr = r.priority ?? 'normal'
  const st = r.start_time != null && String(r.start_time).trim() !== '' ? String(r.start_time).trim() : ''
  const en = r.end_time != null && String(r.end_time).trim() !== '' ? String(r.end_time).trim() : ''
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    workAreaId: r.work_area_id ?? 'kasse',
    assignedType: normalizeAssignedTypeDb(r.assigned_type) as string,
    assignedEmployeeId: r.assigned_employee_id ?? undefined,
    assignedRole: r.assigned_role ?? undefined,
    recurrenceType: (r.recurrence_type ?? 'once') as string,
    startDate: r.start_date ?? '',
    endDate: r.end_date ?? undefined,
    weekdays,
    monthDay: r.month_day ?? undefined,
    startTime: st,
    endTime: en,
    taskKind: (String(r.task_kind ?? 'standard').trim() || 'standard') as string,
    employeeSelfService: (r.employee_self_service ?? 0) === 1,
    tabletStationBoard: (r.tablet_station_board ?? 0) === 1,
    assignedShiftType: r.assigned_shift_type?.trim() || undefined,
    requiredForShiftClose: (r.required_for_shift_close ?? 0) === 1,
    confirmRequired: (r.confirm_required ?? 0) === 1,
    controlRequired: (r.control_required ?? 0) === 1,
    mandatory: (r.mandatory ?? 0) === 1,
    priority: (PRIO_TO_DE[pr] ?? pr) as string,
    active: (r.active ?? 1) === 1,
    icon: r.icon ?? undefined,
    createdBy: r.created_by ?? 'System',
    createdAt: r.created_at ?? nowIso(),
    updatedAt: r.updated_at ?? nowIso(),
  }
}

export type TaskLogRow = {
  id: string
  task_id: string
  employee_id: string | null
  date: string
  status: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  controlled_at: string | null
  controlled_by: string | null
  control_result: string | null
  comment: string | null
}

export function rowToTaskLogApi(r: TaskLogRow) {
  const st = r.status ?? 'open'
  return {
    id: r.id,
    taskId: r.task_id,
    date: r.date,
    status: (LOG_STATUS_TO_DE[st] ?? 'offen') as string,
    confirmedAt: r.confirmed_at ?? undefined,
    confirmedBy: r.confirmed_by ?? undefined,
    controlledAt: r.controlled_at ?? undefined,
    controlledBy: r.controlled_by ?? undefined,
    controlResult: r.control_result
      ? ((CTRL_TO_DE[r.control_result] ?? r.control_result) as string)
      : undefined,
    comment: r.comment ?? undefined,
  }
}

export function listTaskRows(db: Database, stationId = DEFAULT_STATION_ID): TaskRow[] {
  return db.prepare(`SELECT * FROM tasks WHERE station_id = ? ORDER BY title`).all(stationId) as TaskRow[]
}

export function listTasks(db: Database, stationId = DEFAULT_STATION_ID) {
  return listTaskRows(db, stationId).map(rowToTaskApi)
}

export function getTask(db: Database, id: string) {
  const r = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined
  return r ? rowToTaskApi(r) : undefined
}

export function createTask(db: Database, body: Record<string, unknown>, stationId = DEFAULT_STATION_ID) {
  const title = String(body.title ?? '').trim()
  if (!title) throw new Error('title erforderlich')
  const recurrence = String(body.recurrenceType ?? 'once').trim()
  if (!recurrence) throw new Error('recurrence_type erforderlich')
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `task-${randomUUID()}`
  const ts = nowIso()
  const pr = DE_TO_PRIO[String(body.priority ?? 'normal')] ?? String(body.priority ?? 'normal')
  const at = String(body.assignedType ?? 'employee').trim()
  const ess =
    body.employeeSelfService === true
      ? 1
      : body.employeeSelfService === false
        ? 0
        : at === 'employee' || at === 'role' || at === 'workArea' || at === 'work_area'
          ? 1
          : 0
  const tsk = String(body.taskKind ?? 'standard').trim() || 'standard'
  const tsb = body.tabletStationBoard === true ? 1 : 0
  const rfc = body.requiredForShiftClose === true ? 1 : 0
  const ast = body.assignedShiftType != null ? String(body.assignedShiftType).trim() || null : null
  const startT = body.startTime != null && String(body.startTime).trim() ? String(body.startTime).trim() : null
  const endT = body.endTime != null && String(body.endTime).trim() ? String(body.endTime).trim() : null
  const sourceShiftId =
    body.sourceShiftId != null && String(body.sourceShiftId).trim() ? String(body.sourceShiftId).trim() : null
  const weekendTaskTemplateSlug =
    body.weekendTaskTemplateSlug != null && String(body.weekendTaskTemplateSlug).trim()
      ? String(body.weekendTaskTemplateSlug).trim()
      : null
  const taskCategory =
    body.taskCategory != null && String(body.taskCategory).trim() ? String(body.taskCategory).trim() : null
  db.prepare(
    `INSERT INTO tasks (
      id, station_id, title, description, work_area_id, assigned_type, assigned_employee_id, assigned_role,
      recurrence_type, start_date, end_date, weekdays_json, month_day, start_time, end_time,
      confirm_required, control_required, mandatory, priority, active, icon, created_by, created_at, updated_at,
      task_kind, employee_self_service, tablet_station_board, assigned_shift_type, required_for_shift_close,
      source_shift_id, weekend_task_template_slug, task_category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    stationId,
    title,
    String(body.description ?? '') || null,
    body.workAreaId != null ? String(body.workAreaId) : null,
    at,
    body.assignedEmployeeId != null ? String(body.assignedEmployeeId) : null,
    body.assignedRole != null ? String(body.assignedRole) : null,
    recurrence,
    String(body.startDate ?? ts.slice(0, 10)),
    body.endDate != null ? String(body.endDate) : null,
    body.weekdays != null ? JSON.stringify(body.weekdays) : null,
    body.monthDay != null ? Number(body.monthDay) : null,
    startT,
    endT,
    body.confirmRequired === true ? 1 : 0,
    body.controlRequired === true ? 1 : 0,
    body.mandatory === true ? 1 : 0,
    pr,
    body.active === false ? 0 : 1,
    body.icon != null ? String(body.icon) : null,
    String(body.createdBy ?? 'System'),
    ts,
    ts,
    tsk,
    ess,
    tsb,
    ast,
    rfc,
    sourceShiftId,
    weekendTaskTemplateSlug,
    taskCategory,
  )
  return getTask(db, id)
}

export function updateTask(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined
  if (!existing) throw new Error('Aufgabe nicht gefunden')
  const ts = nowIso()
  const pr =
    body.priority != null ? DE_TO_PRIO[String(body.priority)] ?? String(body.priority) : existing.priority
  db.prepare(
    `UPDATE tasks SET
      title = COALESCE(?, title),
      description = ?,
      work_area_id = ?,
      assigned_type = COALESCE(?, assigned_type),
      assigned_employee_id = ?,
      assigned_role = ?,
      recurrence_type = COALESCE(?, recurrence_type),
      start_date = COALESCE(?, start_date),
      end_date = ?,
      weekdays_json = ?,
      month_day = ?,
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      confirm_required = COALESCE(?, confirm_required),
      control_required = COALESCE(?, control_required),
      mandatory = COALESCE(?, mandatory),
      priority = ?,
      active = COALESCE(?, active),
      icon = ?,
      task_kind = ?,
      employee_self_service = ?,
      tablet_station_board = ?,
      assigned_shift_type = ?,
      required_for_shift_close = ?,
      updated_at = ?
    WHERE id = ?`,
  ).run(
    body.title != null ? String(body.title) : null,
    body.description !== undefined ? String(body.description ?? '') : existing.description,
    body.workAreaId !== undefined ? String(body.workAreaId) : existing.work_area_id,
    body.assignedType != null ? String(body.assignedType) : null,
    body.assignedEmployeeId !== undefined
      ? body.assignedEmployeeId == null
        ? null
        : String(body.assignedEmployeeId)
      : existing.assigned_employee_id,
    body.assignedRole !== undefined
      ? body.assignedRole == null
        ? null
        : String(body.assignedRole)
      : existing.assigned_role,
    body.recurrenceType != null ? String(body.recurrenceType) : null,
    body.startDate != null ? String(body.startDate) : null,
    body.endDate !== undefined ? (body.endDate == null ? null : String(body.endDate)) : existing.end_date,
    body.weekdays !== undefined
      ? body.weekdays == null
        ? null
        : JSON.stringify(body.weekdays)
      : existing.weekdays_json,
    body.monthDay !== undefined
      ? body.monthDay == null
        ? null
        : Number(body.monthDay)
      : existing.month_day,
    body.startTime !== undefined ? (body.startTime == null || body.startTime === '' ? null : String(body.startTime)) : existing.start_time,
    body.endTime !== undefined ? (body.endTime == null || body.endTime === '' ? null : String(body.endTime)) : existing.end_time,
    body.confirmRequired != null ? (body.confirmRequired ? 1 : 0) : null,
    body.controlRequired != null ? (body.controlRequired ? 1 : 0) : null,
    body.mandatory != null ? (body.mandatory ? 1 : 0) : null,
    pr,
    body.active != null ? (body.active ? 1 : 0) : null,
    body.icon !== undefined ? (body.icon == null ? null : String(body.icon)) : existing.icon,
    body.taskKind != null ? String(body.taskKind) : String(existing.task_kind ?? 'standard'),
    body.employeeSelfService != null ? (body.employeeSelfService ? 1 : 0) : (existing.employee_self_service ?? 0),
    body.tabletStationBoard != null ? (body.tabletStationBoard ? 1 : 0) : (existing.tablet_station_board ?? 0),
    body.assignedShiftType !== undefined
      ? body.assignedShiftType == null || body.assignedShiftType === ''
        ? null
        : String(body.assignedShiftType)
      : existing.assigned_shift_type ?? null,
    body.requiredForShiftClose != null ? (body.requiredForShiftClose ? 1 : 0) : (existing.required_for_shift_close ?? 0),
    ts,
    id,
  )
  return getTask(db, id)
}

export function deleteTask(db: Database, id: string) {
  db.prepare(`DELETE FROM task_logs WHERE task_id = ?`).run(id)
  const r = db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id)
  if (r.changes === 0) throw new Error('Aufgabe nicht gefunden')
}

export function listTaskLogs(db: Database, q: { taskId?: string; from?: string; to?: string }) {
  let sql = `SELECT * FROM task_logs WHERE 1=1`
  const params: string[] = []
  if (q.taskId) {
    sql += ` AND task_id = ?`
    params.push(q.taskId)
  }
  if (q.from) {
    sql += ` AND date >= ?`
    params.push(q.from)
  }
  if (q.to) {
    sql += ` AND date <= ?`
    params.push(q.to)
  }
  sql += ` ORDER BY date DESC`
  const rows = db.prepare(sql).all(...params) as TaskLogRow[]
  return rows.map(rowToTaskLogApi)
}

export function listTaskLogsByTaskIds(db: Database, taskIds: string[], from?: string, to?: string) {
  if (!taskIds.length) return []
  const ph = taskIds.map(() => '?').join(',')
  let sql = `SELECT * FROM task_logs WHERE task_id IN (${ph})`
  const params: string[] = [...taskIds]
  if (from) {
    sql += ` AND date >= ?`
    params.push(from)
  }
  if (to) {
    sql += ` AND date <= ?`
    params.push(to)
  }
  sql += ` ORDER BY date DESC, updated_at DESC`
  const rows = db.prepare(sql).all(...params) as TaskLogRow[]
  return rows.map(rowToTaskLogApi)
}

export function confirmTask(
  db: Database,
  taskId: string,
  body: { date: string; employeeId?: string; comment?: string; by?: string },
) {
  const date = String(body.date ?? '').trim()
  if (!date) throw new Error('date erforderlich')
  const ts = nowIso()
  const by = body.by ?? 'Station'
  const existing = db
    .prepare(`SELECT * FROM task_logs WHERE task_id = ? AND date = ?`)
    .get(taskId, date) as TaskLogRow | undefined
  const id = existing?.id ?? `tl-${randomUUID()}`
  if (existing) {
    db.prepare(
      `UPDATE task_logs SET status = 'done', confirmed_at = ?, confirmed_by = ?, comment = ?, updated_at = ? WHERE id = ?`,
    ).run(ts, by, body.comment ?? existing.comment, ts, id)
  } else {
    db.prepare(
      `INSERT INTO task_logs (id, task_id, employee_id, date, status, confirmed_at, confirmed_by, comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'done', ?, ?, ?, ?, ?)`,
    ).run(id, taskId, body.employeeId ?? null, date, ts, by, body.comment ?? '', ts, ts)
  }
  return listTaskLogs(db, { taskId })
}

/** Mitarbeiter-App: nach Erledigung ggf. „in_control“ wenn Kontrolle vorgesehen. */
export function confirmTaskFromEmployeeApp(
  db: Database,
  taskId: string,
  opts: { date: string; employeeId: string; confirmedBy: string; comment?: string },
) {
  const date = String(opts.date ?? '').trim()
  if (!date) throw new Error('date erforderlich')
  const taskRow = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId) as TaskRow | undefined
  if (!taskRow) throw new Error('Aufgabe nicht gefunden')
  const controlReq = (taskRow.control_required ?? 0) === 1
  const statusDb = controlReq ? 'in_control' : 'done'
  const ts = nowIso()
  const by = `${opts.confirmedBy} (Mitarbeiter-App)`
  const existing = db
    .prepare(`SELECT * FROM task_logs WHERE task_id = ? AND date = ?`)
    .get(taskId, date) as TaskLogRow | undefined
  const id = existing?.id ?? `tl-${randomUUID()}`
  const comment = opts.comment != null ? String(opts.comment) : existing?.comment ?? ''
  if (existing) {
    db.prepare(
      `UPDATE task_logs SET status = ?, confirmed_at = ?, confirmed_by = ?, employee_id = COALESCE(employee_id, ?), comment = ?, updated_at = ? WHERE id = ?`,
    ).run(statusDb, ts, by, opts.employeeId, comment, ts, id)
  } else {
    db.prepare(
      `INSERT INTO task_logs (id, task_id, employee_id, date, status, confirmed_at, confirmed_by, comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, taskId, opts.employeeId, date, statusDb, ts, by, comment, ts, ts)
  }
  return listTaskLogs(db, { taskId })
}

/** Stations-Tablet: Quelle tablet, station_id + bestätigender Mitarbeiter. */
export function confirmTaskFromTablet(
  db: Database,
  taskId: string,
  opts: { date: string; employeeId: string; displayName: string; comment?: string; stationId: string },
) {
  const date = String(opts.date ?? '').trim()
  if (!date) throw new Error('date erforderlich')
  const stationId = String(opts.stationId ?? '').trim()
  if (!stationId) throw new Error('stationId erforderlich')
  const taskRow = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId) as TaskRow | undefined
  if (!taskRow) throw new Error('Aufgabe nicht gefunden')
  if (String(taskRow.station_id ?? '').trim() !== stationId) throw new Error('Aufgabe gehört nicht zu dieser Station')
  const controlReq = (taskRow.control_required ?? 0) === 1
  const statusDb = controlReq ? 'in_control' : 'done'
  const ts = nowIso()
  const by = `${opts.displayName} (Tablet)`
  const existing = db
    .prepare(`SELECT * FROM task_logs WHERE task_id = ? AND date = ?`)
    .get(taskId, date) as TaskLogRow | undefined
  const id = existing?.id ?? `tl-${randomUUID()}`
  const comment = opts.comment != null ? String(opts.comment) : existing?.comment ?? ''
  if (existing) {
    db.prepare(
      `UPDATE task_logs SET status = ?, confirmed_at = ?, confirmed_by = ?, employee_id = COALESCE(employee_id, ?), comment = ?, station_id = ?, source = ?, confirmed_by_employee_id = ?, updated_at = ? WHERE id = ?`,
    ).run(statusDb, ts, by, opts.employeeId, comment, stationId, 'tablet', opts.employeeId, ts, id)
  } else {
    db.prepare(
      `INSERT INTO task_logs (id, task_id, employee_id, date, status, confirmed_at, confirmed_by, comment, station_id, source, confirmed_by_employee_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, taskId, opts.employeeId, date, statusDb, ts, by, comment, stationId, 'tablet', opts.employeeId, ts, ts)
  }
  return listTaskLogs(db, { taskId })
}

/** Schichtende: Erledigt-Meldung inkl. time_entry_id (Quelle employee_app / tablet). */
export function upsertTaskLogAtShiftCheckoutDone(
  db: Database,
  p: {
    taskId: string
    dateYmd: string
    employeeId: string
    stationId: string
    timeEntryId: string
    source: 'employee_app' | 'tablet'
    displayName: string
  },
) {
  const taskRow = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(p.taskId) as TaskRow | undefined
  if (!taskRow) throw new Error('Aufgabe nicht gefunden')
  const controlReq = (taskRow.control_required ?? 0) === 1
  const statusDb = controlReq ? 'in_control' : 'done'
  const ts = nowIso()
  const tag = p.source === 'employee_app' ? 'Mitarbeiter-App' : 'Tablet'
  const by = `${p.displayName} (Schichtende · ${tag})`
  const srcDb = p.source
  const existing = db
    .prepare(`SELECT * FROM task_logs WHERE task_id = ? AND date = ?`)
    .get(p.taskId, p.dateYmd) as TaskLogRow | undefined
  const id = existing?.id ?? `tl-${randomUUID()}`
  const comment = existing?.comment ?? ''
  if (existing) {
    db.prepare(
      `UPDATE task_logs SET status = ?, confirmed_at = ?, confirmed_by = ?, employee_id = COALESCE(employee_id, ?), comment = ?, station_id = ?, source = ?, confirmed_by_employee_id = ?, time_entry_id = ?, updated_at = ? WHERE id = ?`,
    ).run(statusDb, ts, by, p.employeeId, comment, p.stationId, srcDb, p.employeeId, p.timeEntryId, ts, id)
  } else {
    db.prepare(
      `INSERT INTO task_logs (id, task_id, employee_id, date, status, confirmed_at, confirmed_by, comment, station_id, source, confirmed_by_employee_id, time_entry_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      p.taskId,
      p.employeeId,
      p.dateYmd,
      statusDb,
      ts,
      by,
      comment,
      p.stationId,
      srcDb,
      p.employeeId,
      p.timeEntryId,
      ts,
      ts,
    )
  }
}

export function controlTask(
  db: Database,
  taskId: string,
  body: { date: string; result: string; comment?: string; by?: string },
) {
  const date = String(body.date ?? '').trim()
  if (!date) throw new Error('date erforderlich')
  const ts = nowIso()
  const by = body.by ?? 'Station'
  const resultDe = String(body.result ?? 'ok')
  const ctrl =
    resultDe === 'mangel' || resultDe === 'nacharbeiten' ? resultDe : resultDe === 'ok' ? 'ok' : 'ok'
  const existing = db
    .prepare(`SELECT * FROM task_logs WHERE task_id = ? AND date = ?`)
    .get(taskId, date) as TaskLogRow | undefined
  const id = existing?.id ?? `tl-${randomUUID()}`
  const status = ctrl === 'ok' ? 'controlled' : 'issue'
  if (existing) {
    db.prepare(
      `UPDATE task_logs SET status = ?, controlled_at = ?, controlled_by = ?, control_result = ?, comment = ?, updated_at = ? WHERE id = ?`,
    ).run(status, ts, by, ctrl, body.comment ?? existing.comment, ts, id)
  } else {
    db.prepare(
      `INSERT INTO task_logs (id, task_id, employee_id, date, status, controlled_at, controlled_by, control_result, comment, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, taskId, date, status, ts, by, ctrl, body.comment ?? '', ts, ts)
  }
  return listTaskLogs(db, { taskId })
}
