import { addDaysToYmd, berlinWallClockToUtcMs, displayHHMM, ymdBerlinFromUtcMs } from './europeBerlinWallTime.js'

/** @deprecated Nur noch für ältere Clips; Lohn nutzt berlinRangeBoundsMs. */
export function utcRangeBoundsMs(fromYmd: string, toYmd: string): { start: number; end: number } {
  return berlinRangeBoundsMs(fromYmd, toYmd)
}

export function berlinRangeBoundsMs(fromYmd: string, toYmd: string): { start: number; end: number } {
  return {
    start: berlinWallClockToUtcMs(fromYmd, '00:00'),
    end: berlinWallClockToUtcMs(addDaysToYmd(toYmd, 1), '00:00'),
  }
}

const berlinYmdFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function berlinYmdFromMs(ms: number): string {
  return ymdBerlinFromUtcMs(ms)
}

/** Netto-Minuten aus Schichtplan-Zeiten (Europe/Berlin-Wanduhr, keine Dezimal-Uhrzeit). */
export function shiftNetMinutesFromPlan(
  dateStr: string,
  startTime: string,
  endTime: string,
  breakMin: number,
): number {
  const st = displayHHMM(startTime)
  const et = displayHHMM(endTime)
  const [sh, sm] = st.split(':').map((x) => Number(x))
  const [eh, em] = et.split(':').map((x) => Number(x))
  let sMin = (sh ?? 0) * 60 + (sm ?? 0)
  let eMin = (eh ?? 0) * 60 + (em ?? 0)
  if (eMin <= sMin) eMin += 24 * 60
  const gross = eMin - sMin
  const br = Math.max(0, Math.round(Number(breakMin) || 0))
  return Math.max(0, gross - br)
}

export function minutesToHours2(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100
}

export function hoursToMinutes(h: number): number {
  return Math.round(h * 60)
}

/**
 * Netto-Arbeitsminuten pro Kalendertag (Europe/Berlin) zwischen UTC-Instants; Pause anteilig.
 */
export function netMinutesByBerlinYmdFromUtc(
  startUtcMs: number,
  endUtcMs: number,
  breakMin: number,
  rangeFromYmd: string,
  rangeToYmd: string,
): Map<string, number> {
  const out = new Map<string, number>()
  if (!Number.isFinite(startUtcMs) || !Number.isFinite(endUtcMs) || endUtcMs <= startUtcMs) return out

  const { start: rangeLo, end: rangeHi } = berlinRangeBoundsMs(rangeFromYmd, rangeToYmd)
  const lo = Math.max(startUtcMs, rangeLo)
  const hi = Math.min(endUtcMs, rangeHi)
  if (hi <= lo) return out

  const totalSpanMin = Math.round((endUtcMs - startUtcMs) / 60_000)
  const overlapMin = Math.round((hi - lo) / 60_000)
  if (overlapMin <= 0 || totalSpanMin <= 0) return out

  const breakApplied = Math.round(Math.max(0, Number(breakMin) || 0) * (overlapMin / totalSpanMin))
  const netOverlap = Math.max(0, overlapMin - breakApplied)

  const grossByYmd = new Map<string, number>()
  for (let t = lo; t < hi; t += 60_000) {
    const ymd = ymdBerlinFromUtcMs(t + 30_000)
    grossByYmd.set(ymd, (grossByYmd.get(ymd) ?? 0) + 1)
  }
  const grossSum = [...grossByYmd.values()].reduce((a, b) => a + b, 0)
  if (grossSum <= 0) return out

  let assigned = 0
  const keys = [...grossByYmd.keys()].sort()
  for (let i = 0; i < keys.length; i++) {
    const ymd = keys[i]!
    const gm = grossByYmd.get(ymd) ?? 0
    let netMin: number
    if (i === keys.length - 1) {
      netMin = netOverlap - assigned
    } else {
      netMin = Math.floor((netOverlap * gm) / grossSum)
      assigned += netMin
    }
    if (netMin > 0) out.set(ymd, netMin)
  }
  return out
}

/** Schichtminuten auf Berlin-Kalendertage (ein Tag → exakte Planminuten). */
export function shiftMinutesByBerlinYmd(
  dateStr: string,
  startTime: string,
  endTime: string,
  breakMin: number,
  rangeFromYmd: string,
  rangeToYmd: string,
): Map<string, number> {
  const st = displayHHMM(startTime)
  const et = displayHHMM(endTime)
  let endDate = dateStr
  const [sh, sm] = st.split(':').map((x) => Number(x))
  const [eh, em] = et.split(':').map((x) => Number(x))
  if ((eh ?? 0) * 60 + (em ?? 0) <= (sh ?? 0) * 60 + (sm ?? 0)) {
    endDate = addDaysToYmd(dateStr, 1)
  }
  if (endDate === dateStr) {
    const netMin = shiftNetMinutesFromPlan(dateStr, startTime, endTime, breakMin)
    const out = new Map<string, number>()
    if (netMin > 0 && dateStr >= rangeFromYmd && dateStr <= rangeToYmd) {
      out.set(dateStr, netMin)
    }
    return out
  }
  const startMs = berlinWallClockToUtcMs(dateStr, st)
  const endMs = berlinWallClockToUtcMs(endDate, et)
  return netMinutesByBerlinYmdFromUtc(startMs, endMs, breakMin, rangeFromYmd, rangeToYmd)
}

/**
 * Netto-Arbeitsstunden pro Kalendertag (Europe/Berlin) – aus Minuten, nur Anzeige gerundet.
 */
export function netHoursByBerlinYmdInRange(
  startIso: string,
  endIso: string,
  breakMin: number,
  rangeFromYmd: string,
  rangeToYmd: string,
): Map<string, number> {
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  const mins = netMinutesByBerlinYmdFromUtc(s, e, breakMin, rangeFromYmd, rangeToYmd)
  const out = new Map<string, number>()
  for (const [ymd, m] of mins) {
    const h = minutesToHours2(m)
    if (h > 0) out.set(ymd, h)
  }
  return out
}

export function eachYmdInRangeInclusive(fromYmd: string, toYmd: string): string[] {
  const out: string[] = []
  const [fy, fm, fd] = fromYmd.split('-').map(Number)
  const [ty, tm, td] = toYmd.split('-').map(Number)
  let cur = new Date(Date.UTC(fy!, fm! - 1, fd!))
  const end = new Date(Date.UTC(ty!, tm! - 1, td!))
  while (cur <= end) {
    const y = cur.getUTCFullYear()
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0')
    const d = String(cur.getUTCDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur = new Date(Date.UTC(y, cur.getUTCMonth(), cur.getUTCDate() + 1))
  }
  return out
}
