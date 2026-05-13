import type { TaskRow } from './taskService.js'

export type TodayShiftLite = {
  startTime: string
  endTime: string
  workAreaId?: string
  shiftType?: string | null
}

function normalizeRoleToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Liegt `date` im Start-/Enddatum der Aufgabe? (YYYY-MM-DD) */
export function isTaskDueOnDateRow(row: TaskRow, date: string): boolean {
  const start = String(row.start_date ?? '').trim()
  if (!start || date < start) return false
  const end = String(row.end_date ?? '').trim()
  if (end && date > end) return false
  const rec = String(row.recurrence_type ?? 'once').trim()
  if (rec === 'once') return start === date
  if (rec === 'daily') return true
  if (rec === 'weekly') {
    let set: number[]
    try {
      set = row.weekdays_json ? (JSON.parse(row.weekdays_json) as number[]) : [1, 2, 3, 4, 5, 6, 0]
    } catch {
      set = [1, 2, 3, 4, 5, 6, 0]
    }
    const wd = new Date(`${date}T12:00:00`).getDay()
    return set.includes(wd)
  }
  if (rec === 'monthly') {
    const dom = Number(date.slice(8, 10))
    return dom === (row.month_day ?? 1)
  }
  return false
}

function isManagementEmployee(empRole: string, empJobTitle: string): boolean {
  const pool = normalizeRoleToken(`${empRole} ${empJobTitle}`)
  return (
    pool.includes('inhaber') ||
    pool.includes('chef') ||
    pool.includes('stationsleiter') ||
    pool.includes('teamleitung') ||
    pool.includes('teamleiter') ||
    pool.includes('leitung')
  )
}

/**
 * Sichtbarkeit für Mitarbeiter-App / Tablet (eingestempelter Mitarbeiter).
 * Kein Pauschal-„all“ mehr ohne explizites employee_self_service.
 */
export function taskEligibleForEmployeeRow(
  row: TaskRow,
  empId: string,
  empRole: string,
  empJobTitle: string,
  workAreaIds: string[],
  todayShiftWorkAreaIds: Set<string>,
  todayShifts: TodayShiftLite[],
): boolean {
  if ((row.active ?? 1) !== 1) return false
  const kind = String(row.task_kind ?? 'standard').trim().toLowerCase()
  if (kind === 'admin') {
    return isManagementEmployee(empRole, empJobTitle)
  }
  const assignedShift = String(row.assigned_shift_type ?? '').trim()
  if (assignedShift) {
    const types = todayShifts.map((s) => normalizeRoleToken(String(s.shiftType ?? '')))
    const needle = normalizeRoleToken(assignedShift)
    if (!types.some((t) => t.includes(needle) || needle.includes(t))) return false
  }

  const raw = String(row.assigned_type ?? 'all').trim().toLowerCase()
  const type = raw === 'work_area' || raw === 'workarea' ? 'workarea' : raw

  const selfService = ((row as { employee_self_service?: number | null }).employee_self_service ?? 0) === 1

  if (type === 'all') {
    return selfService
  }
  if (type === 'employee') {
    return String(row.assigned_employee_id ?? '').trim() === empId
  }
  if (type === 'role') {
    const ar = normalizeRoleToken(String(row.assigned_role ?? ''))
    if (!ar) return false
    const pool = normalizeRoleToken(`${empRole} ${empJobTitle}`)
    if (pool.includes(ar)) return true
    for (const part of ar.split('/')) {
      const p = part.trim().toLowerCase()
      if (p && pool.includes(p)) return true
    }
    return false
  }
  if (type === 'workarea') {
    const wid = String(row.work_area_id ?? '')
    if (wid && workAreaIds.includes(wid)) return true
    if (wid && todayShiftWorkAreaIds.has(wid)) return true
    return false
  }
  return false
}

/** Tablet ohne ausgewählten Mitarbeiter: nur Stations-Board-Aufgaben. */
export function taskEligibleForTabletStationBoard(row: TaskRow, date: string): boolean {
  if ((row.active ?? 1) !== 1) return false
  const kind = String(row.task_kind ?? 'standard').trim().toLowerCase()
  if (kind === 'admin' || kind === 'shift_close') return false
  if (!isTaskDueOnDateRow(row, date)) return false
  return ((row as { tablet_station_board?: number | null }).tablet_station_board ?? 0) === 1
}

export function isDefaultStationTimeWindow(start: string | null | undefined, end: string | null | undefined): boolean {
  const s = String(start ?? '').trim()
  const e = String(end ?? '').trim()
  return (s === '06:00' && e === '22:00') || (!s && !e)
}

export function buildTaskTimeCaption(
  row: TaskRow,
  opts: { todayYmd: string; primaryShift: TodayShiftLite | null },
): string {
  const kind = String(row.task_kind ?? 'standard').trim().toLowerCase()
  if (kind === 'shift_close' || ((row as { required_for_shift_close?: number }).required_for_shift_close ?? 0) === 1) {
    return 'Beim Schichtabschluss erledigen'
  }
  const start = String(row.start_date ?? '').trim()
  const end = String(row.end_date ?? '').trim()
  if (start && end && start !== end) {
    const fd = (ymd: string) => {
      const [y, m, d] = ymd.split('-')
      return `${d}.${m}.${y}`
    }
    return `Gültig vom ${fd(start)} bis ${fd(end)}`
  }
  const st = String(row.start_time ?? '').trim()
  const en = String(row.end_time ?? '').trim()
  if (opts.primaryShift && isDefaultStationTimeWindow(st, en)) {
    return `Während deiner Schicht: ${opts.primaryShift.startTime}–${opts.primaryShift.endTime} Uhr`
  }
  if (st && en) return `${st}–${en} Uhr`
  if (st || en) return `${st || '—'}–${en || '—'} Uhr`
  return 'Keine feste Uhrzeit'
}
