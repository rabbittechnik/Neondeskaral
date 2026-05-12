import type { ScheduleShift, ShiftTypeId } from '../../../data/mockSchedule'

export type ShiftDraft = {
  id?: string
  employeeId?: string
  workAreaId: string
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  shiftType: ShiftTypeId
  note: string
  status: 'Entwurf' | 'Veröffentlicht'
  conflict?: boolean
}

function parseTime(t: string): number | null {
  const s = t.trim()
  if (!s) return null
  const [h, m] = s.split(':').map((x) => Number(x))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/** Gleicher Kalendertag: Endzeit nach Mitternacht zählt als „nächster Tag“. */
function endMinutesRelative(start: number, end: number, overnight: boolean): number {
  if (!overnight) return end
  if (end <= start) return end + 24 * 60
  return end
}

/** Pflichtfelder — blockieren Speichern bis behoben. */
export function validateRequiredFields(d: ShiftDraft): string[] {
  const err: string[] = []
  if (!d.date?.trim()) err.push('Datum fehlt.')
  if (!d.shiftType) err.push('Schichttyp fehlt.')
  if (d.shiftType !== 'frei') {
    if (!d.startTime?.trim()) err.push('Startzeit fehlt.')
    if (!d.endTime?.trim()) err.push('Endzeit fehlt.')
  }
  if (d.shiftType !== 'frei' && !d.workAreaId?.trim()) {
    err.push('Arbeitsbereich fehlt.')
  }
  return err
}

/** Konflikte / Hinweise — Speichern mit „Trotzdem speichern“ möglich. */
export function collectShiftWarnings(
  d: ShiftDraft,
  allShifts: ScheduleShift[],
  getEmployeeDisplayName: (id: string) => string,
): string[] {
  const warnings: string[] = []
  const id = d.id

  if (!d.employeeId?.trim()) {
    warnings.push('Kein Mitarbeiter — wird als offene Schicht (Unbesetzt) geführt.')
  }

  if (d.shiftType === 'frei') return warnings

  const sm = parseTime(d.startTime)
  const em = parseTime(d.endTime)
  if (sm === null || em === null) return warnings

  const overnight = d.shiftType === 'nacht'
  const endRel = endMinutesRelative(sm, em, overnight)

  if (!overnight && endRel <= sm) {
    warnings.push('Startzeit liegt nach der Endzeit (keine Nachtschicht).')
  }

  if (d.employeeId?.trim()) {
    const sameDay = allShifts.filter(
      (s) =>
        s.date === d.date &&
        s.employeeId === d.employeeId &&
        s.id !== id &&
        s.shiftType !== 'frei',
    )
    if (sameDay.length > 0) {
      const name = getEmployeeDisplayName(d.employeeId!)
      warnings.push(
        `${name} hat an diesem Tag bereits eine andere Schicht im Plan.`,
      )
    }
  }

  return warnings
}
