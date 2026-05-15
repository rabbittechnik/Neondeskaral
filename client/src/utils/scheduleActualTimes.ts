import type { ResolvedShiftBlock } from '../data/mockSchedule'
import type { TimeEntry } from '../types/timeTracking'
import {
  entryEndHm,
  entryStartHm,
  filterRenderableScheduleBlocks,
  isPlaceholderTimeRange,
  isRealHmRange,
  isRenderableTimeEntry,
  isValidHm,
  parseHmMinutes,
  sanitizeBlockActualTimes,
} from './scheduleShiftRender'

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

export type ShiftActualTimes = {
  actualStart: string
  actualEnd: string
  pendingApproval: boolean
  actualRunning?: boolean
}

export function resolveActualTimesForShift(
  block: ResolvedShiftBlock,
  entries: TimeEntry[],
): ShiftActualTimes | null {
  if (!block.employeeId || block.open || block.requirementGap) return null

  const dayEntries = entries.filter(
    (e) => e.employeeId === block.employeeId && entryOnDate(e, block.dateISO) && isRenderableTimeEntry(e),
  )
  if (!dayEntries.length) return null

  const running = dayEntries.find((e) => e.status === 'running')
  if (running) {
    const start = entryStartHm(running)
    if (!isValidHm(start)) return null
    return {
      actualStart: start,
      actualEnd: '',
      pendingApproval: running.approvalStatus !== 'approved',
      actualRunning: true,
    }
  }

  const completed = dayEntries.filter((e) => e.status === 'completed' && e.endAt)
  if (!completed.length) return null

  const matched = completed.filter((e) => overlapsShift(e, block))
  const list = matched.length ? matched : completed

  let start: string | null = null
  let end: string | null = null
  let pendingApproval = false
  for (const e of list) {
    const s = entryStartHm(e)
    const en = entryEndHm(e)
    if (s && (!start || s < start)) start = s
    if (en && (!end || en > end)) end = en
    if (e.approvalStatus !== 'approved') pendingApproval = true
  }
  if (!isRealHmRange(start, end)) return null
  return { actualStart: start!, actualEnd: end!, pendingApproval }
}

export function enrichBlocksWithActualTimes(
  blocks: ResolvedShiftBlock[],
  entries: TimeEntry[],
): ResolvedShiftBlock[] {
  return blocks.map((block) => {
    const actual = resolveActualTimesForShift(block, entries)
    if (!actual) return sanitizeBlockActualTimes(block)
    if (actual.actualRunning) {
      return sanitizeBlockActualTimes({
        ...block,
        actualStart: actual.actualStart,
        actualEnd: undefined,
        actualPendingApproval: actual.pendingApproval,
        actualRunning: true,
      })
    }
    return sanitizeBlockActualTimes({
      ...block,
      actualStart: actual.actualStart,
      actualEnd: actual.actualEnd,
      actualPendingApproval: actual.pendingApproval,
    })
  })
}

function entryCoveredByShiftBlock(entry: TimeEntry, blocks: ResolvedShiftBlock[]): boolean {
  return blocks.some((b) => b.employeeId === entry.employeeId && overlapsShift(entry, b))
}

/** Ist-only Balken für Arbeit ohne geplanten Dienst (nur echte Stempelungen). */
export function buildIstOnlyBlocksForWeek(
  entries: TimeEntry[],
  weekDates: string[],
  plannedBlocks: ResolvedShiftBlock[],
  employeesById: Map<string, { displayName: string; color?: string }>,
): ResolvedShiftBlock[] {
  const out: ResolvedShiftBlock[] = []
  const seen = new Set<string>()

  for (const dateISO of weekDates) {
    const dayEntries = entries.filter(
      (e) => entryOnDate(e, dateISO) && isRenderableTimeEntry(e),
    )
    for (const e of dayEntries) {
      if (entryCoveredByShiftBlock(e, plannedBlocks)) continue

      const dayIndex = weekDates.indexOf(dateISO)
      if (dayIndex < 0) continue

      const emp = employeesById.get(e.employeeId)

      if (e.status === 'running') {
        const start = entryStartHm(e)
        if (!isValidHm(start)) continue
        const dedupe = `run:${e.employeeId}:${dateISO}:${start}`
        if (seen.has(dedupe)) continue
        seen.add(dedupe)
        out.push({
          id: `ist-run-${e.id}-${dateISO}`,
          employeeId: e.employeeId,
          dayIndex: dayIndex as ResolvedShiftBlock['dayIndex'],
          type: 'regular',
          start,
          end: start,
          workAreaCode: 'Ist',
          dateISO,
          status: 'Veröffentlicht',
          employeeDisplayName: emp?.displayName,
          employeeColor: emp?.color,
          istOnly: true,
          actualStart: start,
          actualRunning: true,
          actualPendingApproval: e.approvalStatus !== 'approved',
        })
        continue
      }

      const startRaw = entryStartHm(e)
      const endRaw = entryEndHm(e)
      if (!isRealHmRange(startRaw, endRaw)) continue
      const start = startRaw
      const end = endRaw!
      const dedupe = `${e.employeeId}:${dateISO}:${start}-${end}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)

      out.push({
        id: `ist-${e.id}-${dateISO}`,
        employeeId: e.employeeId,
        dayIndex: dayIndex as ResolvedShiftBlock['dayIndex'],
        type: 'regular',
        start,
        end,
        workAreaCode: 'Ist',
        dateISO,
        status: 'Veröffentlicht',
        employeeDisplayName: emp?.displayName,
        employeeColor: emp?.color,
        istOnly: true,
        actualStart: start,
        actualEnd: end,
        actualPendingApproval: e.approvalStatus !== 'approved',
      })
    }
  }
  return out
}

export { filterRenderableScheduleBlocks, sanitizeBlockActualTimes, isPlaceholderTimeRange }
