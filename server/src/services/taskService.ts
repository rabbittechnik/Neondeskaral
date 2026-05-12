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
}

export function rowToTaskApi(r: TaskRow) {
  let weekdays: number[] | undefined
  try {
    weekdays = r.weekdays_json ? (JSON.parse(r.weekdays_json) as number[]) : undefined
  } catch {
    weekdays = undefined
  }
  const pr = r.priority ?? 'normal'
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    workAreaId: r.work_area_id ?? 'kasse',
    assignedType: (r.assigned_type ?? 'all') as string,
    assignedEmployeeId: r.assigned_employee_id ?? undefined,
    assignedRole: r.assigned_role ?? undefined,
    recurrenceType: (r.recurrence_type ?? 'once') as string,
    startDate: r.start_date ?? '',
    endDate: r.end_date ?? undefined,
    weekdays,
    monthDay: r.month_day ?? undefined,
    startTime: r.start_time ?? '06:00',
    endTime: r.end_time ?? '22:00',
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

export function listTasks(db: Database, stationId = DEFAULT_STATION_ID) {
  const rows = db
    .prepare(`SELECT * FROM tasks WHERE station_id = ? ORDER BY title`)
    .all(stationId) as TaskRow[]
  return rows.map(rowToTaskApi)
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
  db.prepare(
    `INSERT INTO tasks (
      id, station_id, title, description, work_area_id, assigned_type, assigned_employee_id, assigned_role,
      recurrence_type, start_date, end_date, weekdays_json, month_day, start_time, end_time,
      confirm_required, control_required, mandatory, priority, active, icon, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    stationId,
    title,
    String(body.description ?? '') || null,
    body.workAreaId != null ? String(body.workAreaId) : null,
    String(body.assignedType ?? 'all'),
    body.assignedEmployeeId != null ? String(body.assignedEmployeeId) : null,
    body.assignedRole != null ? String(body.assignedRole) : null,
    recurrence,
    String(body.startDate ?? ts.slice(0, 10)),
    body.endDate != null ? String(body.endDate) : null,
    body.weekdays != null ? JSON.stringify(body.weekdays) : null,
    body.monthDay != null ? Number(body.monthDay) : null,
    String(body.startTime ?? '06:00'),
    String(body.endTime ?? '22:00'),
    body.confirmRequired === true ? 1 : 0,
    body.controlRequired === true ? 1 : 0,
    body.mandatory === true ? 1 : 0,
    pr,
    body.active === false ? 0 : 1,
    body.icon != null ? String(body.icon) : null,
    String(body.createdBy ?? 'System'),
    ts,
    ts,
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
    body.startTime != null ? String(body.startTime) : null,
    body.endTime != null ? String(body.endTime) : null,
    body.confirmRequired != null ? (body.confirmRequired ? 1 : 0) : null,
    body.controlRequired != null ? (body.controlRequired ? 1 : 0) : null,
    body.mandatory != null ? (body.mandatory ? 1 : 0) : null,
    pr,
    body.active != null ? (body.active ? 1 : 0) : null,
    body.icon !== undefined ? (body.icon == null ? null : String(body.icon)) : existing.icon,
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
