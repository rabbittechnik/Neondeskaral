/** Feste Schichtübergabe ca. 14:00 Uhr — nur Schichtende-Popup, keine Einzelaufgaben in der Aufgabenliste. */

import { EUROPE_BERLIN } from '../utils/europeBerlinWallTime.js'

export const MIDDAY_HANDOVER_WINDOW_START_MIN = 13 * 60
export const MIDDAY_HANDOVER_WINDOW_END_MIN = 15 * 60

/** Minute des Tages in Europe/Berlin (Schichtplan-/Tankstellenzeit). */
export function minutesOfDayBerlin(d: Date): number {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: EUROPE_BERLIN,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  let h = 0
  let min = 0
  for (const p of f.formatToParts(d)) {
    if (p.type === 'hour') h = Number(p.value)
    if (p.type === 'minute') min = Number(p.value)
  }
  return h * 60 + min
}
export function parseEndTimeToMinutes(hm: string | null | undefined): number | null {
  const t = String(hm ?? '').trim()
  if (!t) return null
  const parts = t.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1] ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

export function isMinuteInMiddayHandoverWindow(minuteOfDay: number): boolean {
  return minuteOfDay >= MIDDAY_HANDOVER_WINDOW_START_MIN && minuteOfDay <= MIDDAY_HANDOVER_WINDOW_END_MIN
}

/** Geplantes Ende oder aktuelles Ausstempeln (now) liegt im Toleranzfenster 13:00–15:00. */
export function middayCollectiveHandoverApplies(p: {
  now: Date
  plannedEndTimeHm: string | null | undefined
}): boolean {
  if (isMinuteInMiddayHandoverWindow(minutesOfDayBerlin(p.now))) return true
  const endM = parseEndTimeToMinutes(p.plannedEndTimeHm)
  if (endM != null && isMinuteInMiddayHandoverWindow(endM)) return true
  return false
}

/** Snapshot-Texte (Reihenfolge = DB item_key mid_ho_01 …). */
export const MIDDAY_STANDARD_HANDOVER_LABELS: readonly string[] = [
  'Zigaretten alle aufgefüllt',
  'Getränke aufgefüllt',
  'Volle Mülleimer geleert',
  'Hülsen nach vorne gezogen',
  'Kleine Flaschen Alkohol nach vorne gezogen',
  'Es sind noch genug Kaffeebecher da',
  'Es sind noch genug Kaffeebohnen in der Maschine',
  'Zucker für Kunden ist aufgefüllt',
  'Kaffeesahne für Kunden ist aufgefüllt',
  'Deckel für die Becher sind genug da',
  'Rührstäbchen sind genug da',
  'Toilette Sichtprüfung der Sauberkeit',
] as const

export const MIDDAY_COLLECTIVE_SUBMISSION_KIND = 'midday_collective' as const
export const MIDDAY_COLLECTIVE_HANDOVER_VARIANT = 'midday_collective' as const
