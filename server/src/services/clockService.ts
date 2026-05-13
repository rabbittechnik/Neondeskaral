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
  insertShiftCloseChecklistParsed,
  logCardEvent,
  type TimeEntryRow,
} from './timeTrackingService.js'
import { syncReviewItemsFromCloseChecklist } from './shiftChecklistReviewService.js'
import { listActiveShiftWarningsForEmployee } from './employeeShiftWarningService.js'
import { buildShiftCloseChecklistStartPayload } from './stationShiftChecklistDefService.js'
import { resolveShiftCloseChecklistKind } from '../utils/shiftCloseChecklistResolve.js'
import { isStructuredShiftClosePayload, validateStructuredShiftCloseChecklistForStation } from '../utils/shiftCloseChecklistValidate.js'
import {
  addDaysToYmd,
  displayHHMM,
  formatDeviationEarlyLateDe,
  formatTimeHmBerlin,
  ymdBerlinFromUtcMs,
} from '../utils/europeBerlinWallTime.js'
import { shiftBoundsBerlin } from '../utils/shiftBerlinBounds.js'

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
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

/** Wie Tablet-Vorschläge: zuerst Schicht im aktiven Fenster, sonst früheste Schicht am Berlin-Kalendertag. */
function getPlannedShiftForCheckInAuto(
  shiftRows: ShiftRow[],
  employeeId: string,
  todayBerlin: string,
  yesterdayBerlin: string,
  nowMs: number,
): ShiftRow | null {
  const mine = shiftRows.filter(
    (s) =>
      String(s.employee_id ?? '').trim() === employeeId &&
      (s.published ?? 0) === 1 &&
      (s.date === todayBerlin || s.date === yesterdayBerlin) &&
      String(s.shift_type ?? '').trim().toLowerCase() !== 'frei' &&
      Boolean(s.start_time) &&
      Boolean(s.end_time),
  )
  const withBounds = mine
    .map((row) => ({ row, b: shiftBoundsBerlin(row) }))
    .filter((x): x is { row: ShiftRow; b: { startMs: number; endMs: number } } => x.b != null)
    .sort((a, b) => a.b.startMs - b.b.startMs)

  const preStartMs = 60 * 60 * 1000
  const postEndMs = 15 * 60 * 1000
  const eligible = withBounds.filter(
    (x) => nowMs >= x.b.startMs - preStartMs && nowMs <= x.b.endMs + postEndMs,
  )
  if (eligible.length > 0) return eligible[0]!.row

  const todayOnly = withBounds.filter((x) => x.row.date === todayBerlin).sort((a, b) => a.b.startMs - b.b.startMs)
  return todayOnly[0]?.row ?? null
}

/** Gleiche Fensterlogik wie Stations-Tablet: ±15 Min um geplanten Start/Ende. */
const SHIFT_CLOCK_TOLERANCE_MIN = 15

function minutesOfDayLocal(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function formatHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function plannedShiftForTimeEntry(
  db: Database,
  stationId: string,
  employeeId: string,
  dateIso: string,
  shiftId: string | null | undefined,
): ShiftRow | null {
  const rows = listShiftRowsForStationDateRange(db, stationId, dateIso, dateIso)
  if (shiftId) {
    const hit = rows.find((s) => s.id === shiftId)
    if (hit && hit.shift_type !== 'frei' && Boolean(hit.start_time) && Boolean(hit.end_time)) return hit
  }
  return getPlannedShiftToday(rows, employeeId, dateIso)
}

function computeStartDeviationPersist(nowMs: number, planned: ShiftRow | null): {
  plannedStartAt: string | null
  minutes: number | null
  type: string
} {
  if (!planned?.start_time) {
    return { plannedStartAt: null, minutes: null, type: 'no_planned_shift' }
  }
  const bounds = shiftBoundsBerlin(planned)
  if (!bounds) {
    return { plannedStartAt: null, minutes: null, type: 'no_planned_shift' }
  }
  const plannedStartAt = new Date(bounds.startMs).toISOString()
  const deltaMin = Math.round((nowMs - bounds.startMs) / 60_000)
  const tol = SHIFT_CLOCK_TOLERANCE_MIN
  if (Math.abs(deltaMin) <= tol) {
    return { plannedStartAt, minutes: 0, type: 'on_time' }
  }
  if (deltaMin < -tol) {
    return { plannedStartAt, minutes: Math.abs(deltaMin), type: 'early' }
  }
  return { plannedStartAt, minutes: deltaMin, type: 'late' }
}

function computeEndDeviationPersist(now: Date, planned: ShiftRow | null): {
  plannedEndAt: string | null
  minutes: number | null
  type: string
} {
  if (!planned?.end_time) {
    return { plannedEndAt: null, minutes: null, type: 'no_planned_shift' }
  }
  const plannedEndAt = `${planned.date}T${String(planned.end_time).trim()}:00`
  const nowM = minutesOfDayLocal(now)
  const endM = parseHHMM(String(planned.end_time).trim())
  const diff = nowM - endM
  if (Math.abs(diff) <= SHIFT_CLOCK_TOLERANCE_MIN) {
    return { plannedEndAt, minutes: 0, type: 'on_time' }
  }
  if (diff < 0) {
    return { plannedEndAt, minutes: Math.abs(diff), type: 'early' }
  }
  return { plannedEndAt, minutes: diff, type: 'late' }
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
    /** Optional: konkrete Plan-Schicht (Tablet-Vorschlag); sonst früheste Schicht heute. */
    shiftId?: string | null
  },
) {
  const { employeeId, stationId, force, source, startedBy } = p
  const card = (p.cardNumberForLog ?? '').trim()
  const emp = getEmployee(db, employeeId, { includeAccessToken: false, includeSensitive: false })
  if (!emp) {
    if (card)
      logCardEvent(db, {
        cardNumber: card,
        stationId,
        actionType: 'check_in',
        result: 'unknown_card',
        message: 'Mitarbeiter nicht gefunden',
      })
    return {
      ok: false as const,
      result: 'unknown_card' as const,
      message: 'Mitarbeiter nicht gefunden',
    }
  }

  if (!emp.terminalEnabled || !emp.timeTrackingEnabled) {
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

  const pendingWarnings = listActiveShiftWarningsForEmployee(db, employeeId)
  if (pendingWarnings.length > 0) {
    if (card)
      logCardEvent(db, {
        cardNumber: card,
        employeeId,
        stationId,
        actionType: 'check_in',
        result: 'error',
        message: 'Schicht-Hinweise noch nicht bestätigt',
      })
    return {
      ok: false as const,
      result: 'shift_warnings_pending' as const,
      requiresWarningAcknowledgement: true as const,
      warnings: pendingWarnings,
      message: 'Hinweis aus deiner letzten Schicht: Bitte zuerst bestätigen.',
      employee: emp,
    }
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
        message: 'Du bist bereits eingestempelt.',
      })
    return {
      ok: false as const,
      result: 'already_checked_in' as const,
      message: 'Du bist bereits eingestempelt.',
      employee: emp,
      timeEntry: running,
    }
  }

  const nowMs = Date.now()
  const todayBerlin = ymdBerlinFromUtcMs(nowMs)
  const yesterdayBerlin = addDaysToYmd(todayBerlin, -1)
  const shiftRows = listShiftRowsForStationDateRange(db, stationId, yesterdayBerlin, todayBerlin)
  const wantedShiftId = String(p.shiftId ?? '').trim()
  let planned: ShiftRow | null = null
  if (wantedShiftId) {
    const hit = shiftRows.find((s) => s.id === wantedShiftId)
    const dateOk =
      hit &&
      (String(hit.date).trim() === todayBerlin || String(hit.date).trim() === yesterdayBerlin)
    const okHit =
      hit &&
      dateOk &&
      (hit.published ?? 0) === 1 &&
      String(hit.employee_id ?? '').trim() === employeeId &&
      hit.station_id === stationId &&
      hit.shift_type !== 'frei' &&
      Boolean(hit.start_time) &&
      Boolean(hit.end_time)
    if (!okHit) {
      if (card)
        logCardEvent(db, {
          cardNumber: card,
          employeeId,
          stationId,
          actionType: 'check_in',
          result: 'error',
          message: 'Ungültige Schichtzuordnung',
        })
      return {
        ok: false as const,
        result: 'error' as const,
        message: 'Diese Schicht ist für heute nicht gültig oder passt nicht zu dir.',
      }
    }
    planned = hit
  } else {
    planned = getPlannedShiftForCheckInAuto(shiftRows, employeeId, todayBerlin, yesterdayBerlin, nowMs)
  }

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
      requiresConfirmation: true as const,
      reason: 'no_planned_shift' as const,
      plannedStart: null as null,
      actualStart: formatTimeHmBerlin(nowMs),
      deviationMinutes: null as null,
      message: 'Für dich ist aktuell keine Schicht geplant.',
      employee: emp,
    }
  }

  if (planned && !force) {
    const bounds = shiftBoundsBerlin(planned)
    if (!bounds) {
      return {
        ok: false as const,
        result: 'error' as const,
        message: 'Schichtzeiten konnten nicht ausgewertet werden.',
        employee: emp,
      }
    }
    const tolMs = SHIFT_CLOCK_TOLERANCE_MIN * 60 * 1000
    const { startMs, endMs } = bounds
    const endCutMs = endMs + tolMs
    const plannedStartLabel = displayHHMM(String(planned.start_time))
    const plannedEndLabel = displayHHMM(String(planned.end_time))
    const actualStart = formatTimeHmBerlin(nowMs)
    const plannedStartAt = new Date(startMs).toISOString()
    const plannedEndAt = new Date(endMs).toISOString()

    if (nowMs > endCutMs) {
      const msg =
        'Diese geplante Schicht ist bereits beendet und kann nicht mehr normal gestartet werden. Du kannst den Start trotzdem bestätigen.'
      if (card)
        logCardEvent(db, {
          cardNumber: card,
          employeeId,
          stationId,
          actionType: 'check_in',
          result: 'shift_ended',
          message: msg,
        })
      return {
        ok: false as const,
        result: 'shift_ended' as const,
        requiresConfirmation: true as const,
        reason: 'shift_ended' as const,
        plannedStart: plannedStartLabel,
        plannedEnd: plannedEndLabel,
        plannedStartAt,
        plannedEndAt,
        actualStart,
        deviationMinutes: null as null,
        displayText: msg,
        message: msg,
        employee: emp,
      }
    }

    if (nowMs < startMs - tolMs) {
      const deviationMinutes = Math.round((startMs - nowMs) / 60_000)
      const displayText = formatDeviationEarlyLateDe('earlier', deviationMinutes)
      if (card)
        logCardEvent(db, {
          cardNumber: card,
          employeeId,
          stationId,
          actionType: 'check_in',
          result: 'too_early',
          message: `Zu früh (ab ${plannedStartLabel} Uhr)`,
        })
      return {
        ok: false as const,
        result: 'too_early' as const,
        requiresConfirmation: true as const,
        reason: 'early' as const,
        plannedStart: plannedStartLabel,
        plannedEnd: plannedEndLabel,
        plannedStartAt,
        plannedEndAt,
        actualStart,
        deviationMinutes,
        displayText,
        message: `Du beginnst deine Schicht früher als geplant.`,
        employee: emp,
      }
    }
    if (nowMs > startMs + tolMs) {
      const deviationMinutes = Math.round((nowMs - startMs) / 60_000)
      const displayText = formatDeviationEarlyLateDe('later', deviationMinutes)
      if (card)
        logCardEvent(db, {
          cardNumber: card,
          employeeId,
          stationId,
          actionType: 'check_in',
          result: 'too_late',
          message: `Verspäteter Start (${plannedStartLabel} Uhr)`,
        })
      return {
        ok: false as const,
        result: 'too_late' as const,
        requiresConfirmation: true as const,
        reason: 'late' as const,
        plannedStart: plannedStartLabel,
        plannedEnd: plannedEndLabel,
        plannedStartAt,
        plannedEndAt,
        actualStart,
        deviationMinutes,
        displayText,
        message: `Du beginnst deine Schicht später als geplant.`,
        employee: emp,
        minutesLate: deviationMinutes,
      }
    }
  }

  const ts = new Date(nowMs).toISOString()
  const id = `te-${randomUUID()}`
  db.prepare(
    `INSERT INTO time_entries (id, station_id, employee_id, shift_id, start_at, end_at, break_minutes, status, source, started_by, ended_by, start_note, end_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, 0, 'running', ?, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(id, stationId, employeeId, planned?.id ?? null, ts, source, startedBy, ts, ts)

  const startMeta = computeStartDeviationPersist(nowMs, planned)
  db.prepare(
    `UPDATE time_entries SET planned_start_at = ?, start_deviation_minutes = ?, start_deviation_type = ? WHERE id = ?`,
  ).run(startMeta.plannedStartAt, startMeta.minutes, startMeta.type, id)

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
  const emp = getEmployee(db, employeeId, { includeAccessToken: false, includeSensitive: false })
  if (!emp) {
    if (card)
      logCardEvent(db, {
        cardNumber: card,
        stationId,
        actionType: 'check_out',
        result: 'unknown_card',
        message: 'Mitarbeiter nicht gefunden',
      })
    return {
      ok: false as const,
      result: 'unknown_card' as const,
      message: 'Mitarbeiter nicht gefunden',
    }
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
        message: 'Für diesen Mitarbeiter ist aktuell keine laufende Schicht vorhanden.',
      })
    return {
      ok: false as const,
      result: 'not_checked_in' as const,
      message: 'Für diesen Mitarbeiter ist aktuell keine laufende Schicht vorhanden.',
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

  const kind = resolveShiftCloseChecklistKind({
    db,
    stationId,
    employeeId,
    shiftId: running.shiftId ?? null,
    timeEntryStartAt: running.startAt,
    now: new Date(),
  })
  const checklistPayload = buildShiftCloseChecklistStartPayload(db, stationId, kind)

  return {
    ok: true as const,
    result: 'checklist_required' as const,
    message: 'Bitte Checkliste abschließen',
    employee: emp,
    timeEntry: running,
    checklistType: checklistPayload.checklistType,
    checklistItems: checklistPayload.items,
    wizardGroups: checklistPayload.wizardGroups,
  }
}

export function clockCheckOutComplete(
  db: Database,
  body: { timeEntryId: string; checklist: Record<string, unknown>; endedBy: string; force?: boolean },
  options?: { logCardOnSuccess?: { cardNumber: string; stationId: string; employeeId: string } },
):
  | { ok: true; data: NonNullable<ReturnType<typeof getTimeEntry>> }
  | { ok: false; error: string }
  | {
      ok: false
      requiresConfirmation: true
      reason: 'early_end' | 'late_end'
      plannedEnd: string
      actualEnd: string
      deviationMinutes: number
      message: string
    } {
  const timeEntryId = String(body.timeEntryId ?? '').trim()
  const checklist = body.checklist ?? {}
  const endedBy = String(body.endedBy ?? 'System').trim() || 'System'
  const force = Boolean(body.force)
  if (!timeEntryId) throw new Error('timeEntryId erforderlich')

  const row = db.prepare(`SELECT * FROM time_entries WHERE id = ?`).get(timeEntryId) as TimeEntryRow | undefined
  if (!row || row.status !== 'running') {
    return { ok: false as const, error: 'Kein laufender Zeiteintrag' }
  }

  const endTs = nowIso()
  const endNow = new Date(endTs)
  if (!force) {
    const dateIso = row.start_at.slice(0, 10)
    const pForEnd = plannedShiftForTimeEntry(db, row.station_id, row.employee_id, dateIso, row.shift_id)
    if (pForEnd?.end_time) {
      const endM = parseHHMM(String(pForEnd.end_time).trim())
      const nowM = minutesOfDayLocal(endNow)
      const diff = nowM - endM
      if (Math.abs(diff) > SHIFT_CLOCK_TOLERANCE_MIN) {
        const plannedEnd = String(pForEnd.end_time).trim()
        const actualEnd = formatHM(endNow)
        const deviationMinutes = Math.abs(diff)
        const isEarly = diff < 0
        return {
          ok: false as const,
          requiresConfirmation: true as const,
          reason: isEarly ? ('early_end' as const) : ('late_end' as const),
          plannedEnd,
          actualEnd,
          deviationMinutes,
          message: isEarly
            ? 'Du beendest deine Schicht früher als geplant.'
            : 'Du beendest deine Schicht später als geplant.',
        }
      }
    }
  }

  if (isStructuredShiftClosePayload(checklist as Record<string, unknown>)) {
    const v = validateStructuredShiftCloseChecklistForStation(db, row.station_id, checklist as Record<string, unknown>)
    if (!v.ok) return { ok: false as const, error: v.error }
    insertShiftCloseChecklistParsed(db, timeEntryId, row.employee_id, row.station_id, v.data)
  } else {
    const v = validateShiftCloseChecklist(checklist)
    if (!v.ok) return { ok: false as const, error: v.error ?? 'Checkliste unvollständig' }
    insertChecklist(db, timeEntryId, row.employee_id, checklist)
    syncReviewItemsFromCloseChecklist(db, {
      timeEntryId,
      employeeId: row.employee_id,
      stationId: row.station_id,
      checklist: checklist as Record<string, unknown>,
    })
  }

  const dateIso = row.start_at.slice(0, 10)
  const pshift = plannedShiftForTimeEntry(db, row.station_id, row.employee_id, dateIso, row.shift_id)
  const endMeta = computeEndDeviationPersist(endNow, pshift)
  db.prepare(
    `UPDATE time_entries SET planned_end_at = ?, end_deviation_minutes = ?, end_deviation_type = ? WHERE id = ? AND status = 'running'`,
  ).run(endMeta.plannedEndAt, endMeta.minutes, endMeta.type, timeEntryId)

  closeTimeEntry(db, timeEntryId, endedBy, { endAt: endTs })

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

  return { ok: true as const, data: getTimeEntry(db, timeEntryId)! }
}
