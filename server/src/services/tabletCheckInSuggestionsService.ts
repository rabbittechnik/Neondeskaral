import type { Database } from 'better-sqlite3'
import { listEmployeesTabletClock } from './employeeService.js'
import { listShiftRowsForStationDateRange, type ShiftRow } from './shiftService.js'

const WINDOW_MS = 60 * 60 * 1000

export type TabletCheckInSuggestionStatus = 'starts_soon' | 'should_have_started' | 'currently_running'

export type TabletCheckInSuggestionApi = {
  employeeId: string
  employeeName: string
  shiftId: string
  plannedStart: string
  plannedEnd: string
  status: TabletCheckInSuggestionStatus
  /** Minuten relativ zum geplanten Schichtbeginn (negativ = früher). */
  deviationMinutes: number
}

export type TabletCheckInAllEmployeeApi = {
  employeeId: string
  employeeName: string
  role: string
  isClockedIn: boolean
}

function ymdFromDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function padHHMM(t: string): string {
  const s = String(t ?? '').trim()
  const parts = s.split(':')
  const h = String(parts[0] ?? '0').padStart(2, '0')
  const m = String(parts[1] ?? '0').padStart(2, '0')
  return `${h}:${m}`
}

function displayHHMM(t: string): string {
  return padHHMM(t).slice(0, 5)
}

/** Lokales Schichtfenster; end vor start → Ende am Folgetag. */
function shiftBoundsLocal(row: ShiftRow): { start: Date; end: Date } | null {
  const date = String(row.date ?? '').trim()
  const st = String(row.start_time ?? '').trim()
  const en = String(row.end_time ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !st || !en) return null
  const start = new Date(`${date}T${padHHMM(st)}:00`)
  const end = new Date(`${date}T${padHHMM(en)}:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (end.getTime() <= start.getTime()) {
    end.setTime(end.getTime() + 24 * 60 * 60 * 1000)
  }
  return { start, end }
}

function runningEmployeeIds(db: Database, stationId: string): Set<string> {
  const rows = db
    .prepare(
      `SELECT employee_id FROM time_entries
       WHERE station_id = ? AND status = 'running' AND (end_at IS NULL OR trim(end_at) = '')`,
    )
    .all(stationId) as { employee_id: string }[]
  return new Set(rows.map((r) => String(r.employee_id ?? '').trim()).filter(Boolean))
}

/**
 * Vorschläge für Check-in: Schicht beginnt in ≤60 min, oder Start liegt höchstens 60 min zurück,
 * oder Schicht läuft noch (bis geplantes Ende) — jeweils nur veröffentlichte Schichten, Station,
 * nicht eingestempelte, Terminal+Zeit aktiv.
 */
export function buildTabletCheckInSuggestions(db: Database, stationId: string, now = new Date()) {
  const today = ymdFromDateLocal(now)
  const clocked = runningEmployeeIds(db, stationId)
  const emps = listEmployeesTabletClock(db, stationId)
  const nameById = new Map(emps.map((e) => [e.id, String(e.displayName ?? '').trim() || 'Mitarbeiter']))
  const eligibleEmp = new Set(
    emps.filter((e) => e.terminalEnabled && e.timeTrackingEnabled).map((e) => e.id),
  )

  const shiftRows = listShiftRowsForStationDateRange(db, stationId, today, today)
  const suggestions: TabletCheckInSuggestionApi[] = []
  const nowMs = now.getTime()

  for (const s of shiftRows) {
    if ((s.published ?? 0) !== 1) continue
    if (String(s.shift_type ?? '').trim().toLowerCase() === 'frei') continue
    const empId = String(s.employee_id ?? '').trim()
    if (!empId || !eligibleEmp.has(empId)) continue
    if (clocked.has(empId)) continue

    const bounds = shiftBoundsLocal(s)
    if (!bounds) continue
    const { start: startD, end: endD } = bounds
    if (nowMs < startD.getTime() - WINDOW_MS) continue
    if (nowMs >= endD.getTime()) continue

    let status: TabletCheckInSuggestionStatus
    if (nowMs < startD.getTime()) {
      status = 'starts_soon'
    } else if (nowMs <= startD.getTime() + WINDOW_MS) {
      status = 'should_have_started'
    } else {
      status = 'currently_running'
    }

    const deviationMinutes = Math.round((nowMs - startD.getTime()) / 60_000)

    suggestions.push({
      employeeId: empId,
      employeeName: nameById.get(empId) ?? 'Mitarbeiter',
      shiftId: String(s.id),
      plannedStart: displayHHMM(String(s.start_time)),
      plannedEnd: displayHHMM(String(s.end_time)),
      status,
      deviationMinutes,
    })
  }

  suggestions.sort((a, b) => {
    const ta = `${a.plannedStart}`.localeCompare(`${b.plannedStart}`)
    if (ta !== 0) return ta
    const n = a.employeeName.localeCompare(b.employeeName, 'de')
    if (n !== 0) return n
    return a.shiftId.localeCompare(b.shiftId)
  })

  const allEmployees: TabletCheckInAllEmployeeApi[] = emps
    .filter((e) => e.terminalEnabled && e.timeTrackingEnabled)
    .map((e) => ({
      employeeId: e.id,
      employeeName: String(e.displayName ?? '').trim() || 'Mitarbeiter',
      role: [String(e.role ?? '').trim(), String(e.employmentRole ?? '').trim()].filter(Boolean).join(' · '),
      isClockedIn: clocked.has(e.id),
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'))

  return { suggestions, allEmployees }
}
