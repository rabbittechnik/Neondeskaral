import type { Absence } from '../types/absence'
import type { Employee } from '../types/employee'
import { WEEKDAY_IDS } from '../components/employees/planning/planningPreferenceLabels'
import type { ResolvedShiftBlock } from '../data/mockSchedule'
import { formatShiftTimeRangeDE } from './dateFormat'
import { timeToMinutes } from './scheduleTimeline'

export type AssignConflictReport = {
  hard: string[]
  soft: string[]
}

function blockIntervalMinutes(b: Pick<ResolvedShiftBlock, 'start' | 'end'>): { sm: number; em: number } {
  const sm = timeToMinutes(b.start)
  let em = timeToMinutes(b.end)
  if (em <= sm) em += 24 * 60
  return { sm, em }
}

function intervalsOverlap(a: { sm: number; em: number }, b: { sm: number; em: number }): boolean {
  return a.sm < b.em && b.sm < a.em
}

function absenceCoversDate(a: Absence, dateIso: string): boolean {
  if (a.status !== 'genehmigt') return false
  return dateIso >= a.startDate && dateIso <= a.endDate
}

function hoursBetween(start: string, end: string): number {
  const { sm, em } = blockIntervalMinutes({ start, end })
  return (em - sm) / 60
}

/**
 * Konfliktprüfung vor Mitarbeiter-Zuweisung auf eine Schicht.
 * `workAreaId` aus Stammdaten-Schicht (API).
 */
export function evaluateShiftAssignConflicts(params: {
  targetShift: ResolvedShiftBlock
  targetWorkAreaId: string
  newEmployeeId: string
  weekBlocks: ResolvedShiftBlock[]
  employees: Employee[]
  absences: Absence[]
  excludeShiftId: string
}): AssignConflictReport {
  const hard: string[] = []
  const soft: string[] = []
  const emp = params.employees.find((e) => e.id === params.newEmployeeId)
  const dateIso = params.targetShift.dateISO
  const dayIndex = params.targetShift.dayIndex
  const weekdayId = WEEKDAY_IDS[dayIndex]

  if (!emp) {
    hard.push('Mitarbeiter wurde nicht gefunden.')
    return { hard, soft }
  }

  for (const a of params.absences) {
    if (a.employeeId !== params.newEmployeeId) continue
    if (!absenceCoversDate(a, dateIso)) continue
    const t =
      a.type === 'urlaub'
        ? 'Urlaub'
        : a.type === 'krankheit' || a.type === 'kind_krank'
          ? 'Krank'
          : 'Abwesend'
    hard.push(`${emp.displayName} ist an diesem Tag als ${t} markiert (${a.startDate} – ${a.endDate}).`)
    break
  }

  const targetIv = blockIntervalMinutes(params.targetShift)
  const sameDay = params.weekBlocks.filter(
    (b) =>
      b.dateISO === dateIso &&
      b.id !== params.excludeShiftId &&
      b.type !== 'frei' &&
      !b.open &&
      b.employeeId === params.newEmployeeId,
  )
  for (const b of sameDay) {
    const iv = blockIntervalMinutes(b)
    if (intervalsOverlap(targetIv, iv)) {
      hard.push(
        `${emp.displayName} hat an diesem Tag bereits eine Schicht (${formatShiftTimeRangeDE(b.start, b.end)}).`,
      )
      break
    }
  }

  const wa = params.targetWorkAreaId.trim()
  if (wa && !(emp.workAreaIds ?? []).includes(wa)) {
    hard.push(`${emp.displayName} ist diesem Arbeitsbereich nicht zugeordnet.`)
  }

  if (weekdayId && (emp.notPreferredWorkDays ?? []).includes(weekdayId)) {
    soft.push('Nicht bevorzugter Arbeitstag laut Mitarbeiterprofil.')
  }

  if ((dayIndex === 5 || dayIndex === 6) && emp.canWorkWeekends === false) {
    soft.push('Mitarbeiter hat „Wochenende möglich“ deaktiviert.')
  }

  const plannedHoursOthers = params.weekBlocks
    .filter((b) => b.employeeId === params.newEmployeeId && b.type !== 'frei' && !b.open && b.id !== params.excludeShiftId)
    .reduce((s, b) => s + hoursBetween(b.start, b.end), 0)
  const targetH = hoursBetween(params.targetShift.start, params.targetShift.end)
  const totalWeek = plannedHoursOthers + targetH
  const maxW = emp.maxWeeklyHours
  if (typeof maxW === 'number' && maxW > 0 && totalWeek > maxW + 1e-6) {
    soft.push(`Wochenstunden würden überschritten (ca. ${totalWeek.toFixed(2)} h / max. ${maxW} h).`)
  }

  const targetHWeekly = emp.weeklyHours
  if (typeof targetHWeekly === 'number' && targetHWeekly > 0 && totalWeek > targetHWeekly + 0.5) {
    soft.push(`Geplante Wochenstunden liegen über dem Soll (${targetHWeekly} h/Woche).`)
  }

  return { hard, soft }
}
