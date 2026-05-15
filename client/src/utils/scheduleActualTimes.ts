import type { ResolvedShiftBlock } from '../data/mockSchedule'
import type { TimeEntry, TimeEntrySource } from '../types/timeTracking'
import {
  entryEndHm,
  entryStartHm,
  filterRenderableScheduleBlocks,
  isPlaceholderTimeRange,
  isRealHmRange,
  isRenderableTimeEntry,
  isValidHm,
  parseHmMinutes,
} from './scheduleShiftRender'

const DEVIATION_MINUTES = 5

function parseHm(t: string): number {
  return parseHmMinutes(t)
}

function entryOnDate(e: TimeEntry, dateISO: string): boolean {
  const startYmd = e.startAt.slice(0, 10)
  const endYmd = e.endAt?.slice(0, 10) ?? startYmd
  return startYmd <= dateISO && endYmd >= dateISO
}

function overlapsShift(e: TimeEntry, block: ResolvedShiftBlock): boolean {
  if (!e.endAt || e.status === 'running') return false
  if (e.shiftId && e.shiftId === block.id) return true
  const es = parseHm(entryStartHm(e))
  const ee = parseHm(entryEndHm(e) ?? '')
  const ss = parseHm(block.start)
  const se = parseHm(block.end)
  return es < se && ee > ss
}

function sourceLabel(source: TimeEntrySource | undefined): string {
  switch (source) {
    case 'tablet':
    case 'cash_register_card_terminal':
      return 'Tablet'
    case 'employee_mobile_app':
      return 'Mitarbeiter-App'
    case 'manual':
      return 'Manuell'
    default:
      return source ? String(source) : '—'
  }
}

export type ShiftStampOverlay = {
  stampStatus: ResolvedShiftBlock['stampStatus']
  stampActualStart: string
  stampActualEnd: string | null
  stampSource: string
}

/** Stempel-Status für geplanten Balken (ohne Planzeiten zu ändern). */
export function resolveStampStatusForShift(
  block: ResolvedShiftBlock,
  entries: TimeEntry[],
): ShiftStampOverlay | null {
  if (!block.employeeId || block.open || block.requirementGap || block.istOnly) return null

  const dayEntries = entries.filter(
    (e) => e.employeeId === block.employeeId && entryOnDate(e, block.dateISO) && isRenderableTimeEntry(e),
  )
  if (!dayEntries.length) return null

  const running = dayEntries.find((e) => e.status === 'running')
  if (running) {
    const start = entryStartHm(running)
    if (!isValidHm(start)) return null
    return {
      stampStatus: 'running',
      stampActualStart: start,
      stampActualEnd: null,
      stampSource: sourceLabel(running.source),
    }
  }

  const completed = dayEntries.filter((e) => e.status === 'completed' && e.endAt)
  if (!completed.length) return null

  const matched = completed.filter((e) => overlapsShift(e, block))
  if (!matched.length) return null

  let start: string | null = null
  let end: string | null = null
  let pendingApproval = false
  let source: TimeEntrySource | undefined
  for (const e of matched) {
    const s = entryStartHm(e)
    const en = entryEndHm(e)
    if (s && (!start || s < start)) start = s
    if (en && (!end || en > end)) end = en
    if (e.approvalStatus !== 'approved') pendingApproval = true
    source = e.source
  }
  if (!isRealHmRange(start, end)) return null

  const planStart = parseHm(block.start)
  const planEnd = parseHm(block.end)
  const stampStart = parseHm(start!)
  const stampEnd = parseHm(end!)
  const deviation =
    Math.abs(stampStart - planStart) > DEVIATION_MINUTES ||
    Math.abs(stampEnd - planEnd) > DEVIATION_MINUTES

  let stampStatus: NonNullable<ResolvedShiftBlock['stampStatus']>
  if (pendingApproval) stampStatus = 'pending_approval'
  else if (deviation) stampStatus = 'deviation'
  else stampStatus = 'clocked_in'

  return {
    stampStatus,
    stampActualStart: start!,
    stampActualEnd: end,
    stampSource: sourceLabel(source),
  }
}

/** Organisations-Schichtplan: nur Plan-Balken, optional Stempel-Badge. */
export function enrichBlocksWithStampStatus(
  blocks: ResolvedShiftBlock[],
  entries: TimeEntry[],
): ResolvedShiftBlock[] {
  return blocks.map((block) => {
    if (block.open || block.requirementGap || block.istOnly) return block
    const stamp = resolveStampStatusForShift(block, entries)
    if (!stamp) {
      const { actualStart, actualEnd, actualPendingApproval, actualRunning, stampStatus, stampActualStart, stampActualEnd, stampSource, ...rest } =
        block
      void actualStart
      void actualEnd
      void actualPendingApproval
      void actualRunning
      void stampStatus
      void stampActualStart
      void stampActualEnd
      void stampSource
      return rest
    }
    const { actualStart, actualEnd, actualPendingApproval, actualRunning, ...rest } = block
    void actualStart
    void actualEnd
    void actualPendingApproval
    void actualRunning
    return { ...rest, ...stamp }
  })
}

export { filterRenderableScheduleBlocks, isPlaceholderTimeRange }
