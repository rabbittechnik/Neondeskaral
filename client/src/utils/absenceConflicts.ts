import type { Absence, VacationBlock } from '../types/absence'
import type { Employee } from '../types/employee'
import type { ScheduleShift } from '../data/mockSchedule'
import { dateInInclusiveRange } from './absenceQueries'
import { getRelevantHolidayForState } from './holidayUtils'
import type { GermanState } from '../data/germanHolidays'
import { STATION_FEDERAL_STATE } from '../data/station'

export type AbsenceConflictWarning = {
  id: string
  message: string
}

function eachDateInRange(start: string, end: string): string[] {
  const out: string[] = []
  const cur = new Date(`${start}T12:00:00`)
  const last = new Date(`${end}T12:00:00`)
  while (cur.getTime() <= last.getTime()) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export type AbsenceConflictContext = {
  absences: Absence[]
  vacationBlocks: VacationBlock[]
  shifts: ScheduleShift[]
  employees: Employee[]
  federalState?: GermanState
  excludeAbsenceId?: string
}

export function checkAbsenceConflicts(
  draft: Pick<Absence, 'employeeId' | 'startDate' | 'endDate' | 'type'>,
  ctx: AbsenceConflictContext,
): AbsenceConflictWarning[] {
  const warnings: AbsenceConflictWarning[] = []
  const state = ctx.federalState ?? STATION_FEDERAL_STATE
  const emp = ctx.employees.find((e) => e.id === draft.employeeId)

  if (!emp || draft.startDate > draft.endDate) return warnings

  const dates = eachDateInRange(draft.startDate, draft.endDate)

  for (const d of dates) {
    const shiftsDay = ctx.shifts.filter((s) => s.date === d && s.employeeId === draft.employeeId)
    const realShifts = shiftsDay.filter((s) => s.shiftType !== 'frei')
    if (realShifts.length > 0) {
      warnings.push({
        id: `shift-${d}`,
        message: `Am ${d} sind Schichten für diesen Mitarbeiter geplant (${realShifts.length} Eintrag/Einträge).`,
      })
      break
    }
  }

  for (const vb of ctx.vacationBlocks) {
    if (!vb.active) continue
    if (draft.type !== 'paid_vacation') continue
    const overlap = draft.startDate <= vb.endDate && draft.endDate >= vb.startDate
    if (!overlap) continue
    const blockAreas = vb.workAreaIds ?? []
    const blockApplies = blockAreas.length === 0 || emp.workAreaIds.some((wid) => blockAreas.includes(wid))
    if (blockApplies) {
      warnings.push({
        id: `vb-${vb.id}`,
        message: `Für diesen Zeitraum ist eine Urlaubssperre aktiv („${vb.title}“, ${vb.startDate} – ${vb.endDate}).`,
      })
      break
    }
  }

  let holidayStrong = false
  for (const d of dates) {
    const { relevantHolidays } = getRelevantHolidayForState(d, state)
    if (relevantHolidays.length > 0) {
      warnings.push({
        id: `holiday-${d}`,
        message: `Im Zeitraum liegt ein Feiertag: ${relevantHolidays.map((h) => h.name).join(', ')} (${d}).`,
      })
      holidayStrong = true
      break
    }
  }
  if (!holidayStrong) {
    for (const d of dates) {
      const { otherStateHolidays } = getRelevantHolidayForState(d, state)
      if (otherStateHolidays.length > 0) {
        warnings.push({
          id: `holiday-other-${d}`,
          message: `Hinweis: Am ${d} Feiertag in anderen Bundesländern (${otherStateHolidays.map((h) => h.name).join(', ')}).`,
        })
        break
      }
    }
  }

  const otherAbs = ctx.absences.filter(
    (a) =>
      a.id !== ctx.excludeAbsenceId &&
      a.employeeId === draft.employeeId &&
      a.status !== 'storniert' &&
      a.status !== 'abgelehnt' &&
      draft.startDate <= a.endDate &&
      draft.endDate >= a.startDate,
  )
  if (otherAbs.length > 0) {
    warnings.push({
      id: 'overlap-self',
      message: `Überschneidung mit vorhandener Abwesenheit (${otherAbs.length}).`,
    })
  }

  for (const d of dates) {
    for (const wid of emp.workAreaIds) {
      const ids = new Set<string>()
      for (const a of ctx.absences) {
        if (a.id === ctx.excludeAbsenceId) continue
        if (!(a.status === 'genehmigt' || a.status === 'beantragt')) continue
        if (!dateInInclusiveRange(d, a.startDate, a.endDate)) continue
        const e2 = ctx.employees.find((e) => e.id === a.employeeId)
        if (e2?.workAreaIds.includes(wid)) ids.add(a.employeeId)
      }
      ids.add(draft.employeeId)
      if (ids.size >= 2) {
        warnings.push({
          id: `team-${d}-${wid}`,
          message: `Am ${d} sind mehrere Mitarbeiter im gleichen Arbeitsbereich gleichzeitig abwesend (Deckung prüfen).`,
        })
        break
      }
    }
    if (warnings.some((w) => w.id.startsWith('team-'))) break
  }

  const seen = new Set<string>()
  return warnings.filter((w) => {
    if (seen.has(w.message)) return false
    seen.add(w.message)
    return true
  })
}
