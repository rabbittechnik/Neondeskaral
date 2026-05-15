import { describe, expect, it } from 'vitest'
import { resolvePayrollWorkUsedMinutes } from './payrollReportService.js'

describe('resolvePayrollWorkUsedMinutes', () => {
  it('A) uses actual when stamp is slightly earlier than plan', () => {
    const r = resolvePayrollWorkUsedMinutes(510, 508, false) // 8:30 plan, 8:28 stamp
    expect(r.usedMin).toBe(508)
    expect(r.source).toBe('time_tracking')
  })

  it('B) uses actual when stamp ends later than plan', () => {
    const r = resolvePayrollWorkUsedMinutes(510, 515, false)
    expect(r.usedMin).toBe(515)
    expect(r.source).toBe('time_tracking')
  })

  it('C) uses shorter approved stamp (early leave)', () => {
    const r = resolvePayrollWorkUsedMinutes(510, 390, false) // 8.5h plan, 6.5h stamp
    expect(r.usedMin).toBe(390)
    expect(r.source).toBe('time_tracking')
  })

  it('D) unplanned work without plan', () => {
    const r = resolvePayrollWorkUsedMinutes(0, 120, false)
    expect(r.usedMin).toBe(120)
    expect(r.source).toBe('time_tracking_extra')
  })

  it('E) falls back to plan without stamp', () => {
    const r = resolvePayrollWorkUsedMinutes(495, 0, false)
    expect(r.usedMin).toBe(495)
    expect(r.source).toBe('schedule_fallback')
  })

  it('F) no plan and no stamp', () => {
    const r = resolvePayrollWorkUsedMinutes(0, 0, false)
    expect(r.usedMin).toBe(0)
    expect(r.source).toBe('none')
  })

  it('open entry uses plan fallback when plan exists', () => {
    const r = resolvePayrollWorkUsedMinutes(510, 0, true)
    expect(r.usedMin).toBe(510)
    expect(r.source).toBe('schedule_fallback')
  })
})
