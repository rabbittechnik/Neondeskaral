import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'
import { getEmployee, getEmployeeRowInternal } from './employeeService.js'
import { listShiftRowsForStationDateRange, type ShiftRow } from './shiftService.js'
import {
  closeTimeEntry,
  getRunningForEmployee,
  getTimeEntry,
  insertChecklist,
  logCardEvent,
} from './timeTrackingService.js'

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function getPlannedShiftToday(
  shifts: ShiftRow[],
  employeeId: string,
  todayIso: string,
): ShiftRow | null {
  const list = shifts.filter(
    (s) =>
      s.employee_id === employeeId &&
      s.date === todayIso &&
      s.shift_type !== 'frei' &&
      Boolean(s.start_time) &&
      Boolean(s.end_time),
  )
  if (list.length === 0) return null
  list.sort((a, b) => parseHHMM(a.start_time) - parseHHMM(b.start_time))
  return list[0] ?? null
}

function allChecklistDone(c: Record<string, unknown>): boolean {
  const keys = [
    'fridgeFronted',
    'drinksFilled',
    'cigarettesFilled',
    'shelvesFilled',
    'trashEmptied',
    'counterClean',
    'coffeeAreaClean',
    'outsideChecked',
    'incidentsNoted',
    'handoverPossible',
    'closingReady',
    'everythingOk',
  ]
  return keys.every((k) => Boolean(c[k]))
}

export function validateShiftCloseChecklist(checklist: Record<string, unknown>): {
  ok: boolean
  error?: string
} {
  if (allChecklistDone(checklist)) return { ok: true }
  const note = String(checklist.incidentNote ?? '').trim()
  if (!note) return { ok: false, error: 'Bemerkung erforderlich' }
  return { ok: true }
}

export type CheckInSource = 'tablet' | 'employee_mobile_app'

export function clockCheckInByEmployeeId(
  db: Database,
  p: {
    employeeId: string
    stationId: string
    force: boolean
    source: CheckInSource
    startedBy: string
    /** Nur für Terminal-Logging (Kartennummer) */
    cardNumberForLog?: string
  },
) {
  const { employeeId, stationId, force, source, startedBy } = p
  const card = (p.cardNumberForLog ?? '').trim()
  const emp = getEmployee(db, employeeId, false)
  if (!emp) {
    if (card)
      logCardEvent(db, {
        cardNumber: card,
        stationId,
        actionType: 'check_in',
        result: 'unknown_card',
        message: 'Mitarbeiter nicht gefunden',
      })
    return { ok: false as const, result: 'unknown_card' as const, message: 'Mitarbeiter nicht gefunden' }
  }

  const row = getEmployeeRowInternal(db, employeeId)!
  if ((row.terminal_enabled ?? 1) === 0 || (row.time_tracking_enabled ?? 1) === 0) {
    if (card)
      logCardEvent(db, {
        cardNumber: card,
        employeeId,
        stationId,
        actionType: 'check_in',
        result: 'error',
        message: 'Terminal/Zeiterfassung deaktiviert',
      })
    return { ok: false as const, result: 'error' as const, message: 'Terminal/Zeiterfassung deaktiviert' }
  }

  const running = getRunningForEmployee(db, employeeId, stationId)
  if (running) {
    if (card)
      logCardEvent(db, {
        cardNumber: card,
        employeeId,
        stationId,
        actionType: 'check_in',
        result: 'already_checked_in',
        message: 'Bereits eingestempelt',
      })
    return {
      ok: false as const,
      result: 'already_checked_in' as const,
      message: 'Bereits eingestempelt',
      employee: emp,
      timeEntry: running,
    }
  }

  const now = new Date()
  const today = toISODateLocal(now)
  const shiftRows = listShiftRowsForStationDateRange(db, stationId, today, today)
  const planned = getPlannedShiftToday(shiftRows, employeeId, today)

  if (!planned && !force) {
    if (card)
      logCardEvent(db, {
        cardNumber: card,
        employeeId,
        stationId,
        actionType: 'check_in',
        result: 'not_scheduled',
        message: 'Heute keine Schicht geplant',
      })
    return {
      ok: false as const,
      result: 'not_scheduled' as const,
      message: 'Heute keine Schicht geplant',
      employee: emp,
    }
  }

  if (planned && !force) {
    const nowM = now.getHours() * 60 + now.getMinutes()
    const startM = parseHHMM(planned.start_time)
    if (nowM < startM) {
      if (card)
        logCardEvent(db, {
          cardNumber: card,
          employeeId,
          stationId,
          actionType: 'check_in',
          result: 'too_early',
          message: `Zu früh (ab ${planned.start_time} Uhr)`,
        })
      return {
        ok: false as const,
        result: 'too_early' as const,
        message: `Zu früh (ab ${planned.start_time} Uhr)`,
        employee: emp,
        plannedStart: planned.start_time,
      }
    }
    // Verspäteter Start: ohne Zwang erlauben (Tablet & Mitarbeiter-App).
  }

  const ts = nowIso()
  const id = `te-${randomUUID()}`
  db.prepare(
    `INSERT INTO time_entries (id, station_id, employee_id, shift_id, start_at, end_at, break_minutes, status, source, started_by, ended_by, start_note, end_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, 0, 'running', ?, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(id, stationId, employeeId, planned?.id ?? null, ts, source, startedBy, ts, ts)

  if (card) {
    logCardEvent(db, {
      cardNumber: card,
      employeeId,
      stationId,
      actionType: 'check_in',
      result: 'success',
      message: 'Eingestempelt',
    })
  }

  const entry = getTimeEntry(db, id)!
  return { ok: true as const, result: 'success' as const, message: 'Eingestempelt', employee: emp, timeEntry: entry }
}

export function clockCheckOutStartByEmployeeId(
  db: Database,
  p: { employeeId: string; stationId: string; cardNumberForLog?: string },
) {
  const { employeeId, stationId } = p
  const card = (p.cardNumberForLog ?? '').trim()
  const emp = getEmployee(db, employeeId, false)
  if (!emp) {
    if (card)
      logCardEvent(db, {
        cardNumber: card,
        stationId,
        actionType: 'check_out',
        result: 'unknown_card',
        message: 'Mitarbeiter nicht gefunden',
      })
    return { ok: false as const, result: 'unknown_card' as const, message: 'Mitarbeiter nicht gefunden' }
  }

  const running = getRunningForEmployee(db, employeeId, stationId)
  if (!running) {
    if (card)
      logCardEvent(db, {
        cardNumber: card,
        employeeId,
        stationId,
        actionType: 'check_out',
        result: 'not_checked_in',
        message: 'Keine laufende Schicht',
      })
    return {
      ok: false as const,
      result: 'not_checked_in' as const,
      message: 'Keine laufende Schicht',
      employee: emp,
    }
  }

  if (card) {
    logCardEvent(db, {
      cardNumber: card,
      employeeId,
      stationId,
      actionType: 'check_out',
      result: 'checklist_required',
      message: 'Checkliste erforderlich',
    })
  }

  return {
    ok: true as const,
    result: 'checklist_required' as const,
    message: 'Bitte Checkliste abschließen',
    employee: emp,
    timeEntry: running,
  }
}

export function clockCheckOutComplete(
  db: Database,
  body: { timeEntryId: string; checklist: Record<string, unknown>; endedBy: string },
  options?: { logCardOnSuccess?: { cardNumber: string; stationId: string; employeeId: string } },
) {
  const timeEntryId = String(body.timeEntryId ?? '').trim()
  const checklist = body.checklist ?? {}
  const endedBy = String(body.endedBy ?? 'System').trim() || 'System'
  if (!timeEntryId) throw new Error('timeEntryId erforderlich')

  const v = validateShiftCloseChecklist(checklist)
  if (!v.ok) return { ok: false as const, error: v.error ?? 'Checkliste unvollständig' }

  const row = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(timeEntryId) as
    | { id: string; employee_id: string; station_id: string; status: string | null }
    | undefined
  if (!row || row.status !== 'running') {
    return { ok: false as const, error: 'Kein laufender Zeiteintrag' }
  }

  insertChecklist(db, timeEntryId, row.employee_id, checklist)
  closeTimeEntry(db, timeEntryId, endedBy)

  if (options?.logCardOnSuccess) {
    logCardEvent(db, {
      cardNumber: options.logCardOnSuccess.cardNumber,
      employeeId: options.logCardOnSuccess.employeeId,
      stationId: options.logCardOnSuccess.stationId,
      actionType: 'check_out',
      result: 'success',
      message: 'Ausgestempelt',
    })
  }

  return { ok: true as const, data: getTimeEntry(db, timeEntryId) }
}
