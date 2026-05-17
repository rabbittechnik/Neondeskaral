import type { GermanState } from './germanHolidays2026.js'
import { GERMAN_HOLIDAYS_2026, holidayAppliesToState } from './germanHolidays2026.js'
import type { StationHolidaySeedTemplate } from '../types/payrollHolidayCategory.js'

/** Manuelle BW-Vorgaben 2026 (überschreiben payrollTier aus der Stammliste). */
const BW_2026_CATEGORY_OVERRIDES: Record<string, Omit<StationHolidaySeedTemplate, 'statutoryTemplateId' | 'name' | 'date'>> = {
  'de-2026-neujahr': {
    payrollCategory: 'special',
    referencePercent: 150,
    allDay: true,
  },
  'de-2026-tag-der-arbeit': {
    payrollCategory: 'special',
    referencePercent: 150,
    allDay: true,
  },
  'de-2026-christi-himmelfahrt': {
    payrollCategory: 'regular',
    referencePercent: 125,
    allDay: true,
  },
  'de-2026-weihnachten-1': {
    payrollCategory: 'special',
    referencePercent: 150,
    allDay: true,
  },
  'de-2026-weihnachten-2': {
    payrollCategory: 'special',
    referencePercent: 150,
    allDay: true,
  },
}

/** Zusätzliche stationübergreifende Kalendertage (nicht in GERMAN_HOLIDAYS_2026). */
const EXTRA_2026_TEMPLATES: StationHolidaySeedTemplate[] = [
  {
    statutoryTemplateId: 'de-2026-heiligabend',
    name: 'Heiligabend',
    date: '2026-12-24',
    payrollCategory: 'special_rule',
    specialRuleTier: 'special',
    referencePercent: 150,
    allDay: false,
    timeStart: '14:00',
    timeEnd: '23:59',
  },
  {
    statutoryTemplateId: 'de-2026-silvester',
    name: 'Silvester',
    date: '2026-12-31',
    payrollCategory: 'special_rule',
    specialRuleTier: 'regular',
    referencePercent: 125,
    allDay: false,
    timeStart: '14:00',
    timeEnd: '23:59',
  },
]

function templateFromStatutoryHoliday(h: (typeof GERMAN_HOLIDAYS_2026)[number]): StationHolidaySeedTemplate {
  const override = BW_2026_CATEGORY_OVERRIDES[h.id]
  if (override) {
    return {
      statutoryTemplateId: h.id,
      name: h.name,
      date: h.date,
      ...override,
    }
  }
  const payrollCategory = h.payrollTier === 'special' ? 'special' : 'regular'
  return {
    statutoryTemplateId: h.id,
    name: h.name,
    date: h.date,
    payrollCategory,
    referencePercent: payrollCategory === 'special' ? 150 : 125,
    allDay: true,
  }
}

/** Gesetzliche + ergänzende Feiertags-Vorlagen pro Bundesland und Jahr (aktuell 2026). */
export function getStationHolidaySeedTemplates(state: GermanState, year: number): StationHolidaySeedTemplate[] {
  if (year !== 2026) {
    return GERMAN_HOLIDAYS_2026.filter((h) => holidayAppliesToState(h, state)).map(templateFromStatutoryHoliday)
  }
  const statutory = GERMAN_HOLIDAYS_2026.filter((h) => holidayAppliesToState(h, state)).map(templateFromStatutoryHoliday)
  const extra = EXTRA_2026_TEMPLATES.filter((t) => t.date.startsWith(`${year}-`))
  const byDate = new Map<string, StationHolidaySeedTemplate>()
  for (const t of [...statutory, ...extra]) byDate.set(t.date, t)
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
