/**
 * Schnellprüfung Zuschläge Bodelshausen (Mathias-Profil).
 * npx tsx scripts/verifyBodelshausenSupplements.ts
 */
import { ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES } from '../src/types/stationPayrollSurchargeRules.js'
import {
  computeScheduleShiftSupplementBreakdown,
  resolveHolidayPayrollTier,
} from '../src/services/payrollSurchargeService.js'

const emp = {
  surcharge_mode: 'individual',
  saturday_surcharge_percent: null,
  sunday_surcharge_percent: 50,
  holiday_surcharge_percent: 125,
  special_holiday_surcharge_percent: 150,
  night_surcharge_percent: 25,
  night_surcharge_start: '20:00',
  night_surcharge_end: '06:00',
  night_0_4_surcharge_percent: null,
  night_0_4_after_sunday_percent: null,
  night_0_4_after_holiday_percent: null,
  night_0_4_after_special_holiday_percent: null,
  surcharge_calculation_mode: 'higher',
}

const wage = 15.5
const rules = ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES
const base = { emp, hourlyWage: wage, federalState: 'BW' as const, breakMinutes: 0, stationRules: rules }

const cases = [
  { label: '01.05.', date: '2026-05-01', start: '07:30', end: '14:00', expect: 151.13 },
  { label: '13.05.', date: '2026-05-13', start: '05:30', end: '14:15', expect: 0 },
  { label: '14.05.', date: '2026-05-14', start: '14:00', end: '20:15', expect: 121.09 },
  { label: '15.05.', date: '2026-05-15', start: '14:00', end: '21:15', expect: 0 },
] as const

let total = 0
for (const c of cases) {
  const br = computeScheduleShiftSupplementBreakdown({
    ...base,
    shiftDate: c.date,
    startTime: c.start,
    endTime: c.end,
  })
  const tier = resolveHolidayPayrollTier(c.date, 'BW')
  total += br.totalEuro
  const ok = Math.abs(br.totalEuro - c.expect) < 0.02 ? 'OK' : 'FAIL'
  console.log(
    `${ok} ${c.label} tier=${tier} total=${br.totalEuro.toFixed(2)} expect=${c.expect.toFixed(2)}`,
    br.lines.map((l) => `${l.kindLabelDe} ${l.percent}%`),
  )
}
console.log(`Summe=${total.toFixed(2)} expect=272.22`)
