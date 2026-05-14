import type { Database } from 'better-sqlite3'
import { nowIso } from '../utils/timestamps.js'
import { countAbsenceSpanDaysCalendar, normalizeAbsenceDbType } from '../utils/vacationImpactCalculator.js'
import type { AbsenceRow } from './absenceService.js'
import { createAbsence, updateAbsence } from './absenceService.js'

const STATION_ID = 'aral-bodelshausen'
const SOURCE = 'manual_stationguide_sync'

type GuideAbsenceSpec = {
  displayName: string
  type: 'paid_vacation' | 'unpaid_vacation' | 'special_leave' | 'sick'
  start: string
  end: string
}

/** StationGuide 2026 — vollständige Liste (idempotent nach employee, type, start, end, paid). */
export const BODELSHAUSEN_STATIONGUIDE_ABSENCES_2026: GuideAbsenceSpec[] = [
  // Mathias Raselowski
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-01-22', end: '2026-01-22' },
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-03-04', end: '2026-03-04' },
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-03-10', end: '2026-03-10' },
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-03-19', end: '2026-03-20' },
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-03-30', end: '2026-03-30' },
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-03-31', end: '2026-04-02' },
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-04-07', end: '2026-04-10' },
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-05-07', end: '2026-05-08' },
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-06-22', end: '2026-06-26' },
  { displayName: 'Mathias Raselowski', type: 'unpaid_vacation', start: '2026-06-29', end: '2026-07-03' },
  { displayName: 'Mathias Raselowski', type: 'paid_vacation', start: '2026-08-10', end: '2026-08-14' },
  // Max Vins
  { displayName: 'Max Vins', type: 'paid_vacation', start: '2026-01-19', end: '2026-01-23' },
  { displayName: 'Max Vins', type: 'paid_vacation', start: '2026-01-26', end: '2026-01-30' },
  { displayName: 'Max Vins', type: 'special_leave', start: '2026-02-25', end: '2026-02-27' },
  { displayName: 'Max Vins', type: 'paid_vacation', start: '2026-05-25', end: '2026-05-29' },
  { displayName: 'Max Vins', type: 'paid_vacation', start: '2026-06-01', end: '2026-06-05' },
  // Metin Özgür
  { displayName: 'Metin Özgür', type: 'paid_vacation', start: '2026-01-02', end: '2026-01-02' },
  { displayName: 'Metin Özgür', type: 'paid_vacation', start: '2026-01-05', end: '2026-01-05' },
  { displayName: 'Metin Özgür', type: 'paid_vacation', start: '2026-01-07', end: '2026-01-09' },
  { displayName: 'Metin Özgür', type: 'sick', start: '2026-03-10', end: '2026-03-10' },
  { displayName: 'Metin Özgür', type: 'sick', start: '2026-03-11', end: '2026-03-11' },
  { displayName: 'Metin Özgür', type: 'sick', start: '2026-03-12', end: '2026-03-12' },
  { displayName: 'Metin Özgür', type: 'sick', start: '2026-03-13', end: '2026-03-13' },
  { displayName: 'Metin Özgür', type: 'paid_vacation', start: '2026-04-27', end: '2026-04-30' },
  { displayName: 'Metin Özgür', type: 'paid_vacation', start: '2026-07-13', end: '2026-07-25' },
]

const DISPLAY_NAME_ALIASES: Record<string, string[]> = {}

function normName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
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
  const target = normName(displayName)
  const row2 = db
    .prepare(
      `SELECT id, display_name FROM employees
       WHERE station_id = ? AND (deleted_at IS NULL OR trim(deleted_at) = '')`,
    )
    .all(STATION_ID) as { id: string; display_name: string }[]
  for (const r of row2) {
    if (normName(r.display_name) === target) return r.id
  }
  return undefined
}

function wantPaidFlag(typeDb: string): 0 | 1 {
  return typeDb === 'unpaid_vacation' ? 0 : 1
}

function findExistingAbsence(
  db: Database,
  employeeId: string,
  typeDb: string,
  start: string,
  end: string,
  wantPaid: 0 | 1,
): AbsenceRow | undefined {
  return db
    .prepare(
      `SELECT * FROM absences
       WHERE station_id = ?
         AND employee_id = ?
         AND type = ?
         AND start_date = ?
         AND end_date = ?
         AND COALESCE(paid, 0) = ?
         AND lower(trim(status)) != 'cancelled'
       LIMIT 1`,
    )
    .get(STATION_ID, employeeId, typeDb, start, end, wantPaid) as AbsenceRow | undefined
}

function applyStationGuideMetrics(db: Database, id: string, halfDay: boolean) {
  const row = db.prepare(`SELECT * FROM absences WHERE id = ?`).get(id) as AbsenceRow | undefined
  if (!row) return
  const typeDb = normalizeAbsenceDbType(row.type)
  const days = countAbsenceSpanDaysCalendar(row.start_date, row.end_date, halfDay)
  const hpd = 8
  const paid = wantPaidFlag(typeDb)
  const paidHoursTotal = paid ? Math.round(days * hpd * 100) / 100 : 0
  const paidHpd = paid ? hpd : 0
  const counts = typeDb === 'paid_vacation' ? 1 : 0
  const ts = nowIso()
  db.prepare(
    `UPDATE absences SET
       absence_days = ?,
       paid_hours_per_day = ?,
       paid_hours_total = ?,
       paid = ?,
       counts_against_vacation = ?,
       updated_at = ?
     WHERE id = ?`,
  ).run(days, paidHpd, paidHoursTotal, paid, counts, ts, id)
}

function patchCertificate(db: Database, id: string) {
  const ts = nowIso()
  db.prepare(`UPDATE absences SET certificate_source = ?, updated_at = ? WHERE id = ?`).run(SOURCE, ts, id)
}

function patchApproval(db: Database, id: string) {
  const ts = nowIso()
  db.prepare(
    `UPDATE absences SET status = 'approved', approved_at = COALESCE(approved_at, ?), approved_by = COALESCE(approved_by, ?), updated_at = ? WHERE id = ?`,
  ).run(ts, 'StationGuide-Sync', ts, id)
}

/**
 * Idempotent: legt fehlende StationGuide-Abwesenheiten 2026 an, aktualisiert abweichende Metriken / Genehmigung.
 * Keine neuen Mitarbeiter. Duplikat = gleiche station, employee, type, start, end, paid (aktiv).
 */
export function syncBodelshausenStationGuideAbsences2026(db: Database): { messages: string[] } {
  const messages: string[] = []
  const comment = 'StationGuide 2026 (Abgleich)'

  for (const spec of BODELSHAUSEN_STATIONGUIDE_ABSENCES_2026) {
    const typeDb = normalizeAbsenceDbType(spec.type)
    const wantPaid = wantPaidFlag(typeDb)
    const empId = findEmployeeIdForStationGuide(db, spec.displayName)
    if (!empId) {
      messages.push(
        `${spec.displayName}: ${spec.start}–${spec.end} — FEHLER: kein Mitarbeiterprofil (Anzeigename) unter ${STATION_ID} gefunden.`,
      )
      continue
    }

    const existing = findExistingAbsence(db, empId, typeDb, spec.start, spec.end, wantPaid)
    if (existing) {
      const updates: string[] = []
      try {
        updateAbsence(db, existing.id, {
          type: spec.type,
          startDate: spec.start,
          endDate: spec.end,
          halfDay: false,
          status: 'genehmigt',
          comment,
          paidHoursPerDay: 8,
        })
        updates.push('Felder neu berechnet')
      } catch (e) {
        messages.push(
          `${spec.displayName}: ${spec.start}–${spec.end} — FEHLER Update: ${e instanceof Error ? e.message : String(e)}`,
        )
        continue
      }
      applyStationGuideMetrics(db, existing.id, false)
      patchCertificate(db, existing.id)
      patchApproval(db, existing.id)
      messages.push(
        `${spec.displayName}: ${spec.start}–${spec.end} — bereits vorhanden (id=${existing.id})${updates.length ? `; ${updates.join(', ')}` : ''}`,
      )
      continue
    }

    try {
      const created = createAbsence(
        db,
        {
          employeeId: empId,
          type: spec.type,
          startDate: spec.start,
          endDate: spec.end,
          status: 'genehmigt',
          halfDay: false,
          comment,
          certificateSource: SOURCE,
          paidHoursPerDay: 8,
        },
        STATION_ID,
      )
      if (!created?.id) {
        messages.push(`${spec.displayName}: ${spec.start}–${spec.end} — FEHLER: createAbsence ohne id`)
        continue
      }
      applyStationGuideMetrics(db, created.id, false)
      patchCertificate(db, created.id)
      patchApproval(db, created.id)
      messages.push(`${spec.displayName}: ${spec.start}–${spec.end} — neu angelegt (id=${created.id}).`)
    } catch (e) {
      messages.push(
        `${spec.displayName}: ${spec.start}–${spec.end} — FEHLER: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return { messages }
}
