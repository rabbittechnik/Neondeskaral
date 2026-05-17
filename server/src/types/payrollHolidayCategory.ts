/** Kategorie eines Feiertags für die Lohnabrechnung (Prozent kommt aus dem Mitarbeiterprofil). */
export type PayrollHolidayCategory = 'none' | 'regular' | 'special' | 'special_rule'

/** Bei Sonderregel: welcher Mitarbeiter-Zuschlag gilt (Feiertag % vs. B.-Feiertag %). */
export type PayrollHolidaySpecialRuleTier = 'regular' | 'special'

export type StationHolidaySeedTemplate = {
  statutoryTemplateId: string
  name: string
  date: string
  payrollCategory: PayrollHolidayCategory
  specialRuleTier?: PayrollHolidaySpecialRuleTier
  referencePercent: number
  allDay: boolean
  timeStart?: string
  timeEnd?: string
}

export const PAYROLL_HOLIDAY_CATEGORY_LABELS: Record<PayrollHolidayCategory, string> = {
  none: 'Kein Zuschlag',
  regular: 'Feiertag',
  special: 'B.-Feiertag',
  special_rule: 'Sonderregel',
}

export function referencePercentForCategory(
  category: PayrollHolidayCategory,
  specialRuleTier?: PayrollHolidaySpecialRuleTier | null,
): number {
  if (category === 'none') return 0
  if (category === 'special') return 150
  if (category === 'regular') return 125
  if (specialRuleTier === 'special') return 150
  return 125
}

export function categoryToPayrollTier(
  category: PayrollHolidayCategory,
  specialRuleTier?: PayrollHolidaySpecialRuleTier | null,
): 'none' | 'regular' | 'special' {
  if (category === 'none') return 'none'
  if (category === 'special') return 'special'
  if (category === 'regular') return 'regular'
  if (category === 'special_rule') return specialRuleTier === 'special' ? 'special' : 'regular'
  return 'none'
}
