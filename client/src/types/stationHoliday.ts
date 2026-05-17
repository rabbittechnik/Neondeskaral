export type PayrollHolidayCategory = 'none' | 'regular' | 'special' | 'special_rule'

export type PayrollHolidaySpecialRuleTier = 'regular' | 'special'

export type StationHoliday = {
  id: string
  date: string
  name: string
  federalState: string
  payrollCategory: PayrollHolidayCategory
  specialRuleTier: PayrollHolidaySpecialRuleTier | null
  referencePercent: number
  allDay: boolean
  timeStart: string | null
  timeEnd: string | null
  source: 'statutory' | 'custom'
  statutoryTemplateId: string | null
  isManualOverride: boolean
  active: boolean
  note: string
}

export const PAYROLL_HOLIDAY_CATEGORY_LABELS: Record<PayrollHolidayCategory, string> = {
  none: 'Kein Zuschlag',
  regular: 'Feiertag',
  special: 'B.-Feiertag',
  special_rule: 'Sonderregel',
}

export function categoryBadgeLabel(h: StationHoliday): string {
  if (h.payrollCategory === 'none') return 'Kein Zuschlag 0 %'
  if (h.payrollCategory === 'special') return `B.-Feiertag ${h.referencePercent} %`
  if (h.payrollCategory === 'special_rule') {
    const tier = h.specialRuleTier === 'special' ? 'B.-Feiertag' : 'Feiertag'
    return `Sonderregel · ${tier} ${h.referencePercent} %`
  }
  return `Feiertag ${h.referencePercent} %`
}

export function timeRangeLabel(h: StationHoliday): string {
  if (h.allDay) return 'ganzer Tag'
  const from = h.timeStart ?? '—'
  const to = h.timeEnd ? `bis ${h.timeEnd}` : 'bis Tagesende'
  return `ab ${from} ${to}`.trim()
}
