import type { ResolvedShiftBlock } from '../data/mockSchedule'
import type { TimeEntry } from '../types/timeTracking'

function parseHm(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function hmFromIso(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin',
  })
}

function entryOnDate(e: TimeEntry, dateISO: string): boolean {
  const startYmd = e.startAt.slice(0, 10)
  const endYmd = e.endAt?.slice(0, 10) ?? startYmd
  return startYmd <= dateISO && endYmd >= dateISO
}

function overlapsShift(e: TimeEntry, block: ResolvedShiftBlock): boolean {
  if (!e.endAt || e.status === 'running') return false
  if (e.shiftId && e.shiftId === block.id) return true
  const es = parseHm(hmFromIso(e.startAt))
  const ee = parseHm(hmFromIso(e.endAt))
  const ss = parseHm(block.start)
  const se = parseHm(block.end)
  return es < se && ee > ss
}

export type ShiftActualTimes = {
  actualStart: string
  actualEnd: string
  pendingApproval: boolean
}

export function resolveActualTimesForShift(
  block: ResolvedShiftBlock,
  entries: TimeEntry[],
): ShiftActualTimes | null {
  if (!block.employeeId || block.open || block.requirementGap) return null
  const dayEntries = entries.filter(
    (e) =>
      e.employeeId === block.employeeId &&
      entryOnDate(e, block.dateISO) &&
      e.status === 'completed' &&
      e.endAt,
  )
  if (!dayEntries.length) return null

  const matched = dayEntries.filter((e) => overlapsShift(e, block))
  const list = matched.length ? matched : dayEntries

  let start: string | null = null
  let end: string | null = null
  let pendingApproval = false
  for (const e of list) {
    const s = hmFromIso(e.startAt)
    const en = e.endAt ? hmFromIso(e.endAt) : null
    if (s && (!start || s < start)) start = s
    if (en && (!end || en > end)) end = en
    if (e.approvalStatus !== 'approved') pendingApproval = true
  }
  if (!start || !end) return null
  return { actualStart: start, actualEnd: end, pendingApproval }
}

export function enrichBlocksWithActualTimes(
  blocks: ResolvedShiftBlock[],
  entries: TimeEntry[],
): ResolvedShiftBlock[] {
  return blocks.map((block) => {
    const actual = resolveActualTimesForShift(block, entries)
    if (!actual) return block
    return {
      ...block,
      actualStart: actual.actualStart,
      actualEnd: actual.actualEnd,
      actualPendingApproval: actual.pendingApproval,
    }
  })
}

function entryCoveredByShiftBlock(entry: TimeEntry, blocks: ResolvedShiftBlock[]): boolean {
  return blocks.some((b) => b.employeeId === entry.employeeId && overlapsShift(entry, b))
}

/** Ist-only Balken für Arbeit ohne geplanten Dienst (z. B. Vertretung). */
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
      (e) =>
        entryOnDate(e, dateISO) &&
        e.status === 'completed' &&
        e.endAt &&
        e.employeeId,
    )
    for (const e of dayEntries) {
      if (entryCoveredByShiftBlock(e, plannedBlocks)) continue
      const start = hmFromIso(e.startAt)
      const end = e.endAt ? hmFromIso(e.endAt) : null
      if (!start || !end) continue
      const dedupe = `${e.employeeId}:${dateISO}:${start}-${end}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)

      const emp = employeesById.get(e.employeeId)
      const dayIndex = weekDates.indexOf(dateISO)
      if (dayIndex < 0) continue

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
