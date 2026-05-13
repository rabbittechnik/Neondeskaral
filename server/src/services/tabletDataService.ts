import type { Database } from 'better-sqlite3'
import { listEmployeesTabletClock, getEmployeeRowInternal, type EmployeeRow } from './employeeService.js'
import { listShifts } from './shiftService.js'
import { listTimeEntries } from './timeTrackingService.js'
import { listWorkAreas } from './workAreaService.js'
import { listTaskRows, listTaskLogsByTaskIds, rowToTaskApi, type TaskRow } from './taskService.js'
import {
  buildTaskTimeCaption,
  isTaskDueOnDateRow,
  taskEligibleForEmployeeRow,
  taskEligibleForTabletStationBoard,
  type TodayShiftLite,
} from './taskEligibilityService.js'

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

function isCloseTaskRow(r: TaskRow): boolean {
  return String(r.task_kind ?? '').trim().toLowerCase() === 'shift_close' || (r.required_for_shift_close ?? 0) === 1
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
  const taskRows = listTaskRows(db, stationId)

  let eligible: TaskRow[]
  let primaryShift: TodayShiftLite | null = null

  const empTrim = employeeId?.trim() ? employeeId.trim() : ''
  if (empTrim) {
    const row = getEmployeeRowInternal(db, empTrim)
    if (!row || String(row.station_id) !== stationId) {
      eligible = taskRows.filter((r) => taskEligibleForTabletStationBoard(r, todayYmd))
    } else {
      const empRole = String(row.role ?? '').trim()
      const empJobTitle = employmentRoleFromRow(row)
      const todayShiftsRaw = listShifts(db, { stationId, employeeId: empTrim, from: todayYmd, to: todayYmd })
      const todayShiftLites: TodayShiftLite[] = todayShiftsRaw.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        workAreaId: s.workAreaId,
        shiftType: s.shiftType,
      }))
      primaryShift = todayShiftLites[0] ?? null
      const todayShiftAreas = new Set(
        todayShiftsRaw.map((s) => s.workAreaId).filter(Boolean) as string[],
      )
      const ewaIds = employeeWorkAreaIds(db, empTrim)
      eligible = taskRows.filter(
        (r) =>
          isTaskDueOnDateRow(r, todayYmd) &&
          taskEligibleForEmployeeRow(r, empTrim, empRole, empJobTitle, ewaIds, todayShiftAreas, todayShiftLites),
      )
    }
  } else {
    eligible = taskRows.filter((r) => taskEligibleForTabletStationBoard(r, todayYmd))
  }

  const mainRows = eligible.filter((r) => !isCloseTaskRow(r))
  const closeRows = eligible.filter((r) => isCloseTaskRow(r))

  const mapTaskWithCaption = (r: TaskRow) => ({
    ...rowToTaskApi(r),
    timeCaption: buildTaskTimeCaption(r, { todayYmd, primaryShift }),
  })
  const tasks = mainRows.map(mapTaskWithCaption)

  const logFrom = addDaysToYmd(todayYmd, -7)
  const logTo = addDaysToYmd(todayYmd, 21)
  const taskLogs = listTaskLogsByTaskIds(
    db,
    [...mainRows, ...closeRows].map((x) => x.id),
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
