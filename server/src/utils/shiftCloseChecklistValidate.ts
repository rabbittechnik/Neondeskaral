import type { Database } from 'better-sqlite3'
import type { ShiftCloseChecklistKind } from '../constants/shiftCloseChecklistCatalog.js'
import {
  ensureStationShiftCloseChecklistDefsSeeded,
  listActiveShiftCloseChecklistDefs,
  type ShiftCloseAnswerMode,
} from '../services/stationShiftChecklistDefService.js'

export type StructuredChecklistItemIn = {
  itemKey: string
  itemLabel?: string
  answer: string
  reason?: string
}

export type StructuredChecklistIn = {
  checklistType: string
  confirmTruth?: unknown
  cashDifference?: unknown
  items?: unknown
}

function normAnswer(a: string): 'yes' | 'no' | 'not_relevant' | null {
  const s = String(a ?? '').trim().toLowerCase()
  if (s === 'yes' || s === 'ja' || s === 'true' || s === '1') return 'yes'
  if (s === 'no' || s === 'nein' || s === 'false' || s === '0') return 'no'
  if (s === 'not_relevant' || s === 'nicht_relevant' || s === 'n/a' || s === 'na') return 'not_relevant'
  return null
}

export function isStructuredShiftClosePayload(c: Record<string, unknown>): boolean {
  return Array.isArray(c.items) && (c.checklistType === 'handover' || c.checklistType === 'closing')
}

/**
 * Prüft die Checkliste gegen die **stationsbezogenen** Standard-Definitionen in der DB
 * (aktive Punkte, Reihenfolge, Antwortmodus).
 */
export function validateStructuredShiftCloseChecklistForStation(
  db: Database,
  stationId: string,
  checklist: Record<string, unknown>,
): { ok: true; data: ParsedStructuredChecklist } | { ok: false; error: string } {
  if (!isStructuredShiftClosePayload(checklist)) {
    return { ok: false, error: 'Ungültige Checkliste: Bitte App aktualisieren und erneut versuchen.' }
  }
  const kind = checklist.checklistType as ShiftCloseChecklistKind

  ensureStationShiftCloseChecklistDefsSeeded(db, stationId)
  const defs = listActiveShiftCloseChecklistDefs(db, stationId, kind)
  const expected = new Set(defs.map((d) => d.item_key))
  const labelByKey = new Map(defs.map((d) => [d.item_key, d.label]))
  const modeByKey = new Map(defs.map((d) => [d.item_key, (String(d.answer_mode ?? 'yes_no') as ShiftCloseAnswerMode) || 'yes_no']))
  const order = defs.map((d) => d.item_key)

  const truth =
    checklist.confirmTruth === true ||
    checklist.confirmTruth === 1 ||
    String(checklist.confirmTruth ?? '').toLowerCase() === 'true'
  if (!truth) {
    return { ok: false, error: 'Bitte bestätigen, dass die Angaben wahrheitsgemäß sind.' }
  }

  const rawItems = checklist.items as unknown[]
  if (!Array.isArray(rawItems) || rawItems.length !== expected.size) {
    return { ok: false, error: 'Checkliste unvollständig: alle Punkte müssen beantwortet werden.' }
  }

  const seen = new Set<string>()
  const items: ParsedStructuredChecklist['items'] = []

  for (const row of rawItems) {
    if (!row || typeof row !== 'object') return { ok: false, error: 'Ungültige Checklistenzeile.' }
    const o = row as Record<string, unknown>
    const itemKey = String(o.itemKey ?? o.item_key ?? '').trim()
    if (!itemKey || !expected.has(itemKey)) return { ok: false, error: `Unbekannter Checklistenpunkt: ${itemKey}` }
    if (seen.has(itemKey)) return { ok: false, error: `Doppelter Punkt: ${itemKey}` }
    seen.add(itemKey)
    const ans = normAnswer(String(o.answer ?? ''))
    if (!ans) return { ok: false, error: `Ungültige Antwort bei „${labelByKey.get(itemKey) ?? itemKey}“.` }
    const mode = modeByKey.get(itemKey) ?? 'yes_no'
    if (ans === 'not_relevant' && mode !== 'yes_no_not_relevant') {
      return { ok: false, error: `„Nicht relevant“ ist hier nicht erlaubt: ${labelByKey.get(itemKey) ?? itemKey}` }
    }
    const reason = String(o.reason ?? '').trim()
    if (ans === 'no' && !reason) {
      return {
        ok: false,
        error: `Bei „Nein“ ist eine Begründung erforderlich: ${labelByKey.get(itemKey) ?? itemKey}`,
      }
    }
    items.push({
      itemKey,
      itemLabel: String(o.itemLabel ?? o.item_label ?? labelByKey.get(itemKey) ?? itemKey),
      answer: ans,
      reason: reason || undefined,
    })
  }

  if (seen.size !== expected.size) {
    return { ok: false, error: 'Es fehlen Antworten für einen oder mehrere Checklistenpunkte.' }
  }

  let cash = 0
  try {
    const v = checklist.cashDifference ?? checklist.cash_difference
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
      if (!Number.isFinite(n)) return { ok: false, error: 'Kassendifferenz ungültig.' }
      if (Math.abs(n) > 1_000_000) return { ok: false, error: 'Kassendifferenz außerhalb des zulässigen Bereichs.' }
      cash = Math.round(n * 100) / 100
    }
  } catch {
    return { ok: false, error: 'Kassendifferenz ungültig.' }
  }

  items.sort((a, b) => order.indexOf(a.itemKey) - order.indexOf(b.itemKey))

  return {
    ok: true,
    data: {
      checklistType: kind,
      confirmTruth: true,
      cashDifference: cash,
      items,
    },
  }
}

export type ParsedStructuredChecklist = {
  checklistType: ShiftCloseChecklistKind
  confirmTruth: boolean
  cashDifference: number
  items: { itemKey: string; itemLabel: string; answer: 'yes' | 'no' | 'not_relevant'; reason?: string }[]
}
