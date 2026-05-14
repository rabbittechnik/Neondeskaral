/** UTC-Mitternacht bis End-of-day für YYYY-MM-DD (wie payrollReportService). */
export function utcRangeBoundsMs(fromYmd: string, toYmd: string): { start: number; end: number } {
  const [fy, fm, fd] = fromYmd.split('-').map(Number)
  const [ty, tm, td] = toYmd.split('-').map(Number)
  const start = Date.UTC(fy!, fm! - 1, fd!, 0, 0, 0, 0)
  const end = Date.UTC(ty!, tm! - 1, td!, 23, 59, 59, 999)
  return { start, end }
}

const berlinYmdFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function berlinYmdFromMs(ms: number): string {
  const parts = berlinYmdFmt.formatToParts(new Date(ms))
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '0'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Netto-Arbeitsstunden pro Kalendertag (Europe/Berlin), Pause anteilig wie bei entryNetHoursInRange.
 */
export function netHoursByBerlinYmdInRange(
  startIso: string,
  endIso: string,
  breakMin: number,
  rangeFromYmd: string,
  rangeToYmd: string,
): Map<string, number> {
  const out = new Map<string, number>()
  const { start: rs, end: re } = utcRangeBoundsMs(rangeFromYmd, rangeToYmd)
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return out
  const lo = Math.max(s, rs)
  const hi = Math.min(e, re)
  if (hi <= lo) return out
  const overlapMs = hi - lo
  const totalMs = e - s
  const ratio = totalMs > 0 ? overlapMs / totalMs : 0
  const breakAppliedMin = Math.max(0, Number(breakMin) || 0) * ratio

  const grossMinByYmd = new Map<string, number>()
  let grossTotalMin = 0
  for (let t = lo; t < hi; t += 60_000) {
    const ymd = berlinYmdFromMs(t + 30_000)
    const n = (grossMinByYmd.get(ymd) ?? 0) + 1
    grossMinByYmd.set(ymd, n)
    grossTotalMin += 1
  }
  if (grossTotalMin <= 0) return out

  for (const [ymd, gm] of grossMinByYmd) {
    const share = breakAppliedMin * (gm / grossTotalMin)
    const netMin = Math.max(0, gm - share)
    const h = Math.round((netMin / 60) * 100) / 100
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
