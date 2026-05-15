import type { ResolvedShiftBlock } from '../data/mockSchedule'
import type { TimeEntry } from '../types/timeTracking'

const PLACEHOLDER_STARTS = new Set(['00:00', '0:00'])
const SUSPICIOUS_ENDS = new Set(['00:00', '0:00', '08:00', '8:00'])

export function normalizeHm(hm: string): string {
  const t = hm.trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return t
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

export function parseHmMinutes(hm: string): number {
  const n = normalizeHm(hm)
  const [h, m] = n.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function isValidHm(hm: string | undefined | null): boolean {
  if (!hm?.trim()) return false
  return /^\d{1,2}:\d{2}$/.test(hm.trim())
}

export function isPlaceholderHm(hm: string | undefined | null): boolean {
  if (!hm) return true
  return PLACEHOLDER_STARTS.has(normalizeHm(hm))
}

/** Verdächtige System-Platzhalter (z. B. 00:00–08:00). */
export function isPlaceholderTimeRange(
  start: string | undefined | null,
  end: string | undefined | null,
): boolean {
  if (!isValidHm(start) || !isValidHm(end)) return true
  const s = normalizeHm(start!)
  const e = normalizeHm(end!)
  if (s === e) return true
  if (PLACEHOLDER_STARTS.has(s) && SUSPICIOUS_ENDS.has(e)) return true
  const dur = parseHmMinutes(e) - parseHmMinutes(s)
  if (dur <= 0) return true
  if (PLACEHOLDER_STARTS.has(s) && dur <= 8 * 60) return true
  return false
}

export function isRealHmRange(
  start: string | undefined | null,
  end: string | undefined | null,
): boolean {
  return isValidHm(start) && isValidHm(end) && !isPlaceholderTimeRange(start, end)
}

const REAL_STAMP_SOURCES = new Set<TimeEntry['source']>([
  'tablet',
  'employee_mobile_app',
  'cash_register_card_terminal',
  'manual',
])

export function hmFromIsoBerlin(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin',
  })
}

export function entryStartHm(e: TimeEntry): string {
  const iso = e.stampedStartAt?.trim() || e.effectiveStartAt?.trim() || e.startAt
  return hmFromIsoBerlin(iso)
}

export function entryEndHm(e: TimeEntry): string | null {
  const iso = e.stampedEndAt?.trim() || e.effectiveEndAt?.trim() || e.endAt
  if (!iso?.trim()) return null
  return hmFromIsoBerlin(iso)
}

/** Zeitbuchung, die im Schichtplan als Ist-Balken erscheinen darf. */
export function isRenderableTimeEntry(e: TimeEntry): boolean {
  if (!e.employeeId?.trim()) return false
  if (e.status === 'cancelled') return false

  const start = entryStartHm(e)
  if (!isValidHm(start) || isPlaceholderHm(start)) return false

  if (e.status === 'running') {
    return REAL_STAMP_SOURCES.has(e.source)
  }

  if (e.status !== 'completed' || !e.endAt) return false

  const end = entryEndHm(e)
  if (!isRealHmRange(start, end)) return false

  if (e.source === 'system' && !e.shiftId) return false

  return REAL_STAMP_SOURCES.has(e.source)
}

export function sanitizeBlockActualTimes(block: ResolvedShiftBlock): ResolvedShiftBlock {
  if (block.actualRunning) {
    if (!isValidHm(block.actualStart) || isPlaceholderHm(block.actualStart)) {
      const { actualStart, actualEnd, actualPendingApproval, actualRunning, ...rest } = block
      void actualStart
      void actualEnd
      void actualPendingApproval
      void actualRunning
      return rest
    }
    return block
  }
  if (!block.actualStart && !block.actualEnd) return block
  if (!isRealHmRange(block.actualStart, block.actualEnd)) {
    const { actualStart, actualEnd, actualPendingApproval, ...rest } = block
    void actualStart
    void actualEnd
    void actualPendingApproval
    return rest
  }
  return block
}

/** Vor dem Rendern: keine Ghost-/Platzhalter-Balken. */
export function isRenderableScheduleBlock(block: ResolvedShiftBlock): boolean {
  if (block.requirementGap) return true

  if (block.istOnly) return false

  if (block.open) {
    return isValidHm(block.start) && isValidHm(block.end) && !isPlaceholderTimeRange(block.start, block.end)
  }

  if (!block.employeeId) return false
  const hasPlanned = isValidHm(block.start) && isValidHm(block.end)
  if (!hasPlanned) return false

  return true
}

export function filterRenderableScheduleBlocks(blocks: ResolvedShiftBlock[]): ResolvedShiftBlock[] {
  return blocks.map(sanitizeBlockActualTimes).filter(isRenderableScheduleBlock)
}
