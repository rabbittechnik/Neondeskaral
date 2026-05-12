import type { TimeEntry } from '../../types/timeTracking'

export type PubShiftLite = {
  id: string
  date: string
  startTime: string
  endTime: string
  workAreaId?: string
}

export function combineShiftStart(ymd: string, hm: string): Date {
  const [y, mo, d] = ymd.split('-').map(Number)
  const parts = (hm || '0:0').split(':').map((x) => parseInt(x, 10))
  const hh = parts[0] ?? 0
  const mm = parts[1] ?? 0
  return new Date(y, mo - 1, d, hh, mm, 0, 0)
}

export function combineShiftEnd(ymd: string, endHm: string, startHm: string): Date {
  const end = combineShiftStart(ymd, endHm)
  const start = combineShiftStart(ymd, startHm)
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1)
  }
  return end
}

export function findNextFutureShift(shifts: PubShiftLite[], now: Date = new Date()): PubShiftLite | undefined {
  return findNextFutureShifts(shifts, now, 1)[0]
}

export function findNextFutureShifts(shifts: PubShiftLite[], now: Date, limit: number): PubShiftLite[] {
  const sorted = [...shifts].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  return sorted
    .filter((s) => {
      if (!s.startTime) return false
      return combineShiftStart(s.date, s.startTime).getTime() > now.getTime()
    })
    .slice(0, Math.max(0, limit))
}

export type TodayEmployeeStatus =
  | { variant: 'running'; shift: PubShiftLite; running: TimeEntry }
  | { variant: 'upcoming'; shift: PubShiftLite }
  | { variant: 'during_no_clock'; shift: PubShiftLite }
  | { variant: 'past_completed'; shift: PubShiftLite; entry: TimeEntry }
  | { variant: 'past_no_time'; shift: PubShiftLite }
  | { variant: 'no_shift' }

export function computeTodayEmployeeStatus(
  shiftsMine: PubShiftLite[],
  todayYmd: string,
  now: Date,
  running: TimeEntry | undefined,
  timeEntries: TimeEntry[],
  employeeId: string,
): TodayEmployeeStatus {
  if (running) {
    const byShift = running.shiftId ? shiftsMine.find((s) => s.id === running.shiftId) : undefined
    const byDate = shiftsMine.find((s) => s.date === todayYmd && s.startTime && s.endTime)
    const shift = byShift ?? byDate ?? {
      id: running.shiftId ?? '',
      date: todayYmd,
      startTime: (running.startAt ?? '').slice(11, 16),
      endTime: '',
    }
    return { variant: 'running', shift, running }
  }

  const todayShifts = shiftsMine
    .filter((s) => s.date === todayYmd && s.startTime && s.endTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  if (!todayShifts.length) return { variant: 'no_shift' }

  const stillOngoingOrFuture = todayShifts.filter(
    (s) => combineShiftEnd(s.date, s.endTime, s.startTime).getTime() > now.getTime(),
  )

  if (stillOngoingOrFuture.length) {
    const focus = stillOngoingOrFuture[0]!
    const start = combineShiftStart(focus.date, focus.startTime)
    const end = combineShiftEnd(focus.date, focus.endTime, focus.startTime)
    if (now.getTime() < start.getTime()) return { variant: 'upcoming', shift: focus }
    if (now.getTime() <= end.getTime()) return { variant: 'during_no_clock', shift: focus }
  }

  const last = todayShifts[todayShifts.length - 1]!
  const myTodayEntries = timeEntries
    .filter((e) => e.employeeId === employeeId && e.status === 'completed' && (e.startAt ?? '').slice(0, 10) === todayYmd)
    .sort((a, b) => String(b.endAt ?? b.startAt).localeCompare(String(a.endAt ?? a.startAt)))
  const best = myTodayEntries[0]
  if (best) return { variant: 'past_completed', shift: last, entry: best }
  return { variant: 'past_no_time', shift: last }
}
