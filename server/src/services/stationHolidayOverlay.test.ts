import { describe, expect, it } from 'vitest'
import type { StationHolidayOverlay } from '../types/stationHolidayOverlay.js'
import { resolveHolidayTierAtMoment } from '../types/stationHolidayOverlay.js'
import {
  computeScheduleShiftSupplementBreakdown,
  resolveHolidayPayrollTier,
} from './payrollSurchargeService.js'
import { ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES } from '../types/stationPayrollSurchargeRules.js'

function overlay2026Bw(): StationHolidayOverlay {
  const rules = [
    { date: '2026-05-01', name: 'Tag der Arbeit', payrollCategory: 'special' as const, specialRuleTier: null, allDay: true, timeStart: null, timeEnd: null, referencePercent: 150, active: true },
    { date: '2026-05-14', name: 'Christi Himmelfahrt', payrollCategory: 'regular' as const, specialRuleTier: null, allDay: true, timeStart: null, timeEnd: null, referencePercent: 125, active: true },
    { date: '2026-12-31', name: 'Silvester', payrollCategory: 'special_rule' as const, specialRuleTier: 'regular' as const, allDay: false, timeStart: '14:00', timeEnd: '23:59', referencePercent: 125, active: true },
  ]
  return {
    rules,
    extraPublicDates: new Set(rules.map((r) => r.date)),
    extraNames: new Map(rules.map((r) => [r.date, r.name])),
    specialAllDayDates: new Set(['2026-05-01']),
  }
}

const mathiasLike = {
  surcharge_mode: 'individual',
  holiday_surcharge_percent: 125,
  special_holiday_surcharge_percent: 150,
  saturday_surcharge_percent: 0,
  sunday_surcharge_percent: 50,
  night_surcharge_percent: 25,
  night_surcharge_start: '20:00',
  night_surcharge_end: '06:00',
  night_0_4_surcharge_percent: null,
  night_0_4_after_sunday_percent: null,
  night_0_4_after_holiday_percent: null,
  night_0_4_after_special_holiday_percent: null,
  surcharge_calculation_mode: 'higher',
}

const aushilfeLike = {
  ...mathiasLike,
  holiday_surcharge_percent: 0,
  special_holiday_surcharge_percent: 0,
  sunday_surcharge_percent: 0,
}

describe('resolveHolidayTierAtMoment', () => {
  const ov = overlay2026Bw()

  it('01.05 is B-Feiertag all day', () => {
    expect(resolveHolidayTierAtMoment('2026-05-01', 7, 30, ov)).toBe('special')
  })

  it('14.05 is regular holiday', () => {
    expect(resolveHolidayTierAtMoment('2026-05-14', 14, 0, ov)).toBe('regular')
  })

  it('31.12 regular only from 14:00', () => {
    expect(resolveHolidayTierAtMoment('2026-12-31', 13, 59, ov)).toBe('none')
    expect(resolveHolidayTierAtMoment('2026-12-31', 14, 0, ov)).toBe('regular')
  })
})

describe('computeScheduleShiftSupplementBreakdown with holiday overlay', () => {
  const ov = overlay2026Bw()
  const base = {
    emp: mathiasLike,
    hourlyWage: 15.5,
    federalState: 'BW' as const,
    breakMinutes: 0,
    holidayOverlay: ov,
    stationRules: ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES,
  }

  it('Test 1: 01.05 B-Feiertag 6.5h × 150%', () => {
    const r = computeScheduleShiftSupplementBreakdown({
      ...base,
      shiftDate: '2026-05-01',
      startTime: '07:30',
      endTime: '14:00',
    })
    expect(resolveHolidayPayrollTier('2026-05-01', 'BW', ov)).toBe('special')
    expect(r.lines[0]?.kind).toBe('special_holiday')
    expect(r.lines[0]?.percent).toBe(150)
    expect(r.totalEuro).toBeCloseTo(151.12, 1)
  })

  it('Test 2: 14.05 Feiertag 6.25h × 125%', () => {
    const r = computeScheduleShiftSupplementBreakdown({
      ...base,
      shiftDate: '2026-05-14',
      startTime: '14:00',
      endTime: '20:15',
    })
    expect(resolveHolidayPayrollTier('2026-05-14', 'BW', ov)).toBe('regular')
    expect(r.lines[0]?.kind).toBe('holiday')
    expect(r.lines[0]?.percent).toBe(125)
    expect(r.totalEuro).toBeCloseTo(121.09, 1)
  })

  it('Aushilfe: Feiertag im Kalender, 0% im Profil → 0 €', () => {
    const r = computeScheduleShiftSupplementBreakdown({
      ...base,
      emp: aushilfeLike,
      shiftDate: '2026-05-01',
      startTime: '07:30',
      endTime: '14:00',
    })
    expect(r.totalEuro).toBe(0)
  })

  it('normal weekday early shift: no supplement', () => {
    const r = computeScheduleShiftSupplementBreakdown({
      ...base,
      shiftDate: '2026-05-13',
      startTime: '05:30',
      endTime: '14:00',
    })
    expect(r.totalEuro).toBe(0)
  })
})
