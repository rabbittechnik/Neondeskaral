import type { Database } from 'better-sqlite3'
import { getEmployeeByCard } from './employeeService.js'
import {
  clockCheckInByEmployeeId,
  clockCheckOutComplete,
  clockCheckOutStartByEmployeeId,
} from './clockService.js'
import { getTimeEntry, logCardEvent } from './timeTrackingService.js'
import { acknowledgeShiftWarning } from './employeeShiftWarningService.js'

export function terminalCheckIn(
  db: Database,
  body: { cardNumber: string; stationId: string; force?: boolean },
) {
  const stationId = body.stationId || 'aral-bodelshausen'
  const card = String(body.cardNumber ?? '').trim()
  const force = Boolean(body.force)
  const emp = getEmployeeByCard(db, card, stationId)
  if (!emp) {
    logCardEvent(db, {
      cardNumber: card,
      stationId,
      actionType: 'check_in',
      result: 'unknown_card',
      message: 'Unbekannte Kartennummer',
    })
    return { ok: false as const, result: 'unknown_card' as const, message: 'Unbekannte Kartennummer' }
  }
  return clockCheckInByEmployeeId(db, {
    employeeId: emp.id,
    stationId,
    force,
    source: 'tablet',
    startedBy: 'Terminal',
    cardNumberForLog: card,
  })
}

export function terminalCheckOutStart(db: Database, body: { cardNumber: string; stationId: string }) {
  const stationId = body.stationId || 'aral-bodelshausen'
  const card = String(body.cardNumber ?? '').trim()
  const emp = getEmployeeByCard(db, card, stationId)
  if (!emp) {
    logCardEvent(db, {
      cardNumber: card,
      stationId,
      actionType: 'check_out',
      result: 'unknown_card',
      message: 'Unbekannte Kartennummer',
    })
    return { ok: false as const, result: 'unknown_card' as const, message: 'Unbekannte Kartennummer' }
  }
  return clockCheckOutStartByEmployeeId(db, {
    employeeId: emp.id,
    stationId,
    cardNumberForLog: card,
  })
}

export function terminalCheckOutComplete(
  db: Database,
  body: { timeEntryId: string; checklist: Record<string, unknown> },
) {
  const out = clockCheckOutComplete(db, {
    timeEntryId: body.timeEntryId,
    checklist: body.checklist,
    endedBy: 'Terminal',
  })
  if (!out.ok) return out
  const te = getTimeEntry(db, body.timeEntryId)
  if (te) {
    logCardEvent(db, {
      cardNumber: '',
      employeeId: te.employeeId,
      stationId: te.stationId,
      actionType: 'check_out',
      result: 'success',
      message: 'Ausgestempelt',
    })
  }
  return out
}

export function terminalAcknowledgeShiftWarning(
  db: Database,
  body: { cardNumber: string; stationId: string; warningId: string },
) {
  const stationId = body.stationId || 'aral-bodelshausen'
  const card = String(body.cardNumber ?? '').trim()
  const emp = getEmployeeByCard(db, card, stationId)
  if (!emp) {
    return { ok: false as const, message: 'Unbekannte Kartennummer' }
  }
  try {
    acknowledgeShiftWarning(db, body.warningId, emp.id)
    return { ok: true as const }
  } catch {
    return { ok: false as const, message: 'Hinweis konnte nicht bestätigt werden' }
  }
}
