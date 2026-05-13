import type { ShiftRow } from '../services/shiftService.js'
import { addDaysToYmd, berlinWallClockToUtcMs, padHHMM } from './europeBerlinWallTime.js'

/** Geplanter Schichtbeginn/-ende als UTC-ms (Europe/Berlin Wandzeit, Mitternachtsschicht: Ende am Folgetag). */
export function shiftBoundsBerlin(row: ShiftRow): { startMs: number; endMs: number } | null {
  const date = String(row.date ?? '').trim()
  const st = String(row.start_time ?? '').trim()
  const en = String(row.end_time ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !st || !en) return null
  try {
    const startMs = berlinWallClockToUtcMs(date, padHHMM(st))
    let endMs = berlinWallClockToUtcMs(date, padHHMM(en))
    if (endMs <= startMs) {
      const next = addDaysToYmd(date, 1)
      endMs = berlinWallClockToUtcMs(next, padHHMM(en))
    }
    return { startMs, endMs }
  } catch {
    return null
  }
}
