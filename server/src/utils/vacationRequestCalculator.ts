import type { GermanState } from '../data/germanHolidays2026.js'
import { GERMAN_HOLIDAYS_2026, holidayAppliesToState } from '../data/germanHolidays2026.js'
import {
  countAbsenceSpanDaysCalendar,
  defaultPaidHoursPerDayFromEmployee,
  normalizeAbsenceDbType,
} from './vacationImpactCalculator.js'

export type VacationRequestCalcInput = {
  employmentType: string
  employmentRole: string
  federalState: string
  vacationHoursPerDay: number | null | undefined
  startDate: string
  endDate: string
  halfDay: boolean
  absenceTypeRaw: string
}

export type VacationRequestCalcResult = {
  calendarDays: number
  workingDays: number
  holidaysExcluded: number
  holidayDetails: { date: string; name: string }[]
  vacationDaysToDeduct: number
  paidHoursPerDay: number
  paidHours: number
  warnings: string[]
}

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null
  return dt
}

function ymdFromDateLocal(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** Vollzeit/Teilzeit/Schichtleitung/Stationsleitung/Chef: Feiertage zählen nicht gegen Urlaubskonto. */
export function isStableEmploymentForHolidayExclusion(employmentType: string, employmentRole: string): boolean {
  const t = String(employmentType ?? '')
    .trim()
    .toLowerCase()
  if (t === 'aushilfe' || t === 'minijob' || t === 'schueler' || t === 'werkstudent' || t === 'sonstige') return false
  if (t === 'vollzeit' || t === 'teilzeit') return true
  const role = String(employmentRole ?? '')
    .trim()
    .toLowerCase()
  if (
    role.includes('schichtleiter') ||
    role.includes('stationsleiter') ||
    role.includes('teamleiter') ||
    role.includes('chef') ||
    role.includes('administrator')
  ) {
    return true
  }
  return false
}

function holidaysInRangeForState(
  startDate: string,
  endDate: string,
  stateRaw: string,
): { list: { date: string; name: string }[]; yearWarning?: string } {
  const warnings: string[] = []
  const state = (String(stateRaw ?? 'BW').trim().toUpperCase().slice(0, 2) || 'BW') as GermanState
  const s0 = parseYmdLocal(startDate)
  const e0 = parseYmdLocal(endDate)
  if (!s0 || !e0 || e0.getTime() < s0.getTime()) return { list: [] }

  const yStart = s0.getFullYear()
  const yEnd = e0.getFullYear()
  if (yStart !== 2026 || yEnd !== 2026) {
    warnings.push(
      yStart !== yEnd
        ? 'Feiertagskorrektur ist derzeit nur für das Jahr 2026 hinterlegt; außerhalb 2026 werden keine gesetzlichen Feiertage automatisch abgezogen.'
        : `Feiertagskorrektur ist derzeit nur für 2026 hinterlegt (${yStart}).`,
    )
  }

  const out: { date: string; name: string }[] = []
  for (const h of GERMAN_HOLIDAYS_2026) {
    if (!holidayAppliesToState(h, state)) continue
    const hd = parseYmdLocal(h.date)
    if (!hd) continue
    if (hd.getTime() < s0.getTime() || hd.getTime() > e0.getTime()) continue
    out.push({ date: h.date, name: h.name })
  }
  out.sort((a, b) => a.date.localeCompare(b.date))
  return { list: out, yearWarning: warnings[0] }
}

/**
 * Vorschau für Urlaubsantrag: Kalendertage, abziehbare Urlaubstage (Feiertage optional), bezahlte Stunden.
 * Sonderurlaub / Sonstiges / Frei / unbezahlt: kein automatischer Abzug vom Urlaubskonto.
 */
export function calculateVacationDaysForRequest(p: VacationRequestCalcInput): VacationRequestCalcResult {
  const warnings: string[] = []
  const type = normalizeAbsenceDbType(p.absenceTypeRaw)
  const calendarDays = countAbsenceSpanDaysCalendar(p.startDate, p.endDate, p.halfDay)

  const s0 = parseYmdLocal(p.startDate)
  const e0 = parseYmdLocal(p.endDate)
  let workingDays = calendarDays
  if (s0 && e0 && e0.getTime() >= s0.getTime()) {
    let n = 0
    for (let d = new Date(s0.getTime()); d.getTime() <= e0.getTime(); d.setDate(d.getDate() + 1)) {
      n += 1
    }
    workingDays = n
  }

  if (type !== 'paid_vacation') {
    return {
      calendarDays,
      workingDays,
      holidaysExcluded: 0,
      holidayDetails: [],
      vacationDaysToDeduct: 0,
      paidHoursPerDay: 0,
      paidHours: 0,
      warnings,
    }
  }

  const fest = isStableEmploymentForHolidayExclusion(p.employmentType, p.employmentRole)
  const { list: holidayDetails, yearWarning } = holidaysInRangeForState(p.startDate, p.endDate, p.federalState)
  if (yearWarning) warnings.push(yearWarning)

  let holidaysExcluded = 0
  if (fest && holidayDetails.length > 0 && s0 && e0) {
    const holidaySet = new Set(holidayDetails.map((h) => h.date))
    for (const hd of holidaySet) {
      const hx = parseYmdLocal(hd)
      if (!hx) continue
      if (hx.getTime() < s0.getTime() || hx.getTime() > e0.getTime()) continue
      holidaysExcluded += 1
    }
  }

  let vacationDaysToDeduct = Math.max(0, Math.round((calendarDays - (fest ? holidaysExcluded : 0)) * 100) / 100)

  if (fest && holidaysExcluded > 0) {
    for (const h of holidayDetails) {
      warnings.push(`${h.name} (${h.date.slice(8, 10)}.${h.date.slice(5, 7)}.${h.date.slice(0, 4)}) wird nicht vom Urlaubskontingent abgezogen.`)
    }
  }

  const paidHoursPerDay = defaultPaidHoursPerDayFromEmployee(p.vacationHoursPerDay)
  const paidHours = Math.round(vacationDaysToDeduct * paidHoursPerDay * 100) / 100

  return {
    calendarDays,
    workingDays,
    holidaysExcluded: fest ? holidaysExcluded : 0,
    holidayDetails: fest ? holidayDetails : [],
    vacationDaysToDeduct,
    paidHoursPerDay,
    paidHours,
    warnings,
  }
}

/** Iteriert alle Kalendertage im inklusiven Bereich (YYYY-MM-DD). */
export function eachYmdInInclusiveRange(startDate: string, endDate: string): string[] {
  const s0 = parseYmdLocal(startDate)
  const e0 = parseYmdLocal(endDate)
  if (!s0 || !e0 || e0.getTime() < s0.getTime()) return []
  const out: string[] = []
  for (let d = new Date(s0.getTime()); d.getTime() <= e0.getTime(); d.setDate(d.getDate() + 1)) {
    out.push(ymdFromDateLocal(d))
  }
  return out
}
