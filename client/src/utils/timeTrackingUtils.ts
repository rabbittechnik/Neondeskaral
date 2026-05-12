import type { Employee } from '../types/employee'
import type { ScheduleShift } from '../data/mockSchedule'
import type { ShiftCloseChecklist, TimeEntry } from '../types/timeTracking'
import { toISODateLocal } from './taskUtils'

export function findEmployeeByCashRegisterCardNumber(
  employees: Employee[],
  raw: string,
): Employee | undefined {
  const n = raw.trim()
  if (!n) return undefined
  return employees.find(
    (e) => e.terminalEnabled && e.timeTrackingEnabled && e.cashRegisterCardNumber === n,
  )
}

export function getRunningTimeEntryForEmployee(entries: TimeEntry[], employeeId: string): TimeEntry | undefined {
  return entries.find((e) => e.employeeId === employeeId && e.status === 'running')
}

export function getTodayTimeEntries(entries: TimeEntry[], dateIso: string): TimeEntry[] {
  return entries.filter((e) => e.startAt.slice(0, 10) === dateIso)
}

export function getTimeEntriesForEmployee(entries: TimeEntry[], employeeId: string): TimeEntry[] {
  return entries.filter((e) => e.employeeId === employeeId).sort((a, b) => (a.startAt < b.startAt ? 1 : -1))
}

export function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function calculateWorkedMinutes(startAt: string, endAt: string | undefined, now: Date = new Date()): number {
  const s = new Date(startAt).getTime()
  const e = endAt ? new Date(endAt).getTime() : now.getTime()
  return Math.max(0, Math.round((e - s) / 60000))
}

export function formatWorkedDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h} Std. ${m} Min.`
}

export function getPlannedShiftForEmployeeToday(
  shifts: ScheduleShift[],
  employeeId: string,
  todayIso: string,
): ScheduleShift | null {
  const list = shifts.filter(
    (s) =>
      s.employeeId === employeeId &&
      s.date === todayIso &&
      s.shiftType !== 'frei' &&
      Boolean(s.startTime) &&
      Boolean(s.endTime),
  )
  if (list.length === 0) return null
  list.sort((a, b) => parseHHMM(a.startTime) - parseHHMM(b.startTime))
  return list[0] ?? null
}

export type CheckInEvaluation =
  | { kind: 'unknown_card' }
  | { kind: 'already_checked_in'; employee: Employee; entry: TimeEntry }
  | { kind: 'not_scheduled'; employee: Employee }
  | { kind: 'too_early'; employee: Employee; minutesEarly: number; plannedStart: string }
  | { kind: 'too_late'; employee: Employee; minutesLate: number; planned: ScheduleShift }
  | { kind: 'ready'; employee: Employee; planned: ScheduleShift | null }

export function evaluateCheckIn(
  cardNumber: string,
  employees: Employee[],
  shifts: ScheduleShift[],
  entries: TimeEntry[],
  now: Date = new Date(),
): CheckInEvaluation {
  const emp = findEmployeeByCashRegisterCardNumber(employees, cardNumber)
  if (!emp) return { kind: 'unknown_card' }

  const running = getRunningTimeEntryForEmployee(entries, emp.id)
  if (running) return { kind: 'already_checked_in', employee: emp, entry: running }

  const today = toISODateLocal(now)
  const planned = getPlannedShiftForEmployeeToday(shifts, emp.id, today)
  if (!planned) return { kind: 'not_scheduled', employee: emp }

  const nowM = now.getHours() * 60 + now.getMinutes()
  const startM = parseHHMM(planned.startTime)
  if (nowM < startM) {
    return { kind: 'too_early', employee: emp, minutesEarly: startM - nowM, plannedStart: planned.startTime }
  }
  if (nowM > startM) {
    return { kind: 'too_late', employee: emp, minutesLate: nowM - startM, planned }
  }
  return { kind: 'ready', employee: emp, planned }
}

export type CheckOutEvaluation =
  | { kind: 'unknown_card' }
  | { kind: 'not_checked_in'; employee: Employee }
  | { kind: 'ready'; employee: Employee; entry: TimeEntry }

export function evaluateCheckOut(
  cardNumber: string,
  employees: Employee[],
  entries: TimeEntry[],
): CheckOutEvaluation {
  const emp = findEmployeeByCashRegisterCardNumber(employees, cardNumber)
  if (!emp) return { kind: 'unknown_card' }
  const running = getRunningTimeEntryForEmployee(entries, emp.id)
  if (!running) return { kind: 'not_checked_in', employee: emp }
  return { kind: 'ready', employee: emp, entry: running }
}

export function allChecklistItemsDone(
  c: Omit<ShiftCloseChecklist, 'id' | 'timeEntryId' | 'employeeId' | 'completedAt' | 'incidentNote'> & {
    incidentNote?: string
  },
): boolean {
  return (
    c.fridgeFronted &&
    c.drinksFilled &&
    c.cigarettesFilled &&
    c.shelvesFilled &&
    c.trashEmptied &&
    c.counterClean &&
    c.coffeeAreaClean &&
    c.outsideChecked &&
    c.incidentsNoted &&
    c.handoverPossible &&
    c.closingReady
  )
}

export function mergeChecklistDraft(
  draft: Partial<ShiftCloseChecklist> & { incidentNote?: string },
  timeEntryId: string,
  employeeId: string,
  checklistId: string,
  completedAt: string,
): ShiftCloseChecklist {
  return {
    id: checklistId,
    timeEntryId,
    employeeId,
    fridgeFronted: Boolean(draft.fridgeFronted),
    drinksFilled: Boolean(draft.drinksFilled),
    cigarettesFilled: Boolean(draft.cigarettesFilled),
    shelvesFilled: Boolean(draft.shelvesFilled),
    trashEmptied: Boolean(draft.trashEmptied),
    counterClean: Boolean(draft.counterClean),
    coffeeAreaClean: Boolean(draft.coffeeAreaClean),
    outsideChecked: Boolean(draft.outsideChecked),
    incidentsNoted: Boolean(draft.incidentsNoted),
    handoverPossible: Boolean(draft.handoverPossible),
    closingReady: Boolean(draft.closingReady),
    everythingOk: Boolean(draft.everythingOk),
    incidentNote: draft.incidentNote?.trim() ?? '',
    completedAt,
  }
}

export type AttendanceStatus =
  | 'geplant'
  | 'anwesend'
  | 'läuft'
  | 'nicht_eingestempelt'
  | 'zu_spaet'
  | 'zu_frueh'
  | 'beendet'
  | 'kommt_danach'

export type ShiftSnapshotRow = {
  employeeId: string
  displayName: string
  plannedLabel: string
  actualStartLabel: string | null
  runningDurationLabel: string | null
  status: AttendanceStatus
  statusDetail: string
}

export function buildShiftSnapshotRows(
  employees: Employee[],
  shifts: ScheduleShift[],
  entries: TimeEntry[],
  now: Date = new Date(),
): ShiftSnapshotRow[] {
  const today = toISODateLocal(now)
  const nowM = now.getHours() * 60 + now.getMinutes()

  const dayShifts = shifts.filter(
    (s) => s.date === today && s.shiftType !== 'frei' && s.employeeId && s.startTime && s.endTime,
  )
  const byEmp = new Map<string, ScheduleShift[]>()
  for (const s of dayShifts) {
    const id = s.employeeId!
    if (!byEmp.has(id)) byEmp.set(id, [])
    byEmp.get(id)!.push(s)
  }
  for (const arr of byEmp.values()) {
    arr.sort((a, b) => parseHHMM(a.startTime) - parseHHMM(b.startTime))
  }

  const empIds = new Set<string>([...byEmp.keys()])
  for (const e of entries) {
    if (e.status === 'running' && e.startAt.slice(0, 10) === today) empIds.add(e.employeeId)
  }

  const rows: ShiftSnapshotRow[] = []
  for (const id of empIds) {
    const emp = employees.find((x) => x.id === id)
    if (!emp) continue
    const planned = byEmp.get(id)?.[0] ?? null
    const running = getRunningTimeEntryForEmployee(entries, id)
    const completedToday = entries.filter(
      (e) => e.employeeId === id && e.status === 'completed' && e.startAt.slice(0, 10) === today,
    )
    const doneToday = completedToday.sort((a, b) => (a.endAt ?? '') < (b.endAt ?? '') ? 1 : -1)[0]

    let status: AttendanceStatus = 'geplant'
    let statusDetail = ''
    let actualStart: string | null = null
    let runningDur: string | null = null

    if (running) {
      status = 'läuft'
      actualStart = new Date(running.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      const mins = calculateWorkedMinutes(running.startAt, undefined, now)
      runningDur = formatWorkedDuration(mins)
      statusDetail = 'Eingestempelt'
    } else if (doneToday && !running) {
      status = 'beendet'
      actualStart = new Date(doneToday.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      const mins = calculateWorkedMinutes(doneToday.startAt, doneToday.endAt, now)
      runningDur = formatWorkedDuration(mins)
      statusDetail = 'Schicht beendet'
    } else if (planned) {
      const ps = parseHHMM(planned.startTime)
      const pe = parseHHMM(planned.endTime)
      if (nowM < ps) {
        status = 'geplant'
        statusDetail = `Start um ${planned.startTime} Uhr`
      } else if (nowM >= ps && nowM <= pe) {
        status = 'nicht_eingestempelt'
        statusDetail = 'Noch nicht eingestempelt'
      } else {
        status = 'zu_spaet'
        statusDetail = 'Schichtfenster vorbei / nicht eingestempelt'
      }
    } else {
      status = 'anwesend'
      statusDetail = 'Kein Plan-Eintrag heute'
    }

    rows.push({
      employeeId: id,
      displayName: emp.displayName,
      plannedLabel: planned ? `${planned.startTime}–${planned.endTime}` : '—',
      actualStartLabel: actualStart,
      runningDurationLabel: runningDur,
      status,
      statusDetail,
    })
  }

  rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
  return rows
}

export type UpcomingRow = {
  employeeId: string
  displayName: string
  detail: string
  startTime: string
  minutesUntil: number
  presence: 'bereits_anwesend' | 'geplant'
}

export function buildUpcomingShiftRows(
  employees: Employee[],
  shifts: ScheduleShift[],
  entries: TimeEntry[],
  now: Date = new Date(),
  limit = 5,
): UpcomingRow[] {
  const today = toISODateLocal(now)
  const nowM = now.getHours() * 60 + now.getMinutes()
  const cand: UpcomingRow[] = []

  for (const s of shifts) {
    if (s.date !== today || !s.employeeId || s.shiftType === 'frei' || !s.startTime) continue
    const sm = parseHHMM(s.startTime)
    if (sm <= nowM) continue
    const emp = employees.find((e) => e.id === s.employeeId)
    if (!emp) continue
    const running = getRunningTimeEntryForEmployee(entries, s.employeeId)
    cand.push({
      employeeId: s.employeeId,
      displayName: emp.displayName,
      detail: `${s.startTime}–${s.endTime}`,
      startTime: s.startTime,
      minutesUntil: sm - nowM,
      presence: running ? 'bereits_anwesend' : 'geplant',
    })
  }
  cand.sort((a, b) => a.minutesUntil - b.minutesUntil)
  return cand.slice(0, limit)
}

export function formatMinutesCountdown(m: number): string {
  if (m < 60) return `in ${m} Min.`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `in ${h} Std. ${r} Min.` : `in ${h} Std.`
}

/** Alias gemäß Spezifikation */
export const handleEmployeeCheckIn = evaluateCheckIn
export const handleEmployeeCheckOutStart = evaluateCheckOut

/** Spätere Lohn-/Auswertung: nur freigegebene, abgeschlossene Einträge. */
export function isPayrollRelevantTimeEntry(e: TimeEntry): boolean {
  return e.status === 'completed' && e.approvalStatus === 'approved' && e.payrollRelevant === true
}

export function closeTimeEntryWithChecklist(
  entries: TimeEntry[],
  checklists: ShiftCloseChecklist[],
  timeEntryId: string,
  checklist: ShiftCloseChecklist,
  endAtIso: string,
  endedBy: string,
): { entries: TimeEntry[]; checklists: ShiftCloseChecklist[] } {
  const nextEntries = entries.map((e) =>
    e.id === timeEntryId
      ? {
          ...e,
          endAt: endAtIso,
          status: 'completed' as const,
          endedBy,
          updatedAt: endAtIso,
        }
      : e,
  )
  const filtered = checklists.filter((c) => c.timeEntryId !== timeEntryId)
  return { entries: nextEntries, checklists: [...filtered, checklist] }
}
