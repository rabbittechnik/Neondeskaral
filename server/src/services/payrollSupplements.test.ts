import { describe, expect, it } from 'vitest'
import {
  employeeReceivesPayrollSurcharges,
  resolveHourlyWageForSupplements,
  shouldUseScheduleSupplementsForDay,
} from './payrollCalculationService.js'
import { computeScheduleShiftSupplementEuros } from './payrollSurchargeService.js'
import { ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES } from '../types/stationPayrollSurchargeRules.js'

describe('shouldUseScheduleSupplementsForDay', () => {
  it('prefers schedule at Bodelshausen when plan and stamp exist', () => {
    expect(
      shouldUseScheduleSupplementsForDay(480, 475, ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES),
    ).toBe(true)
  })

  it('uses time tracking when only stamp exists', () => {
    expect(shouldUseScheduleSupplementsForDay(0, 480, ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES)).toBe(false)
  })

  it('uses schedule when only plan exists', () => {
    expect(shouldUseScheduleSupplementsForDay(480, 0, ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES)).toBe(true)
  })
})

describe('employeeReceivesPayrollSurcharges', () => {
  it('requires individual or tax_free mode', () => {
    expect(employeeReceivesPayrollSurcharges({ surcharge_mode: 'individual' })).toBe(true)
    expect(employeeReceivesPayrollSurcharges({ surcharge_mode: 'none' })).toBe(false)
    expect(employeeReceivesPayrollSurcharges({ employment_type: 'vollzeit' })).toBe(false)
  })
})

describe('resolveHourlyWageForSupplements', () => {
  it('derives hourly rate from monthly salary and hours', () => {
    const rate = resolveHourlyWageForSupplements(null as never, {
      pay_type: 'monthly',
      hourly_wage: null,
      monthly_salary: 3000,
      monthly_hours: 160,
    }, '2026-05-01')
    expect(rate).toBeCloseTo(18.75, 4)
  })
})

describe('computeScheduleShiftSupplementEuros', () => {
  const mathiasLike = {
    surcharge_mode: 'individual',
    holiday_surcharge_percent: 125,
    special_holiday_surcharge_percent: 150,
    saturday_surcharge_percent: null,
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

  it('pays no supplement on normal weekday early shift (05:30 start)', () => {
    const sup = computeScheduleShiftSupplementEuros({
      emp: mathiasLike,
      hourlyWage: 15,
      shiftDate: '2026-05-13',
      startTime: '05:30',
      endTime: '14:15',
      breakMinutes: 0,
      federalState: 'BW',
      stationRules: ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES,
    })
    expect(sup).toBe(0)
  })

  it('pays B-Feiertag surcharge on 2026-05-01 when overlay marks special', () => {
    const holidayOverlay = {
      rules: [
        {
          date: '2026-05-01',
          name: 'Tag der Arbeit',
          payrollCategory: 'special' as const,
          specialRuleTier: null,
          allDay: true,
          timeStart: null,
          timeEnd: null,
          referencePercent: 150,
          active: true,
        },
      ],
      extraPublicDates: new Set(['2026-05-01']),
      extraNames: new Map([['2026-05-01', 'Tag der Arbeit']]),
      specialAllDayDates: new Set(['2026-05-01']),
    }
    const sup = computeScheduleShiftSupplementEuros({
      emp: mathiasLike,
      hourlyWage: 15,
      shiftDate: '2026-05-01',
      startTime: '07:30',
      endTime: '14:00',
      breakMinutes: 0,
      federalState: 'BW',
      stationRules: ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES,
      holidayOverlay,
    })
    // 6.5 h × 15 € × 150 % ≈ 146,25 €
    expect(sup).toBeGreaterThan(140)
    expect(sup).toBeLessThan(155)
  })

  it('returns 0 when surcharge_mode is none', () => {
    const sup = computeScheduleShiftSupplementEuros({
      emp: { ...mathiasLike, surcharge_mode: 'none' },
      hourlyWage: 15,
      shiftDate: '2026-05-01',
      startTime: '07:30',
      endTime: '14:00',
      breakMinutes: 0,
      federalState: 'BW',
      stationRules: ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES,
    })
    expect(sup).toBe(0)
  })

  it('returns 0 when hourly wage is 0', () => {
    const sup = computeScheduleShiftSupplementEuros({
      emp: mathiasLike,
      hourlyWage: 0,
      shiftDate: '2026-05-01',
      startTime: '07:30',
      endTime: '14:00',
      breakMinutes: 0,
      federalState: 'BW',
      stationRules: ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES,
    })
    expect(sup).toBe(0)
  })
})
