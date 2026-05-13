import type { Database } from 'better-sqlite3'
import { listEmployeesTabletClock } from './employeeService.js'
import { listShiftRowsForStationDateRange, type ShiftRow } from './shiftService.js'
import { displayHHMM, formatHmDuration, ymdBerlinFromUtcMs } from '../utils/europeBerlinWallTime.js'
import { shiftBoundsBerlin } from '../utils/shiftBerlinBounds.js'

const PRE_START_MS = 60 * 60 * 1000
const POST_END_MS = 15 * 60 * 1000

export type TabletCheckInSuggestionStatus = 'starts_soon' | 'shift_active'

export type TabletCheckInSuggestionApi = {
  employeeId: string
  employeeName: string
  shiftId: string
  plannedStart: string
  plannedEnd: string
  plannedStartAt: string
  plannedEndAt: string
  status: TabletCheckInSuggestionStatus
  /** Minuten relativ zum geplanten Schichtbeginn in Berlin (negativ = vor Start). */
  deviationMinutes: number
  displayText: string
}

export type TabletCheckInAllEmployeeApi = {
  employeeId: string
  employeeName: string
  role: string
  isClockedIn: boolean
  /** Kurzinfo zur heutigen Schicht (nur Anzeige, nicht für Vorschlag oben). */
  todayHint?: string
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

function displayTextForSuggestion(nowMs: number, startMs: number, status: TabletCheckInSuggestionStatus): string {
  if (status === 'starts_soon') {
    const untilMin = Math.max(0, Math.round((startMs - nowMs) / 60_000))
    if (untilMin < 1) return 'Start jetzt'
    return `Start in ${formatHmDuration(untilMin)}`
  }
  const sinceMin = Math.max(0, Math.round((nowMs - startMs) / 60_000))
  if (sinceMin < 1) return 'Geplanter Beginn jetzt'
  return `Beginn vor ${formatHmDuration(sinceMin)}`
}

function employeeTodayHint(
  empId: string,
  shiftRows: ShiftRow[],
  nowMs: number,
  suggestedIds: Set<string>,
): string | undefined {
  if (suggestedIds.has(empId)) return undefined

  const todayYmd = ymdBerlinFromUtcMs(nowMs)
  const mine = shiftRows.filter(
    (s) =>
      String(s.employee_id ?? '').trim() === empId &&
      String(s.date ?? '').trim() === todayYmd &&
      (s.published ?? 0) === 1 &&
      String(s.shift_type ?? '').trim().toLowerCase() !== 'frei',
  )
  if (mine.length === 0) return 'Heute keine Schicht'

  const bounds = mine
    .map((r) => ({ row: r, b: shiftBoundsBerlin(r) }))
    .filter((x): x is { row: ShiftRow; b: { startMs: number; endMs: number } } => x.b != null)
    .sort((a, b) => a.b.startMs - b.b.startMs)

  if (bounds.length === 0) return 'Heute keine Schicht'

  const endCut = (b: { endMs: number }) => b.endMs + POST_END_MS
  const startWin = (b: { startMs: number }) => b.startMs - PRE_START_MS

  const eligible = bounds.filter(
    (x) => nowMs >= startWin(x.b) && nowMs <= endCut(x.b),
  )
  if (eligible.length > 0) return undefined

  const ended = bounds.filter((x) => nowMs > endCut(x.b))
  if (ended.length > 0) {
    const last = ended.reduce((a, x) => (x.b.endMs > a.b.endMs ? x : a))
    const a = displayHHMM(String(last.row.start_time))
    const b = displayHHMM(String(last.row.end_time))
    return `Schicht heute beendet · geplant ${a}–${b} Uhr`
  }

  const allFuture = bounds.every((x) => nowMs < startWin(x.b))
  if (allFuture) {
    const next = bounds[0]!
    const a = displayHHMM(String(next.row.start_time))
    const b = displayHHMM(String(next.row.end_time))
    return `Heute keine aktuelle Schicht · nächste ${a}–${b} Uhr`
  }

  return 'Heute keine aktuelle Schicht'
}

/**
 * Check-in-Vorschläge: nur Schichten, die in Europe/Berlin noch nicht länger als 15 Min. nach Planende vorbei sind,
 * und höchstens 60 Min. vor Planbeginn sichtbar werden.
 */
export function buildTabletCheckInSuggestions(db: Database, stationId: string, now = new Date()) {
  const nowMs = now.getTime()
  const todayYmd = ymdBerlinFromUtcMs(nowMs)

  const clocked = runningEmployeeIds(db, stationId)
  const emps = listEmployeesTabletClock(db, stationId)
  const nameById = new Map(emps.map((e) => [e.id, String(e.displayName ?? '').trim() || 'Mitarbeiter']))
  const eligibleEmp = new Set(
    emps.filter((e) => e.terminalEnabled && e.timeTrackingEnabled).map((e) => e.id),
  )

  const shiftRows = listShiftRowsForStationDateRange(db, stationId, todayYmd, todayYmd)
  const suggestions: TabletCheckInSuggestionApi[] = []

  for (const s of shiftRows) {
    if ((s.published ?? 0) !== 1) continue
    if (String(s.shift_type ?? '').trim().toLowerCase() === 'frei') continue
    const empId = String(s.employee_id ?? '').trim()
    if (!empId || !eligibleEmp.has(empId)) continue
    if (clocked.has(empId)) continue

    const bounds = shiftBoundsBerlin(s)
    if (!bounds) continue
    const { startMs, endMs } = bounds
    const endCutMs = endMs + POST_END_MS

    if (nowMs > endCutMs) continue
    if (nowMs < startMs - PRE_START_MS) continue

    let status: TabletCheckInSuggestionStatus
    if (nowMs < startMs) {
      status = 'starts_soon'
    } else {
      status = 'shift_active'
    }

    const deviationMinutes = Math.round((nowMs - startMs) / 60_000)
    const plannedStartAt = new Date(startMs).toISOString()
    const plannedEndAt = new Date(endMs).toISOString()

    suggestions.push({
      employeeId: empId,
      employeeName: nameById.get(empId) ?? 'Mitarbeiter',
      shiftId: String(s.id),
      plannedStart: displayHHMM(String(s.start_time)),
      plannedEnd: displayHHMM(String(s.end_time)),
      plannedStartAt,
      plannedEndAt,
      status,
      deviationMinutes,
      displayText: displayTextForSuggestion(nowMs, startMs, status),
    })
  }

  suggestions.sort((a, b) => {
    const ta = `${a.plannedStart}`.localeCompare(`${b.plannedStart}`)
    if (ta !== 0) return ta
    const n = a.employeeName.localeCompare(b.employeeName, 'de')
    if (n !== 0) return n
    return a.shiftId.localeCompare(b.shiftId)
  })

  const suggestedEmp = new Set(suggestions.map((x) => x.employeeId))

  const allEmployees: TabletCheckInAllEmployeeApi[] = emps
    .filter((e) => e.terminalEnabled && e.timeTrackingEnabled)
    .map((e) => ({
      employeeId: e.id,
      employeeName: String(e.displayName ?? '').trim() || 'Mitarbeiter',
      role: [String(e.role ?? '').trim(), String(e.employmentRole ?? '').trim()].filter(Boolean).join(' · '),
      isClockedIn: clocked.has(e.id),
      todayHint: employeeTodayHint(e.id, shiftRows, nowMs, suggestedEmp),
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'))

  return { suggestions, allEmployees }
}
