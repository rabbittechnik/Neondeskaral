import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { addDaysToYmd, berlinWallClockToUtcMs, padHHMM, ymdBerlinFromUtcMs } from '../utils/europeBerlinWallTime.js'

export type TimeEntryCorrectionKind = 'manual' | 'auto_clock_out'

export type TimeEntryCorrectionRow = {
  id: string
  time_entry_id: string
  station_id: string
  employee_id: string
  correction_kind: string
  original_clock_in_at: string
  original_clock_out_at: string | null
  corrected_clock_in_at: string
  corrected_clock_out_at: string | null
  original_break_minutes: number
  corrected_break_minutes: number
  reason: string
  note: string | null
  corrected_by_user_id: string | null
  corrected_by_name: string | null
  created_at: string
}

export const TIME_CORRECTION_REASON_KEYS = [
  'system_error',
  'forgot_checkout',
  'forgot_checkin',
  'wrong_stamp_time',
  'wrong_person',
  'early_sick',
  'early_agreed_swap',
  'shift_ended_early',
  'late_handover',
  'late_customer_ops',
  'shift_ended_late',
  'management_correction',
  'other',
] as const

export type TimeCorrectionReasonKey = (typeof TIME_CORRECTION_REASON_KEYS)[number]

export function timeCorrectionReasonLabelDe(key: string): string {
  const k = String(key ?? '').trim()
  const m: Record<string, string> = {
    system_error: 'Systemfehler',
    forgot_checkout: 'Mitarbeiter hat Ausstempeln vergessen',
    forgot_checkin: 'Mitarbeiter hat Einstempeln vergessen',
    wrong_stamp_time: 'falsche Stempelzeit',
    wrong_person: 'falsche Person ausgewählt',
    early_sick: 'früher gegangen wegen Krankheit',
    early_agreed_swap: 'früher gegangen wegen abgesprochenem Wechsel',
    shift_ended_early: 'Schicht wurde früher beendet',
    late_handover: 'länger geblieben wegen Übergabe',
    late_customer_ops: 'länger geblieben wegen Kunden / Betrieb',
    shift_ended_late: 'Schicht wurde später beendet',
    management_correction: 'manuelle Leitungskorrektur',
    other: 'sonstiger Grund',
    auto_clock_out: 'Automatisch ausgestempelt (Sicherheitsregel)',
  }
  return (m[k] ?? k) || '—'
}

type TeLike = {
  id: string
  start_at: string
  end_at: string | null
  break_minutes: number | null
}

export function effectiveTimeBounds(
  te: TeLike,
  corr: TimeEntryCorrectionRow | undefined,
): { startAt: string; endAt: string | null; breakMinutes: number; correctionKind?: string } {
  if (!corr) {
    return {
      startAt: te.start_at,
      endAt: te.end_at,
      breakMinutes: Math.max(0, Math.round(Number(te.break_minutes ?? 0))),
    }
  }
  return {
    startAt: corr.corrected_clock_in_at,
    endAt: corr.corrected_clock_out_at,
    breakMinutes: Math.max(0, Math.round(Number(corr.corrected_break_minutes ?? 0))),
    correctionKind: corr.correction_kind,
  }
}

export function loadLatestCorrectionsMapForIds(db: Database, timeEntryIds: string[]): Map<string, TimeEntryCorrectionRow> {
  const out = new Map<string, TimeEntryCorrectionRow>()
  const ids = [...new Set(timeEntryIds.map((x) => String(x ?? '').trim()).filter(Boolean))]
  if (!ids.length) return out
  const ph = ids.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT c.* FROM time_entry_corrections c
       INNER JOIN (
         SELECT time_entry_id, MAX(created_at) AS mx
         FROM time_entry_corrections
         WHERE time_entry_id IN (${ph})
         GROUP BY time_entry_id
       ) z ON z.time_entry_id = c.time_entry_id AND z.mx = c.created_at`,
    )
    .all(...ids) as TimeEntryCorrectionRow[]
  for (const r of rows) {
    out.set(r.time_entry_id, r)
  }
  return out
}

export function listCorrectionsForTimeEntry(db: Database, timeEntryId: string): TimeEntryCorrectionRow[] {
  return db
    .prepare(`SELECT * FROM time_entry_corrections WHERE time_entry_id = ? ORDER BY datetime(created_at) ASC`)
    .all(timeEntryId) as TimeEntryCorrectionRow[]
}

export function rowToCorrectionApi(r: TimeEntryCorrectionRow) {
  return {
    id: r.id,
    timeEntryId: r.time_entry_id,
    stationId: r.station_id,
    employeeId: r.employee_id,
    kind: r.correction_kind as TimeEntryCorrectionKind,
    originalClockInAt: r.original_clock_in_at,
    originalClockOutAt: r.original_clock_out_at ?? undefined,
    correctedClockInAt: r.corrected_clock_in_at,
    correctedClockOutAt: r.corrected_clock_out_at ?? undefined,
    originalBreakMinutes: r.original_break_minutes,
    correctedBreakMinutes: r.corrected_break_minutes,
    reason: r.reason,
    note: r.note ?? undefined,
    correctedByUserId: r.corrected_by_user_id ?? undefined,
    correctedByName: r.corrected_by_name ?? undefined,
    createdAt: r.created_at,
    reasonLabelDe: timeCorrectionReasonLabelDe(r.reason),
  }
}

export type InsertManualCorrectionOptions = {
  /** Nach Korrektur sofort freigeben (Leitung). */
  approveAfter?: boolean
  /**
   * Freigabe-Status beibehalten (Standard bei bereits freigegebenen Einträgen).
   * Manuelle Korrekturen dürfen die Lohnabrechnung nicht durch Zurücksetzen auf „pending“ verlieren.
   */
  keepApproved?: boolean
}

export function insertManualTimeCorrection(
  db: Database,
  timeEntryId: string,
  body: {
    correctedStartAt?: string
    correctedEndAt?: string
    /** Alternative zu ISO: Kalendertag Europe/Berlin + HH:mm (5 Zeichen). */
    workDateYmdBerlin?: string
    correctedStartHm?: string
    correctedEndHm?: string
    breakMinutes: number
    reason: string
    note?: string
  },
  byUserId: string,
  byDisplayName: string,
  options?: InsertManualCorrectionOptions,
): TimeEntryCorrectionRow {
  const te = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(timeEntryId) as TeLike & {
    station_id: string
    employee_id: string
    status: string | null
    approval_status: string | null
    approved_by: string | null
    approved_at: string | null
  } | undefined
  if (!te) throw new Error('Zeiteintrag nicht gefunden')
  if (String(te.status ?? '') !== 'completed') throw new Error('Nur abgeschlossene Zeiten können korrigiert werden')
  if (!te.end_at?.trim()) throw new Error('Zeiteintrag hat kein Ende — bitte zuerst abschließen')

  const wasApproved = String(te.approval_status ?? '').trim() === 'approved'
  const approveAfter = options?.approveAfter === true
  const keepApproved = options?.keepApproved === true || approveAfter || wasApproved

  const reason = String(body.reason ?? '').trim()
  if (!TIME_CORRECTION_REASON_KEYS.includes(reason as TimeCorrectionReasonKey)) throw new Error('Ungültiger Korrekturgrund')
  const note = String(body.note ?? '').trim()
  if (reason === 'other' && !note) throw new Error('Bei „Sonstiges“ ist eine Bemerkung Pflicht')

  let cStart = String(body.correctedStartAt ?? '').trim()
  let cEnd = String(body.correctedEndAt ?? '').trim()
  const wd = String(body.workDateYmdBerlin ?? '').trim()
  const sh = padHHMM(String(body.correctedStartHm ?? ''))
  const eh = padHHMM(String(body.correctedEndHm ?? ''))
  if (wd && /^\d{4}-\d{2}-\d{2}$/.test(wd) && sh.length === 5 && eh.length === 5) {
    try {
      const sMs0 = berlinWallClockToUtcMs(wd, sh)
      let eMs0 = berlinWallClockToUtcMs(wd, eh)
      if (eMs0 <= sMs0) eMs0 = berlinWallClockToUtcMs(addDaysToYmd(wd, 1), eh)
      cStart = new Date(sMs0).toISOString()
      cEnd = new Date(eMs0).toISOString()
    } catch {
      throw new Error('Korrigierte Uhrzeit (Europe/Berlin) nicht auflösbar')
    }
  }
  if (!cStart || !cEnd) throw new Error('Korrigierter Beginn und Ende erforderlich')
  const sMs = new Date(cStart).getTime()
  const eMs = new Date(cEnd).getTime()
  if (!Number.isFinite(sMs) || !Number.isFinite(eMs) || eMs <= sMs) throw new Error('Korrigiertes Ende muss nach dem Beginn liegen')

  const breakM = Math.max(0, Math.round(Number(body.breakMinutes ?? 0)))
  const ts = nowIso()
  const id = `tec-${randomUUID()}`

  db.prepare(
    `INSERT INTO time_entry_corrections (
      id, time_entry_id, station_id, employee_id, correction_kind,
      original_clock_in_at, original_clock_out_at, corrected_clock_in_at, corrected_clock_out_at,
      original_break_minutes, corrected_break_minutes, reason, note, corrected_by_user_id, corrected_by_name, created_at
    ) VALUES (?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    timeEntryId,
    te.station_id,
    te.employee_id,
    te.start_at,
    te.end_at,
    cStart,
    cEnd,
    Math.max(0, Math.round(Number(te.break_minutes ?? 0))),
    breakM,
    reason,
    note || null,
    byUserId,
    byDisplayName.trim() || null,
    ts,
  )

  if (approveAfter || keepApproved) {
    db.prepare(
      `UPDATE time_entries SET
        approval_status = 'approved',
        payroll_relevant = 1,
        approved_by = COALESCE(?, approved_by),
        approved_at = COALESCE(?, approved_at),
        rejected_by = NULL,
        rejected_at = NULL,
        rejection_reason = NULL,
        updated_at = ?
      WHERE id = ?`,
    ).run(approveAfter ? byUserId : te.approved_by, approveAfter ? ts : te.approved_at, ts, timeEntryId)
  } else {
    db.prepare(
      `UPDATE time_entries SET approval_status = 'pending', payroll_relevant = 0, updated_at = ? WHERE id = ?`,
    ).run(ts, timeEntryId)
  }

  return db.prepare(`SELECT * FROM time_entry_corrections WHERE id = ?`).get(id) as TimeEntryCorrectionRow
}

export function hasAutoClockOutCorrection(db: Database, timeEntryId: string): boolean {
  const r = db
    .prepare(`SELECT 1 as x FROM time_entry_corrections WHERE time_entry_id = ? AND correction_kind = 'auto_clock_out' LIMIT 1`)
    .get(timeEntryId) as { x: number } | undefined
  return Boolean(r)
}

export function stationAutoClockOutSettings(db: Database, stationId: string): { enabled: boolean; timeHm: string } {
  const row = db
    .prepare(
      `SELECT auto_clock_out_enabled, auto_clock_out_time FROM stations WHERE id = ?`,
    )
    .get(stationId) as { auto_clock_out_enabled: number | null; auto_clock_out_time: string | null } | undefined
  const enabled = row == null || row.auto_clock_out_enabled == null || Number(row.auto_clock_out_enabled) !== 0
  const t = String(row?.auto_clock_out_time ?? '22:45').trim() || '22:45'
  const hm = /^(\d{1,2}):(\d{2})$/.exec(t)
  const timeHm = hm ? `${String(Math.min(23, Math.max(0, parseInt(hm[1], 10)))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, parseInt(hm[2], 10)))).padStart(2, '0')}` : '22:45'
  return { enabled, timeHm }
}

/** Berlin-Wanduhr: jetzt >= konfigurierte Uhrzeit (nur Stunde/Minute). */
function berlinNowPastOrAtClockHm(timeHm: string): boolean {
  const now = Date.now()
  const ymd = ymdBerlinFromUtcMs(now)
  const cap = berlinWallClockToUtcMs(ymd, timeHm)
  return now >= cap
}

/**
 * Schließt laufende Einträge um die konfigurierte Berliner Uhrzeit (Standard 22:45).
 * Idempotent pro Eintrag (nur ein auto_clock_out).
 */
export function processAutoClockOutsForAllStations(db: Database): { closed: number } {
  let closed = 0
  const stations = db.prepare(`SELECT id FROM stations`).all() as { id: string }[]
  const nowTs = nowIso()
  for (const { id: stationId } of stations) {
    const { enabled, timeHm } = stationAutoClockOutSettings(db, stationId)
    if (!enabled) continue
    if (!berlinNowPastOrAtClockHm(timeHm)) continue

    const ymdToday = ymdBerlinFromUtcMs(Date.now())
    let capUtcMs: number
    try {
      capUtcMs = berlinWallClockToUtcMs(ymdToday, timeHm)
    } catch {
      continue
    }
    const capIso = new Date(capUtcMs).toISOString()

    const running = db
      .prepare(
        `SELECT * FROM time_entries WHERE station_id = ? AND status = 'running'
         AND (end_at IS NULL OR trim(end_at) = '')`,
      )
      .all(stationId) as (TeLike & { station_id: string; employee_id: string })[]

    for (const te of running) {
      if (hasAutoClockOutCorrection(db, te.id)) continue
      const startMs = new Date(te.start_at).getTime()
      if (!Number.isFinite(startMs)) continue
      let endIso = capIso
      if (startMs >= capUtcMs) {
        endIso = new Date(startMs + 60_000).toISOString()
      }

      const tid = `tec-${randomUUID()}`
      const autoNote = `Automatisch beendet um ${timeHm} Uhr (Europe/Berlin) — bitte prüfen.`
      db.prepare(
        `INSERT INTO time_entry_corrections (
          id, time_entry_id, station_id, employee_id, correction_kind,
          original_clock_in_at, original_clock_out_at, corrected_clock_in_at, corrected_clock_out_at,
          original_break_minutes, corrected_break_minutes, reason, note, corrected_by_user_id, corrected_by_name, created_at
        ) VALUES (?, ?, ?, ?, 'auto_clock_out', ?, NULL, ?, ?, ?, 0, 'auto_clock_out', ?, NULL, 'system', ?)`,
      ).run(
        tid,
        te.id,
        stationId,
        te.employee_id,
        te.start_at,
        te.start_at,
        endIso,
        Math.max(0, Math.round(Number(te.break_minutes ?? 0))),
        autoNote,
        nowTs,
      )

      db.prepare(
        `UPDATE time_entries SET
          end_at = ?,
          status = 'completed',
          ended_by = 'auto_system',
          end_note = ?,
          approval_status = 'pending',
          payroll_relevant = 0,
          approved_by = NULL,
          approved_at = NULL,
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          correction_note = NULL,
          updated_at = ?
        WHERE id = ? AND status = 'running'`,
      ).run(
        endIso,
        `Automatisch ausgestempelt um ${timeHm} Uhr — bitte bei der Leitung melden, falls das nicht stimmt.`,
        nowTs,
        te.id,
      )
      closed += 1
    }
  }
  return { closed }
}
