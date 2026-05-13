import type { Database } from 'better-sqlite3'
import type { ShiftRow } from '../services/shiftService.js'
import { listShiftRowsForStationDateRange } from '../services/shiftService.js'
import type { ShiftCloseChecklistKind } from '../constants/shiftCloseChecklistCatalog.js'

function parseHHMM(t: string): number {
  const [h, m] = String(t ?? '').split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function plannedShiftForDate(
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
  list.sort((a, b) => parseHHMM(a.start_time) - parseHHMM(b.start_time))
  return list[0] ?? null
}

function isLateShiftType(shiftType: string | null | undefined): boolean {
  const s = String(shiftType ?? '').toLowerCase()
  return /spät|spaet|nacht|schließ|schliess|close|ladenende|schluss|abend/i.test(s)
}

/**
 * Regeln: Ende ~13:30–14:30 → Übergabe; Ende ≥19:30 oder Spät-Typ → Ladenschluss;
 * keine Schicht → aktuelle Uhrzeit vor 16:00 Übergabe, sonst Abschluss;
 * sonst: Ende vor 16:00 → Übergabe, ab 16:00 → Abschluss (wenn nicht in 13:30–14:30).
 */
export function resolveShiftCloseChecklistKind(p: {
  db: Database
  stationId: string
  employeeId: string
  shiftId: string | null | undefined
  /** time_entries.start_at ISO */
  timeEntryStartAt: string
  now: Date
}): ShiftCloseChecklistKind {
  const dateIso = p.timeEntryStartAt.slice(0, 10)
  const planned = plannedShiftForDate(p.db, p.stationId, p.employeeId, dateIso, p.shiftId)
  const nowMin = p.now.getHours() * 60 + p.now.getMinutes()

  if (!planned?.end_time) {
    return nowMin < 16 * 60 ? 'handover' : 'closing'
  }

  const endM = parseHHMM(planned.end_time)
  const lateType = isLateShiftType(planned.shift_type)

  if (endM >= 13 * 60 + 30 && endM <= 14 * 60 + 30) return 'handover'
  if (endM >= 19 * 60 + 30 || lateType) return 'closing'
  if (endM < 16 * 60) return 'handover'
  return 'closing'
}
