import type { Database } from 'better-sqlite3'
import type { ShiftCloseChecklistKind } from '../constants/shiftCloseChecklistCatalog.js'
import {
  ensureStationShiftCloseChecklistDefsSeeded,
  listActiveShiftCloseChecklistDefs,
} from '../services/stationShiftChecklistDefService.js'

export type TabletNotDoneItem = { itemKey: string; reason: string }

/**
 * Baut die strukturierte Checkliste für das Stations-Tablet aus
 * „alles erledigt“ bzw. „nicht erledigt + Gründe“.
 */
export function buildStructuredChecklistFromTabletConfirm(
  db: Database,
  stationId: string,
  checklistType: ShiftCloseChecklistKind,
  confirmedAllDone: boolean,
  notDoneItems: TabletNotDoneItem[],
  cashDifference: number,
): { ok: true; checklist: Record<string, unknown> } | { ok: false; error: string } {
  ensureStationShiftCloseChecklistDefsSeeded(db, stationId)
  const defs = listActiveShiftCloseChecklistDefs(db, stationId, checklistType)
  if (defs.length === 0) {
    return { ok: false, error: 'Keine Checklisten-Definition für diese Station.' }
  }
  const keySet = new Set(defs.map((d) => d.item_key))
  const labelByKey = new Map(defs.map((d) => [d.item_key, d.label]))

  const nd = notDoneItems ?? []
  const hasNotDone = nd.length > 0

  if (confirmedAllDone && hasNotDone) {
    return { ok: false, error: 'Bitte entweder „alles erledigt“ oder die Liste der offenen Punkte wählen — nicht beides.' }
  }

  if (confirmedAllDone && !hasNotDone) {
    const items = defs.map((d) => ({
      itemKey: d.item_key,
      itemLabel: d.label,
      answer: 'yes',
    }))
    return {
      ok: true,
      checklist: {
        checklistType,
        confirmTruth: true,
        cashDifference,
        items,
      },
    }
  }

  if (!hasNotDone) {
    return { ok: false, error: 'Bitte bestätigen, dass alles erledigt ist, oder offene Punkte mit Begründung angeben.' }
  }

  const reasonByKey = new Map<string, string>()
  for (const row of nd) {
    const k = String(row.itemKey ?? '').trim()
    const rs = String(row.reason ?? '').trim()
    if (!k || !keySet.has(k)) return { ok: false, error: `Unbekannter Checklistenpunkt: ${k || '(leer)'}` }
    if (!rs) return { ok: false, error: `Begründung fehlt: ${labelByKey.get(k) ?? k}` }
    reasonByKey.set(k, rs)
  }

  const items = defs.map((d) => {
    const reason = reasonByKey.get(d.item_key)
    return {
      itemKey: d.item_key,
      itemLabel: d.label,
      answer: reason ? 'no' : 'yes',
      ...(reason ? { reason } : {}),
    }
  })

  return {
    ok: true,
    checklist: {
      checklistType,
      confirmTruth: true,
      cashDifference,
      items,
    },
  }
}
