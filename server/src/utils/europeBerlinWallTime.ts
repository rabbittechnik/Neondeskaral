/** Kalender-/Uhrzeit-Logik für Schichtplan: immer Europe/Berlin (Wall Clock), unabhängig von der Server-Prozess-TZ. */

export const EUROPE_BERLIN = 'Europe/Berlin'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function padHHMM(t: string): string {
  const s = String(t ?? '').trim()
  const parts = s.split(':')
  const h = String(parts[0] ?? '0').padStart(2, '0')
  const m = String(parts[1] ?? '0').padStart(2, '0')
  return `${h}:${m}`
}

function berlinPartsAtUtcMs(utcMs: number): { y: number; m: number; d: number; h: number; min: number } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: EUROPE_BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const o: Record<string, number> = {}
  for (const p of f.formatToParts(new Date(utcMs))) {
    if (p.type === 'year' || p.type === 'month' || p.type === 'day' || p.type === 'hour' || p.type === 'minute') {
      o[p.type] = Number(p.value)
    }
  }
  return { y: o.year!, m: o.month!, d: o.day!, h: o.hour!, min: o.minute! }
}

/**
 * Wandelt YYYY-MM-DD + HH:mm (Europe/Berlin, keine Sommerzeit in der Eingabe) in UTC-Millisekunden.
 * Schrittweise Suche ±36h um grobe Schätzung — robust bei DST.
 */
export function berlinWallClockToUtcMs(ymd: string, hhmm: string): number {
  const ty = Number(ymd.slice(0, 4))
  const tm = Number(ymd.slice(5, 7))
  const td = Number(ymd.slice(8, 10))
  const hm = padHHMM(hhmm)
  const th = Number(hm.slice(0, 2))
  const tmin = Number(hm.slice(3, 5))

  const guess = Date.UTC(ty, tm - 1, td, th - 1, tmin, 0)
  const from = guess - 36 * 60 * 60 * 1000
  const to = guess + 36 * 60 * 60 * 1000
  for (let t = from; t <= to; t += 60_000) {
    const p = berlinPartsAtUtcMs(t)
    if (p.y === ty && p.m === tm && p.d === td && p.h === th && p.min === tmin) return t
  }
  throw new Error(`Berlin-Zeit nicht auflösbar: ${ymd} ${hm}`)
}

export function ymdBerlinFromUtcMs(utcMs: number): string {
  const p = berlinPartsAtUtcMs(utcMs)
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`
}

export function addDaysToYmd(ymd: string, deltaDays: number): string {
  const y = Number(ymd.slice(0, 4))
  const mo = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  const utc = Date.UTC(y, mo - 1, d + deltaDays, 12, 0, 0)
  const x = new Date(utc)
  return `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`
}

/** Anzeige HH:mm (5 Zeichen) aus Rohzeit aus DB. */
export function displayHHMM(t: string): string {
  return padHHMM(t).slice(0, 5)
}

/** Lesbare Dauer: unter 60 nur Minuten, sonst Std. (+ optional Min.). */
export function formatHmDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes))
  if (m < 60) return `${m} Min.`
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (mm === 0) return `${h} Std.`
  return `${h} Std. ${mm} Min.`
}

/** Abweichung vom Schichtbeginn, z. B. „18 Min. früher“, „1 Std. 25 Min. später“. */
export function formatDeviationEarlyLateDe(direction: 'earlier' | 'later', totalMinutes: number): string {
  const base = formatHmDuration(Math.max(0, Math.round(totalMinutes)))
  return direction === 'earlier' ? `${base} früher` : `${base} später`
}

/** Aktuelle Uhrzeit als HH:mm in Europe/Berlin (für Terminal-Popup). */
export function formatTimeHmBerlin(utcMs: number): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: EUROPE_BERLIN,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(utcMs))
}
