/**
 * Standard-Schichtbedarf (konfigurierbar pro Station, aktuell Aral Bodelshausen).
 * Nur Früh/Spät als Pflicht — keine Nacht- oder Schulungs-Sollschicht.
 */

import type { GermanState } from './germanHolidays'
import type { DayRequirement, DayRequirementSlot } from '../types/scheduleAssistant'
import { getRelevantHolidayForState } from '../utils/holidayUtils'
import type { ScheduleShift } from './mockSchedule'
import { toISODate } from './mockSchedule'

/** Stationen mit Feiertags-Sonderlogik (Früh: 07:30 oder 08:30). */
export const DEFAULT_SHIFT_REQUIREMENTS_STATION_IDS = ['aral-bodelshausen'] as const

export type RequiredShiftType = 'early' | 'late'

export type TimeRange = { startTime: string; endTime: string }

export type DefaultRequirementSlot = {
  id: string
  shiftType: RequiredShiftType
  label: string
  /** Anzeige bei fehlender Besetzung (Hauptzeitraum) */
  displayRange: TimeRange
  /** Eine dieser Zeiträume erfüllt die Anforderung (ODER), jeweils mit ±15-Min-Toleranz Start/Ende. */
  acceptedRanges: TimeRange[]
  /** Zusatztext (z. B. Feiertag-Früh mit zwei Varianten) */
  detailHint?: string
}

export type MissingRequiredShift = {
  date: string
  shiftType: RequiredShiftType
  label: string
  startTime: string
  endTime: string
  detailHint?: string
}

export type OpenShiftWeekSummary = {
  totalMissingRequired: number
  earlyMissing: number
  lateMissing: number
  missingRequiredFlat: MissingRequiredShift[]
  missingByDay: { date: string; items: MissingRequiredShift[] }[]
  openDbShifts: ScheduleShift[]
  totalOpenDb: number
  /** Summe: offene DB-Zeilen in der Woche + fehlende Soll-Besetzung (ohne Deduplizierung). */
  totalCount: number
  summaryLine: string
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

function isoWeekdayKey(dateIso: string) {
  const d = new Date(`${dateIso}T12:00:00`)
  const i = d.getDay()
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
  return map[i]
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function withinTolerance(a: string, b: string, tolMin: number): boolean {
  return Math.abs(timeToMinutes(a) - timeToMinutes(b)) <= tolMin
}

export function stationUsesDefaultShiftRequirements(stationId: string): boolean {
  return (DEFAULT_SHIFT_REQUIREMENTS_STATION_IDS as readonly string[]).includes(stationId)
}

/** Werktag / Wochenende ohne Feiertags-Override (für alle Stationen). */
function slotsForCalendarWeekday(date: string): DefaultRequirementSlot[] {
  const wd = isoWeekdayKey(date)
  if (wd === 'saturday') {
    return [
      {
        id: 'sat-early',
        shiftType: 'early',
        label: 'Frühschicht',
        displayRange: { startTime: '06:30', endTime: '14:00' },
        acceptedRanges: [{ startTime: '06:30', endTime: '14:00' }],
      },
      {
        id: 'sat-late',
        shiftType: 'late',
        label: 'Spätschicht',
        displayRange: { startTime: '14:00', endTime: '20:15' },
        acceptedRanges: [{ startTime: '14:00', endTime: '20:15' }],
      },
    ]
  }
  if (wd === 'sunday') {
    return [
      {
        id: 'sun-early',
        shiftType: 'early',
        label: 'Frühschicht',
        displayRange: { startTime: '07:30', endTime: '14:00' },
        acceptedRanges: [{ startTime: '07:30', endTime: '14:00' }],
      },
      {
        id: 'sun-late',
        shiftType: 'late',
        label: 'Spätschicht',
        displayRange: { startTime: '14:00', endTime: '20:15' },
        acceptedRanges: [{ startTime: '14:00', endTime: '20:15' }],
      },
    ]
  }
  return [
    {
      id: 'wd-early',
      shiftType: 'early',
      label: 'Frühschicht',
      displayRange: { startTime: '05:30', endTime: '14:00' },
      acceptedRanges: [{ startTime: '05:30', endTime: '14:00' }],
    },
    {
      id: 'wd-late',
      shiftType: 'late',
      label: 'Spätschicht',
      displayRange: { startTime: '14:00', endTime: '21:15' },
      acceptedRanges: [{ startTime: '14:00', endTime: '21:15' }],
    },
  ]
}

function slotsForConfiguredHoliday(): DefaultRequirementSlot[] {
  return [
    {
      id: 'holiday-early',
      shiftType: 'early',
      label: 'Frühschicht',
      displayRange: { startTime: '07:30', endTime: '14:00' },
      acceptedRanges: [
        { startTime: '07:30', endTime: '14:00' },
        { startTime: '08:30', endTime: '14:00' },
      ],
      detailHint: '07:30–14:00 Uhr oder 08:30–14:00 Uhr',
    },
    {
      id: 'holiday-late',
      shiftType: 'late',
      label: 'Spätschicht',
      displayRange: { startTime: '14:00', endTime: '20:15' },
      acceptedRanges: [{ startTime: '14:00', endTime: '20:15' }],
    },
  ]
}

/**
 * Soll-Schichten für ein Kalenderdatum (Früh/Spät).
 * Feiertags-Sonderlogik nur für `DEFAULT_SHIFT_REQUIREMENTS_STATION_IDS` + relevantes Bundesland.
 */
export function getDefaultShiftRequirementsForDate(
  date: string,
  stationId: string,
  federalState: GermanState,
): DefaultRequirementSlot[] {
  if (stationUsesDefaultShiftRequirements(stationId)) {
    const { hasHoliday } = getRelevantHolidayForState(date, federalState)
    if (hasHoliday) return slotsForConfiguredHoliday()
  }
  return slotsForCalendarWeekday(date)
}

function assignedShiftCoversRange(shift: ScheduleShift, range: TimeRange, tolMin: number): boolean {
  if (!shift.employeeId || !String(shift.employeeId).trim()) return false
  return (
    withinTolerance(shift.startTime, range.startTime, tolMin) &&
    withinTolerance(shift.endTime, range.endTime, tolMin)
  )
}

export function detectMissingRequiredShifts(
  date: string,
  existingShifts: ScheduleShift[],
  requirements: DefaultRequirementSlot[],
  tolMinutes = 15,
): MissingRequiredShift[] {
  const dayShifts = existingShifts.filter((s) => s.date === date)
  const out: MissingRequiredShift[] = []
  for (const req of requirements) {
    const covered = req.acceptedRanges.some((range) =>
      dayShifts.some((s) => assignedShiftCoversRange(s, range, tolMinutes)),
    )
    if (!covered) {
      out.push({
        date,
        shiftType: req.shiftType,
        label: req.label,
        startTime: req.displayRange.startTime,
        endTime: req.displayRange.endTime,
        detailHint: req.detailHint,
      })
    }
  }
  return out
}

function formatMissingSummary(early: number, late: number): string {
  if (early === 0 && late === 0) return ''
  const parts: string[] = []
  if (early > 0) parts.push(`${early} Früh`)
  if (late > 0) parts.push(`${late} Spät`)
  return `${parts.join(' / ')} fehlen`
}

export function calculateOpenShiftsForWeek(
  weekStart: string,
  shifts: ScheduleShift[],
  openDbShifts: ScheduleShift[],
  stationId: string,
  federalState: GermanState,
): OpenShiftWeekSummary {
  const weekEnd = addDaysIso(weekStart, 6)
  const inWeek = (s: ScheduleShift) => s.date >= weekStart && s.date <= weekEnd
  const weekShifts = shifts.filter(inWeek)
  const openDb = openDbShifts.filter(inWeek)

  const missingFlat: MissingRequiredShift[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(weekStart, i)
    const req = getDefaultShiftRequirementsForDate(date, stationId, federalState)
    missingFlat.push(...detectMissingRequiredShifts(date, weekShifts, req))
  }

  const earlyMissing = missingFlat.filter((m) => m.shiftType === 'early').length
  const lateMissing = missingFlat.filter((m) => m.shiftType === 'late').length

  const byDayMap = new Map<string, MissingRequiredShift[]>()
  for (const m of missingFlat) {
    const arr = byDayMap.get(m.date) ?? []
    arr.push(m)
    byDayMap.set(m.date, arr)
  }
  const missingByDay = [...byDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }))

  const totalMissingRequired = missingFlat.length
  const totalOpenDb = openDb.length
  const totalNum = totalOpenDb + totalMissingRequired

  return {
    totalMissingRequired,
    earlyMissing,
    lateMissing,
    missingRequiredFlat: missingFlat,
    missingByDay,
    openDbShifts: openDb,
    totalOpenDb,
    totalCount: totalNum,
    summaryLine: formatMissingSummary(earlyMissing, lateMissing),
  }
}

function toDayRequirementSlot(s: DefaultRequirementSlot): DayRequirementSlot {
  return {
    kind: s.shiftType,
    startTime: s.displayRange.startTime,
    endTime: s.displayRange.endTime,
    workAreaId: 'kasse',
    required: true,
  }
}

/** Wochenbedarf für Schichtplan-Assistent (nur early/late). */
export function buildDefaultWeekRequirements(
  weekStart: string,
  stationId: string,
  federalState: GermanState,
): DayRequirement[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const date = addDaysIso(weekStart, i)
    const req = getDefaultShiftRequirementsForDate(date, stationId, federalState)
    return {
      date,
      slots: req.map(toDayRequirementSlot),
    }
  })
}
