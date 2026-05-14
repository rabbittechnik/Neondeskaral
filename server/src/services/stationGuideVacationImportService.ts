import type { Database } from 'better-sqlite3'
import { createAbsence } from './absenceService.js'
import { nowIso } from '../utils/timestamps.js'

const STATION_ID = 'aral-bodelshausen'

export type StationGuideVacationSpec = { displayName: string; start: string; end: string }

/** StationGuide (Aral Bodelshausen): sichtbare Urlaube — idempotent nach (employee, start, end, paid_vacation). */
export const BODELSHAUSEN_STATIONGUIDE_VACATIONS_2026: StationGuideVacationSpec[] = [
  { displayName: 'Metin Özgür', start: '2026-04-27', end: '2026-04-30' },
  { displayName: 'Mathias Raselowski', start: '2026-05-07', end: '2026-05-08' },
  { displayName: 'Max Vins', start: '2026-05-25', end: '2026-06-05' },
]

/** Erkannte Schreibweisen (optional). */
const DISPLAY_NAME_ALIASES: Record<string, string[]> = {
  // z. B. ältere Importe: 'Metin Ozgur': ['Metin Özgür'],
}

function findEmployeeIdForStationGuide(db: Database, displayName: string): string | undefined {
  const primary = displayName.trim()
  const keys = [primary, ...(DISPLAY_NAME_ALIASES[primary] ?? [])]
  const tried = new Set<string>()
  for (const k of keys) {
    const q = k.trim()
    if (!q || tried.has(q)) continue
    tried.add(q)
    const row = db
      .prepare(
        `SELECT id FROM employees
         WHERE station_id = ?
           AND (deleted_at IS NULL OR trim(deleted_at) = '')
           AND trim(display_name) = ?
         LIMIT 1`,
      )
      .get(STATION_ID, q) as { id: string } | undefined
    if (row?.id) return row.id
  }
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
  const target = norm(displayName.trim())
  const row2 = db
    .prepare(
      `SELECT id, display_name FROM employees
       WHERE station_id = ? AND (deleted_at IS NULL OR trim(deleted_at) = '')`,
    )
    .all(STATION_ID) as { id: string; display_name: string }[]
  for (const r of row2) {
    if (norm(r.display_name) === target) return r.id
  }
  return undefined
}

function findExistingPaidVacation(
  db: Database,
  employeeId: string,
  start: string,
  end: string,
): { id: string; status: string; certificate_source: string | null } | undefined {
  return db
    .prepare(
      `SELECT id, status, certificate_source FROM absences
       WHERE station_id = ? AND employee_id = ? AND start_date = ? AND end_date = ? AND type = 'paid_vacation'
       LIMIT 1`,
    )
    .get(STATION_ID, employeeId, start, end) as { id: string; status: string; certificate_source: string | null } | undefined
}

function overlappingPaidVacation(
  db: Database,
  employeeId: string,
  start: string,
  end: string,
): { id: string; start_date: string; end_date: string }[] {
  return db
    .prepare(
      `SELECT id, start_date, end_date FROM absences
       WHERE station_id = ? AND employee_id = ? AND type = 'paid_vacation' AND status != 'cancelled'
         AND NOT (end_date < ? OR start_date > ?)`,
    )
    .all(STATION_ID, employeeId, start, end) as { id: string; start_date: string; end_date: string }[]
}

/**
 * Idempotent: legt fehlende StationGuide-Urlaube an, aktualisiert optional Genehmigung/Quelle.
 * Keine neuen Mitarbeiter. Ohne Match: Zeile im Report, kein Insert.
 */
export function ensureBodelshausenStationGuideVacations2026(db: Database): { messages: string[] } {
  const messages: string[] = []
  const ts = nowIso()

  for (const v of BODELSHAUSEN_STATIONGUIDE_VACATIONS_2026) {
    const empId = findEmployeeIdForStationGuide(db, v.displayName)
    if (!empId) {
      messages.push(
        `${v.displayName}: ${v.start}–${v.end} — FEHLER: kein Mitarbeiterprofil (Anzeigename) unter ${STATION_ID} gefunden; kein Eintrag.`,
      )
      continue
    }

    const existing = findExistingPaidVacation(db, empId, v.start, v.end)
    if (existing) {
      const patch: string[] = []
      if (existing.status !== 'approved') {
        db.prepare(
          `UPDATE absences SET status = 'approved', approved_at = COALESCE(approved_at, ?), approved_by = COALESCE(approved_by, ?), updated_at = ? WHERE id = ?`,
        ).run(ts, 'StationGuide-Import', ts, existing.id)
        patch.push('status→approved')
      }
      if (!existing.certificate_source?.trim()) {
        db.prepare(`UPDATE absences SET certificate_source = ?, updated_at = ? WHERE id = ?`).run(
          'stationguide_import',
          ts,
          existing.id,
        )
        patch.push('certificate_source')
      }
      messages.push(
        `${v.displayName}: ${v.start}–${v.end} — bereits vorhanden (id=${existing.id})${patch.length ? `; ergänzt: ${patch.join(', ')}` : ''}`,
      )
      continue
    }

    const overlap = overlappingPaidVacation(db, empId, v.start, v.end)
    if (overlap.length) {
      messages.push(
        `${v.displayName}: ${v.start}–${v.end} — überschneidender bezahlter Urlaub (${overlap.map((o) => `${o.id} ${o.start_date}–${o.end_date}`).join('; ')}); nicht angelegt.`,
      )
      continue
    }

    try {
      const created = createAbsence(
        db,
        {
          employeeId: empId,
          type: 'paid_vacation',
          startDate: v.start,
          endDate: v.end,
          status: 'genehmigt',
          halfDay: false,
          comment: 'StationGuide (manuelle Prüfung / Import)',
          certificateSource: 'stationguide_import',
        },
        STATION_ID,
      )
      if (!created?.id) {
        messages.push(`${v.displayName}: ${v.start}–${v.end} — FEHLER: createAbsence ohne id`)
        continue
      }
      db.prepare(`UPDATE absences SET approved_at = ?, approved_by = ?, updated_at = ? WHERE id = ?`).run(
        ts,
        'StationGuide-Import',
        ts,
        created.id,
      )
      messages.push(`${v.displayName}: ${v.start}–${v.end} — neu angelegt (id=${created.id}).`)
    } catch (e) {
      messages.push(`${v.displayName}: ${v.start}–${v.end} — FEHLER: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { messages }
}
