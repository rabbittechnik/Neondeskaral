import { isBakingWeekdayPlanYmd } from './bwHolidayCalendar.js'

export type BakingPlanTypeApi = 'weekday' | 'weekend_holiday'

const ITEMS_WEEKDAY: string[] = [
  '6 normale Brötchen',
  '6 Laugenbrötchen',
  '1 Vitalbrötchen',
  '3 Butterbrezeln',
  '6 normale Brezeln',
  '3 Käsebrezeln',
  '3 Schnitzel-Patties',
  '3 Hähnchen-Patties',
]

const ITEMS_WEEKEND_OR_HOLIDAY: string[] = ['3 Butterbrezeln', '3 normale Brezeln', '3 Käsebrezeln']

export function resolveBakingPlanForBerlinYmd(ymd: string): { planType: BakingPlanTypeApi; items: string[] } {
  if (isBakingWeekdayPlanYmd(ymd)) {
    return { planType: 'weekday', items: [...ITEMS_WEEKDAY] }
  }
  return { planType: 'weekend_holiday', items: [...ITEMS_WEEKEND_OR_HOLIDAY] }
}
