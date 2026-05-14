import type { Database } from 'better-sqlite3'
import { createShift, updateShift } from './shiftService.js'
import { nowIso } from '../utils/timestamps.js'

const STATION_ID = 'aral-bodelshausen'
export const MAY2026_SHIFT_IMPORT_SOURCE = 'may2026_kw18_kw19_stationguide'

const NAME_ALIASES: Record<string, string> = {
  'm. vins': 'Max Vins',
  'm vins': 'Max Vins',
  'm. raselowski': 'Mathias Raselowski',
  'm raselowski': 'Mathias Raselowski',
  'mathias raselowski': 'Mathias Raselowski',
}

function normalizeName(input: string): string {
  const t = input.trim()
  const key = t.toLowerCase().replace(/\s+/g, ' ')
  return NAME_ALIASES[key] ?? t
}

/** Vergleich ohne Diakritika und Sonderzeichen (z. B. Özgür). */
function simplifyDisplayName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function findEmployeeId(db: Database, displayName: string): string | undefined {
  const canon = normalizeName(displayName)
  const row = db
    .prepare(
      `SELECT id FROM employees WHERE station_id = ? AND lower(trim(display_name)) = lower(trim(?)) AND (deleted_at IS NULL OR trim(deleted_at) = '') LIMIT 1`,
    )
    .get(STATION_ID, canon) as { id: string } | undefined
  if (row) return row.id

  const want = simplifyDisplayName(canon)
  if (!want) return undefined
  const rows = db
    .prepare(
      `SELECT id, display_name FROM employees WHERE station_id = ? AND (deleted_at IS NULL OR trim(deleted_at) = '')`,
    )
    .all(STATION_ID) as { id: string; display_name: string }[]
  for (const r of rows) {
    if (simplifyDisplayName(r.display_name) === want) return r.id
  }
  return undefined
}

function workAreaIdFor(db: Database, code: 'B' | 'K'): string {
  const row = db
    .prepare(
      `SELECT id FROM work_areas WHERE station_id = ? AND upper(trim(short_code)) = ? LIMIT 1`,
    )
    .get(STATION_ID, code) as { id: string } | undefined
  if (row) return row.id
  if (code === 'K') return workAreaIdFor(db, 'B')
  const buero = db
    .prepare(`SELECT id FROM work_areas WHERE station_id = ? AND id = 'buero' LIMIT 1`)
    .get(STATION_ID) as { id: string } | undefined
  if (buero) return buero.id
  const any = db.prepare(`SELECT id FROM work_areas WHERE station_id = ? LIMIT 1`).get(STATION_ID) as
    | { id: string }
    | undefined
  if (any) return any.id
  throw new Error(`Kein Arbeitsbereich für Station ${STATION_ID}`)
}

type Planned = {
  date: string
  employeeName: string
  startTime: string
  endTime: string
  areaCode: 'B' | 'K'
}

const PLANNED: Planned[] = [
  { date: '2026-05-01', employeeName: 'Mathias Raselowski', startTime: '07:30', endTime: '14:00', areaCode: 'B' },
  { date: '2026-05-01', employeeName: 'Enise A.', startTime: '14:00', endTime: '20:15', areaCode: 'B' },
  { date: '2026-05-02', employeeName: 'Max Vins', startTime: '06:30', endTime: '14:00', areaCode: 'B' },
  { date: '2026-05-02', employeeName: 'Chiara H.', startTime: '14:00', endTime: '20:15', areaCode: 'B' },
  { date: '2026-05-03', employeeName: 'Enise A.', startTime: '07:30', endTime: '14:00', areaCode: 'B' },
  { date: '2026-05-03', employeeName: 'Luca Stöck', startTime: '14:00', endTime: '20:15', areaCode: 'B' },
  { date: '2026-05-04', employeeName: 'Max Vins', startTime: '05:30', endTime: '09:00', areaCode: 'B' },
  { date: '2026-05-04', employeeName: 'Mathias Raselowski', startTime: '09:00', endTime: '13:30', areaCode: 'K' },
  { date: '2026-05-04', employeeName: 'Metin Özgür', startTime: '13:30', endTime: '21:15', areaCode: 'B' },
  { date: '2026-05-05', employeeName: 'Max Vins', startTime: '05:30', endTime: '14:00', areaCode: 'B' },
  { date: '2026-05-05', employeeName: 'Mathias Raselowski', startTime: '08:00', endTime: '14:15', areaCode: 'B' },
  { date: '2026-05-05', employeeName: 'Metin Özgür', startTime: '14:00', endTime: '21:15', areaCode: 'B' },
  { date: '2026-05-06', employeeName: 'Max Vins', startTime: '05:30', endTime: '12:00', areaCode: 'B' },
  { date: '2026-05-06', employeeName: 'Mathias Raselowski', startTime: '08:00', endTime: '14:15', areaCode: 'B' },
  { date: '2026-05-06', employeeName: 'Metin Özgür', startTime: '14:00', endTime: '21:15', areaCode: 'B' },
  { date: '2026-05-07', employeeName: 'Max Vins', startTime: '05:30', endTime: '14:00', areaCode: 'B' },
  { date: '2026-05-07', employeeName: 'Metin Özgür', startTime: '14:00', endTime: '21:15', areaCode: 'B' },
  { date: '2026-05-08', employeeName: 'Max Vins', startTime: '05:30', endTime: '14:00', areaCode: 'B' },
  { date: '2026-05-08', employeeName: 'Metin Özgür', startTime: '14:00', endTime: '21:15', areaCode: 'B' },
  { date: '2026-05-09', employeeName: 'Chiara H.', startTime: '06:30', endTime: '14:00', areaCode: 'B' },
  { date: '2026-05-09', employeeName: 'Enise A.', startTime: '14:00', endTime: '20:15', areaCode: 'B' },
  { date: '2026-05-10', employeeName: 'Luca Stöck', startTime: '07:30', endTime: '14:00', areaCode: 'B' },
  { date: '2026-05-10', employeeName: 'Valerina Mustafa', startTime: '14:00', endTime: '20:15', areaCode: 'B' },
]

function findExistingShift(
  db: Database,
  employeeId: string,
  date: string,
  startTime: string,
  endTime: string,
): { id: string; work_area_id: string } | undefined {
  return db
    .prepare(
      `SELECT id, work_area_id FROM shifts WHERE station_id = ? AND employee_id = ? AND date = ? AND start_time = ? AND end_time = ? LIMIT 1`,
    )
    .get(STATION_ID, employeeId, date, startTime, endTime) as { id: string; work_area_id: string } | undefined
}

export type May2026ShiftImportResult = {
  ok: boolean
  stationId: string
  importSource: string
  inserted: number
  skippedDuplicate: number
  updatedWorkArea: number
  checkedAt: string
  errors: string[]
}

/**
 * Trägt die StationGuide-Schichten 01.–10.05.2026 (nur Mai) für Aral Bodelshausen ein.
 * Idempotent: gleicher Mitarbeiter + Datum + Start + Ende → kein zweites INSERT; Arbeitsbereich wird bei Bedarf angepasst.
 */
export function applyMay2026BodelshausenOfficeShifts(db: Database): May2026ShiftImportResult {
  let inserted = 0
  let skippedDuplicate = 0
  let updatedWorkArea = 0
  const errors: string[] = []

  const waB = workAreaIdFor(db, 'B')
  const waK = workAreaIdFor(db, 'K')

  for (const p of PLANNED) {
    if (!p.date.startsWith('2026-05')) {
      errors.push(`Interner Fehler: Datum außerhalb Mai 2026: ${p.date}`)
      continue
    }

    const empId = findEmployeeId(db, p.employeeName)
    if (!empId) {
      errors.push(`Mitarbeiter nicht gefunden: „${p.employeeName}“ (${p.date} ${p.startTime}–${p.endTime})`)
      continue
    }

    const targetWa = p.areaCode === 'K' ? waK : waB
    const existing = findExistingShift(db, empId, p.date, p.startTime, p.endTime)

    if (existing) {
      if (existing.work_area_id !== targetWa) {
        updateShift(db, existing.id, {
          workAreaId: targetWa,
          published: true,
          status: 'Veröffentlicht',
          importSource: MAY2026_SHIFT_IMPORT_SOURCE,
        })
        updatedWorkArea += 1
      } else {
        skippedDuplicate += 1
      }
      continue
    }

    try {
      createShift(
        db,
        {
          date: p.date,
          startTime: p.startTime,
          endTime: p.endTime,
          workAreaId: targetWa,
          employeeId: empId,
          breakMinutes: 0,
          shiftType: 'frueh',
          published: true,
          status: 'Veröffentlicht',
          importSource: MAY2026_SHIFT_IMPORT_SOURCE,
          id: `may26-${p.date}-${empId}-${p.startTime.replace(':', '')}-${p.endTime.replace(':', '')}-${targetWa.slice(0, 8)}`,
        },
        STATION_ID,
      )
      inserted += 1
    } catch (e) {
      if (e instanceof Error && (e.message.includes('UNIQUE') || e.message.includes('constraint'))) {
        skippedDuplicate += 1
      } else {
        errors.push(`${p.date} ${p.employeeName}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return {
    ok: errors.length === 0,
    stationId: STATION_ID,
    importSource: MAY2026_SHIFT_IMPORT_SOURCE,
    inserted,
    skippedDuplicate,
    updatedWorkArea,
    checkedAt: nowIso(),
    errors,
  }
}
