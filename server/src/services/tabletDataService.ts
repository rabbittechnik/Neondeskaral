import type { Database } from 'better-sqlite3'
import { listEmployeesTabletClock, getEmployeeRowInternal, type EmployeeRow } from './employeeService.js'
import { listShifts } from './shiftService.js'
import { listTimeEntries } from './timeTrackingService.js'
import { listWorkAreas } from './workAreaService.js'
import { listTasks, listTaskLogsByTaskIds, rowToTaskApi } from './taskService.js'

function ymdFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysToYmd(ymd: string, n: number): string {
  const [y, mo, da] = ymd.split('-').map(Number)
  const d = new Date(y!, mo! - 1, da! + n)
  return ymdFromDate(d)
}

function normalizeRoleToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function employeeWorkAreaIds(db: Database, employeeId: string): string[] {
  const rows = db
    .prepare(`SELECT work_area_id FROM employee_work_areas WHERE employee_id = ?`)
    .all(employeeId) as { work_area_id: string }[]
  return [...new Set(rows.map((r) => String(r.work_area_id ?? '')).filter(Boolean))]
}

function employmentRoleFromRow(row: EmployeeRow): string {
  const raw = (row as Record<string, unknown>).employment_role
  return typeof raw === 'string' ? raw.trim() : ''
}

type TaskApi = ReturnType<typeof rowToTaskApi>

function taskRelevantForEmployee(
  t: TaskApi,
  empId: string,
  empRole: string,
  empJobTitle: string,
  workAreaIds: string[],
  todayShiftWorkAreaIds: Set<string>,
): boolean {
  if (!t.active) return false
  const type = String(t.assignedType ?? 'all')
  if (type === 'all') return true
  if (type === 'employee') return t.assignedEmployeeId === empId
  if (type === 'role') {
    const ar = normalizeRoleToken(String(t.assignedRole ?? ''))
    if (!ar) return false
    const pool = normalizeRoleToken(`${empRole} ${empJobTitle}`)
    if (pool.includes(ar)) return true
    for (const part of ar.split('/')) {
      const p = part.trim().toLowerCase()
      if (p && pool.includes(p)) return true
    }
    return false
  }
  if (type === 'workArea') {
    const wid = String(t.workAreaId ?? '')
    if (wid && workAreaIds.includes(wid)) return true
    if (wid && todayShiftWorkAreaIds.has(wid)) return true
    return false
  }
  return false
}

function isTaskDueOnDate(t: TaskApi, date: string): boolean {
  if (!t.active) return false
  if (date < t.startDate) return false
  if (t.endDate && date > t.endDate) return false
  switch (t.recurrenceType) {
    case 'once':
      return t.startDate === date
    case 'daily':
      return true
    case 'weekly': {
      const wd = new Date(`${date}T12:00:00`).getDay()
      const set = t.weekdays?.length ? t.weekdays : [1, 2, 3, 4, 5, 6, 0]
      return set.includes(wd)
    }
    case 'monthly': {
      const dom = Number(date.slice(8, 10))
      return dom === (t.monthDay ?? 1)
    }
    default:
      return false
  }
}

export function listTabletShiftsRange(db: Database, stationId: string, from: string, to: string) {
  return listShifts(db, { stationId, from, to })
}

export function listTabletRunningPresence(db: Database, stationId: string) {
  const rows = db
    .prepare(
      `SELECT te.*, e.display_name AS emp_display_name
       FROM time_entries te
       JOIN employees e ON e.id = te.employee_id
       WHERE te.station_id = ? AND te.status = 'running' AND (te.end_at IS NULL OR trim(te.end_at) = '')
       ORDER BY te.start_at`,
    )
    .all(stationId) as ({ emp_display_name: string } & Record<string, unknown>)[]
  return rows.map((r) => ({
    id: String(r.id),
    employeeId: String(r.employee_id),
    displayName: String(r.emp_display_name ?? '').trim() || 'Mitarbeiter',
    startAt: String(r.start_at),
    source: String(r.source ?? 'manual'),
  }))
}

export function getTabletWeekSchedule(db: Database, stationId: string, weekStartMonday: string) {
  const mon = /^\d{4}-\d{2}-\d{2}$/.test(weekStartMonday) ? weekStartMonday : ymdFromDate(new Date())
  const sun = addDaysToYmd(mon, 6)
  const shifts = listShifts(db, { stationId, from: mon, to: sun })
  return shifts
}

export function getTabletTasksPayload(db: Database, stationId: string, employeeId?: string | null) {
  const todayYmd = ymdFromDate(new Date())
  const tasksAll = listTasks(db, stationId)
  let tasks = tasksAll

  if (employeeId && employeeId.trim()) {
    const empId = employeeId.trim()
    const row = getEmployeeRowInternal(db, empId)
    if (!row || String(row.station_id) !== stationId) {
      tasks = tasksAll.filter((t) => String(t.assignedType ?? 'all') === 'all')
    } else {
      const empRole = String(row.role ?? '').trim()
      const empJobTitle = employmentRoleFromRow(row)
      const todayShiftAreas = new Set(
        listShifts(db, { stationId, employeeId: empId, from: todayYmd, to: todayYmd })
          .map((s) => s.workAreaId)
          .filter(Boolean) as string[],
      )
      const ewaIds = employeeWorkAreaIds(db, empId)
      tasks = tasksAll.filter((t) => taskRelevantForEmployee(t, empId, empRole, empJobTitle, ewaIds, todayShiftAreas))
    }
  } else {
    tasks = tasksAll.filter((t) => String(t.assignedType ?? 'all') === 'all')
  }

  tasks = tasks.filter((t) => isTaskDueOnDate(t, todayYmd))

  const logFrom = addDaysToYmd(todayYmd, -7)
  const logTo = addDaysToYmd(todayYmd, 21)
  const taskLogs = listTaskLogsByTaskIds(
    db,
    tasks.map((x) => x.id),
    logFrom,
    logTo,
  )

  return { tasks, taskLogs }
}

export { listEmployeesTabletClock }

export function listTabletTimeEntriesWide(db: Database, stationId: string) {
  return listTimeEntries(db, {
    stationId,
    from: '2025-01-01T00:00:00.000Z',
    to: '2028-12-31T23:59:59.999Z',
  })
}

export function listTabletWorkAreas(db: Database, stationId: string) {
  return listWorkAreas(db, stationId)
}
