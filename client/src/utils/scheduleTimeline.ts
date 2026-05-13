import type { ResolvedShiftBlock } from '../data/mockSchedule'

/** Standard-Zeitfenster der Tagesachse (konfigurierbar über Props). */
export const DEFAULT_TIMELINE_DAY_START = '05:00'
/** Sichtbarer Standard bis Abend (ohne unnötige 24h-Achse). */
export const DEFAULT_TIMELINE_DAY_END = '22:00'

const MINUTES_PER_DAY = 24 * 60

/** Mindestbreite in % der Achse für Nachtschichten am rechten Rand */
const MIN_NIGHT_WIDTH_PERCENT = 3

export function timeToMinutes(time: string): number {
  const parts = time.trim().split(':')
  const h = Number(parts[0])
  const m = Number(parts[1] ?? 0)
  if (Number.isNaN(h)) return 0
  return h * 60 + (Number.isNaN(m) ? 0 : m)
}

export function minutesToClock(m: number): string {
  const x = ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const h = Math.floor(x / 60)
  const min = x % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export type ShiftPosition = {
  leftPercent: number
  widthPercent: number
}

export type TimelineClip = { vs: number; ve: number }

export function getShiftTimelineClip(
  startTime: string,
  endTime: string,
  dayStart: string,
  dayEnd: string,
): TimelineClip | null {
  const ds = timeToMinutes(dayStart)
  const de = timeToMinutes(dayEnd)
  const span = de - ds
  if (span <= 0) return null

  const sm = timeToMinutes(startTime)
  const emRaw = timeToMinutes(endTime)
  const overnight = emRaw <= sm

  const em = overnight ? emRaw + MINUTES_PER_DAY : emRaw

  let vs = Math.max(ds, sm)
  let ve = Math.min(de, em)

  if (ve <= vs) {
    if (overnight && sm < de && sm >= ds) {
      vs = Math.max(ds, sm)
      ve = de
      const minWMin = Math.max(12, (span * MIN_NIGHT_WIDTH_PERCENT) / 100)
      if (ve - vs < minWMin) {
        vs = Math.max(ds, ve - minWMin)
      }
    } else {
      return null
    }
  }

  if (ve <= vs) return null
  return { vs, ve }
}

export function getShiftPosition(
  startTime: string,
  endTime: string,
  dayStart: string,
  dayEnd: string,
): ShiftPosition | null {
  const clip = getShiftTimelineClip(startTime, endTime, dayStart, dayEnd)
  if (!clip) return null
  const ds = timeToMinutes(dayStart)
  const de = timeToMinutes(dayEnd)
  const span = de - ds
  if (span <= 0) return null
  return clipToPercent(clip, span, ds)
}

function clipToPercent(clip: TimelineClip, span: number, ds: number): ShiftPosition {
  return {
    leftPercent: ((clip.vs - ds) / span) * 100,
    widthPercent: ((clip.ve - clip.vs) / span) * 100,
  }
}

function hoursBetweenMinutes(startM: number, endM: number): number {
  let e = endM
  if (e <= startM) e += MINUTES_PER_DAY
  return (e - startM) / 60
}

export function sumShiftHoursForDay(blocks: ResolvedShiftBlock[]): number {
  let t = 0
  for (const b of blocks) {
    if (b.type === 'frei') continue
    const sm = timeToMinutes(b.start)
    const em = timeToMinutes(b.end)
    t += hoursBetweenMinutes(sm, em)
  }
  return Math.round(t * 100) / 100
}

export type ShiftTimelineRowItem = {
  block: ResolvedShiftBlock
  vs: number
  ve: number
  row: number
  leftPercent: number
  widthPercent: number
  /** Gleiche Zeile: vorherige Schicht endet ≤5 min vor Start → optisch ohne Lücke */
  seamBefore: boolean
  /** Gleiche Zeile: nächste Schicht beginnt ≤5 min nach Ende */
  seamAfter: boolean
}

function intervalsOverlap(aVs: number, aVe: number, bVs: number, bVe: number): boolean {
  return aVs < bVe && bVs < aVe
}

/**
 * Überlappende Schichten erhalten unterschiedliche Zeilen (greedy nach Startzeit).
 */
export function groupShiftsIntoRows(
  blocks: ResolvedShiftBlock[],
  dayStart: string,
  dayEnd: string,
): ShiftTimelineRowItem[] {
  const ds = timeToMinutes(dayStart)
  const de = timeToMinutes(dayEnd)
  const span = de - ds
  if (span <= 0) return []

  type P = {
    block: ResolvedShiftBlock
    vs: number
    ve: number
    leftPercent: number
    widthPercent: number
  }

  const prepared: P[] = blocks
    .map((block) => {
      const clip = getShiftTimelineClip(block.start, block.end, dayStart, dayEnd)
      if (!clip) return null
      const pct = clipToPercent(clip, span, ds)
      return { block, vs: clip.vs, ve: clip.ve, ...pct }
    })
    .filter((x): x is P => x !== null)
    .sort((a, b) => a.vs - b.vs || b.ve - a.ve)

  const rowIntervals: { vs: number; ve: number }[][] = []
  const result: ShiftTimelineRowItem[] = []

  for (const item of prepared) {
    let row = -1
    for (let r = 0; r < rowIntervals.length; r++) {
      const clash = rowIntervals[r].some((iv) =>
        intervalsOverlap(item.vs, item.ve, iv.vs, iv.ve),
      )
      if (!clash) {
        row = r
        break
      }
    }
    if (row < 0) {
      row = rowIntervals.length
      rowIntervals.push([])
    }
    rowIntervals[row].push({ vs: item.vs, ve: item.ve })
    result.push({
      ...item,
      row,
      seamBefore: false,
      seamAfter: false,
    })
  }

  const SEAM_TOLERANCE_MIN = 5
  const byRow = new Map<number, ShiftTimelineRowItem[]>()
  for (const it of result) {
    const arr = byRow.get(it.row) ?? []
    arr.push(it)
    byRow.set(it.row, arr)
  }
  for (const list of byRow.values()) {
    list.sort((a, b) => a.vs - b.vs || a.ve - b.ve)
    for (let i = 0; i < list.length; i++) {
      const cur = list[i]!
      const prev = list[i - 1]
      const next = list[i + 1]
      if (prev) {
        const gap = cur.vs - prev.ve
        if (gap >= 0 && gap <= SEAM_TOLERANCE_MIN) cur.seamBefore = true
      }
      if (next) {
        const gap = next.vs - cur.ve
        if (gap >= 0 && gap <= SEAM_TOLERANCE_MIN) cur.seamAfter = true
      }
    }
  }

  return result
}

export function buildTimelineTicks(
  dayStart: string,
  dayEnd: string,
  stepMinutes = 180,
): number[] {
  const ds = timeToMinutes(dayStart)
  const de = timeToMinutes(dayEnd)
  const ticks: number[] = []
  for (let t = ds; t <= de; t += stepMinutes) {
    ticks.push(Math.min(t, de))
  }
  if (ticks.length === 0 || ticks[ticks.length - 1] !== de) ticks.push(de)
  return [...new Set(ticks)].sort((a, b) => a - b)
}

export type WeekTimelineRange = { start: string; end: string }

function snapTimelineDown30(minutes: number): number {
  return Math.floor(minutes / 30) * 30
}

function snapTimelineUp30(minutes: number): number {
  return Math.ceil(minutes / 30) * 30
}

function formatTimelineClock(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/**
 * Einheitliches Tagesfenster für die Wochen-Timeline aus allen Schichten (ohne „Frei“),
 * inkl. Puffer und 30-Minuten-Raster. Nachtschichten verlängern das Ende über Mitternacht (z. B. 30:30).
 */
export function computeTimelineRangeFromWeekBlocks(
  blocks: ResolvedShiftBlock[],
  options?: {
    bufferMinutes?: number
    fallbackStart?: string
    fallbackEnd?: string
    minSpanMinutes?: number
    maxEndMinutes?: number
  },
): WeekTimelineRange {
  const buffer = options?.bufferMinutes ?? 30
  const fallbackStart = options?.fallbackStart ?? DEFAULT_TIMELINE_DAY_START
  const fallbackEnd = options?.fallbackEnd ?? DEFAULT_TIMELINE_DAY_END
  const minSpan = options?.minSpanMinutes ?? 9 * 60
  const maxEndCap = options?.maxEndMinutes ?? 48 * 60

  const relevant = blocks.filter((b) => b.type !== 'frei')
  if (relevant.length === 0) {
    return { start: fallbackStart, end: fallbackEnd }
  }

  let minStart = Number.POSITIVE_INFINITY
  let maxEnd = 0

  for (const b of relevant) {
    const sm = timeToMinutes(b.start)
    let em = timeToMinutes(b.end)
    if (em <= sm) {
      em += MINUTES_PER_DAY
    }
    minStart = Math.min(minStart, sm)
    maxEnd = Math.max(maxEnd, em)
  }

  if (!Number.isFinite(minStart)) {
    return { start: fallbackStart, end: fallbackEnd }
  }

  let startM = snapTimelineDown30(minStart - buffer)
  let endM = snapTimelineUp30(maxEnd + buffer)

  if (startM < 0) startM = 0
  if (endM > maxEndCap) endM = maxEndCap

  if (endM - startM < minSpan) {
    endM = startM + minSpan
    if (endM > maxEndCap) {
      endM = maxEndCap
      startM = Math.max(0, endM - minSpan)
    }
  }

  return {
    start: formatTimelineClock(startM),
    end: formatTimelineClock(endM),
  }
}
