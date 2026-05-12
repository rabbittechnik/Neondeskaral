import type { AssistantSlotKind, DayRequirement } from '../types/scheduleAssistant'

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

/** Standardbedarf Tankstelle (wie Server `buildDefaultWeekRequirements`). */
export function buildDefaultWeekRequirements(weekStart: string): DayRequirement[] {
  const dates = [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysIso(weekStart, i))
  return dates.map((date) => {
    const wd = isoWeekdayKey(date)
    let early = { start: '05:30', end: '14:00' }
    let late = { start: '14:00', end: '21:15' }
    if (wd === 'saturday') {
      early = { start: '06:30', end: '14:00' }
      late = { start: '14:00', end: '20:15' }
    } else if (wd === 'sunday') {
      early = { start: '07:30', end: '14:00' }
      late = { start: '14:00', end: '20:15' }
    }
    return {
      date,
      slots: [
        {
          kind: 'early' as AssistantSlotKind,
          startTime: early.start,
          endTime: early.end,
          workAreaId: 'kasse',
          required: true,
        },
        {
          kind: 'late' as AssistantSlotKind,
          startTime: late.start,
          endTime: late.end,
          workAreaId: 'kasse',
          required: true,
        },
      ],
    }
  })
}
