/**
 * Standard-Schichtbedarf (Server, synchron zum Client `defaultShiftRequirements.ts`).
 * Nur Früh/Spät — keine Nacht/Schule als Soll.
 */

import { getHolidayBadgeForDate } from './germanHolidays2026.js'
import type { GermanState } from './germanHolidays2026.js'

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoWeekdayKey(dateIso: string) {
  const d = new Date(`${dateIso}T12:00:00`)
  const i = d.getDay()
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
  return map[i]
}

export const DEFAULT_SHIFT_REQUIREMENTS_STATION_IDS = ['aral-bodelshausen'] as const

export function stationUsesDefaultShiftRequirements(stationId: string): boolean {
  return (DEFAULT_SHIFT_REQUIREMENTS_STATION_IDS as readonly string[]).includes(stationId)
}

function isStrongPublicHoliday(date: string, federalState: GermanState): boolean {
  return getHolidayBadgeForDate(date, federalState).severity === 'strong'
}

type Slot = {
  kind: 'early' | 'late'
  startTime: string
  endTime: string
  workAreaId: string
  required: boolean
}

function slotsForCalendarWeekday(date: string): Slot[] {
  const wd = isoWeekdayKey(date)
  if (wd === 'saturday') {
    return [
      { kind: 'early', startTime: '06:30', endTime: '14:00', workAreaId: 'kasse', required: true },
      { kind: 'late', startTime: '14:00', endTime: '20:15', workAreaId: 'kasse', required: true },
    ]
  }
  if (wd === 'sunday') {
    return [
      { kind: 'early', startTime: '07:30', endTime: '14:00', workAreaId: 'kasse', required: true },
      { kind: 'late', startTime: '14:00', endTime: '20:15', workAreaId: 'kasse', required: true },
    ]
  }
  return [
    { kind: 'early', startTime: '05:30', endTime: '14:00', workAreaId: 'kasse', required: true },
    { kind: 'late', startTime: '14:00', endTime: '21:15', workAreaId: 'kasse', required: true },
  ]
}

function slotsForConfiguredHoliday(): Slot[] {
  return [
    { kind: 'early', startTime: '07:30', endTime: '14:00', workAreaId: 'kasse', required: true },
    { kind: 'late', startTime: '14:00', endTime: '20:15', workAreaId: 'kasse', required: true },
  ]
}

function slotsForDate(stationId: string, date: string, federalState: GermanState): Slot[] {
  if (stationUsesDefaultShiftRequirements(stationId) && isStrongPublicHoliday(date, federalState)) {
    return slotsForConfiguredHoliday()
  }
  return slotsForCalendarWeekday(date)
}

export function buildDefaultWeekRequirements(
  weekStart: string,
  stationId: string,
  federalState: GermanState,
) {
  const dates = [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysIso(weekStart, i))
  return dates.map((date) => ({
    date,
    slots: slotsForDate(stationId, date, federalState),
  }))
}
