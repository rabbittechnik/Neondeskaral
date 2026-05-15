import { describe, expect, it } from 'vitest'
import {
  filterRenderableScheduleBlocks,
  isPlaceholderTimeRange,
  isRenderableScheduleBlock,
  isRenderableTimeEntry,
  sanitizeBlockActualTimes,
} from './scheduleShiftRender'
import type { ResolvedShiftBlock } from '../data/mockSchedule'
import type { TimeEntry } from '../types/timeTracking'

function block(partial: Partial<ResolvedShiftBlock>): ResolvedShiftBlock {
  return {
    id: 'b1',
    dayIndex: 0,
    type: 'frueh',
    start: '06:00',
    end: '14:00',
    workAreaCode: 'K',
    dateISO: '2026-05-11',
    employeeId: 'emp-1',
    ...partial,
  }
}

function entry(partial: Partial<TimeEntry>): TimeEntry {
  return {
    id: 'te-1',
    employeeId: 'emp-1',
    stationId: 'st-1',
    startAt: '2026-05-11T05:00:00.000Z',
    endAt: '2026-05-11T13:00:00.000Z',
    breakMinutes: 0,
    status: 'completed',
    source: 'tablet',
    startedBy: 'x',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('scheduleShiftRender', () => {
  it('erkennt Platzhalter 00:00–08:00', () => {
    expect(isPlaceholderTimeRange('00:00', '08:00')).toBe(true)
    expect(isPlaceholderTimeRange('06:00', '14:00')).toBe(false)
  })

  it('filtert Ist-only-Balken aus dem Schichtplan', () => {
    const ghost = block({
      istOnly: true,
      start: '14:00',
      end: '21:15',
      workAreaCode: 'Ist',
    })
    expect(isRenderableScheduleBlock(ghost)).toBe(false)
    expect(filterRenderableScheduleBlocks([ghost])).toHaveLength(0)
  })

  it('behält geplante Schicht', () => {
    const planned = block({ start: '14:00', end: '21:15' })
    expect(isRenderableScheduleBlock(planned)).toBe(true)
  })

  it('entfernt Fake-Ist von geplanter Schicht', () => {
    const withFake = block({
      actualStart: '00:00',
      actualEnd: '08:00',
      actualPendingApproval: true,
    })
    const cleaned = sanitizeBlockActualTimes(withFake)
    expect(cleaned.actualStart).toBeUndefined()
    expect(cleaned.actualEnd).toBeUndefined()
  })

  it('lehnt System-Eintrag ohne Schicht ab', () => {
    const e = entry({
      source: 'system',
      shiftId: undefined,
      startAt: '2026-05-11T22:00:00.000Z',
      endAt: '2026-05-12T06:00:00.000Z',
    })
    expect(isRenderableTimeEntry(e)).toBe(false)
  })

  it('akzeptiert echte Tablet-Stempelung', () => {
    const e = entry({
      startAt: '2026-05-11T05:00:00.000Z',
      endAt: '2026-05-11T13:00:00.000Z',
      source: 'tablet',
    })
    expect(isRenderableTimeEntry(e)).toBe(true)
  })
})
