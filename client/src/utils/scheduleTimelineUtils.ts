/**
 * Hilfsfunktionen für interaktive Schichtplan-Timeline (Drag/Resize).
 * Ergänzt `scheduleTimeline.ts` (Position/Clipping) ohne bestehende Logik zu duplizieren.
 */

import { getShiftTimelineClip, minutesToClock, timeToMinutes } from './scheduleTimeline'

export { timeToMinutes }

/** HH:mm aus Minuten (mit Tages-Wrap wie `minutesToClock`). */
export function minutesToTime(totalMinutes: number): string {
  return minutesToClock(totalMinutes)
}

export function snapMinutes(minutes: number, step = 15): number {
  if (step <= 0) return Math.round(minutes)
  return Math.round(minutes / step) * step
}

const DAY = 24 * 60

/** Dauer in Minuten; berücksichtigt Schicht über Mitternacht (end <= start). */
export function shiftDurationMinutes(startTime: string, endTime: string): number {
  const sm = timeToMinutes(startTime)
  let em = timeToMinutes(endTime)
  if (em <= sm) em += DAY
  return em - sm
}

export type ShiftPositionPercent = { leftPercent: number; widthPercent: number }

/** left/width in % relativ zu [timelineStart, timelineEnd]. */
export function getShiftPositionPercent(
  startTime: string,
  endTime: string,
  timelineStart: string,
  timelineEnd: string,
): ShiftPositionPercent | null {
  const clip = getShiftTimelineClip(startTime, endTime, timelineStart, timelineEnd)
  if (!clip) return null
  const ds = timeToMinutes(timelineStart)
  const de = timeToMinutes(timelineEnd)
  const span = de - ds
  if (span <= 0) return null
  return {
    leftPercent: ((clip.vs - ds) / span) * 100,
    widthPercent: ((clip.ve - clip.vs) / span) * 100,
  }
}

/** Pixel-Delta der Zeitleiste → Minuten im sichtbaren Fenster. */
export function pixelsToMinutesDelta(deltaPx: number, trackInnerWidthPx: number, timelineStart: string, timelineEnd: string): number {
  const ds = timeToMinutes(timelineStart)
  const de = timeToMinutes(timelineEnd)
  const span = de - ds
  if (trackInnerWidthPx <= 0 || span <= 0) return 0
  return (deltaPx / trackInnerWidthPx) * span
}

/** Ganze Schicht verschieben: Dauer konstant. */
export function calculateShiftDragTime(params: {
  startTime: string
  endTime: string
  deltaMinutes: number
  timelineStart: string
  timelineEnd: string
  snapStep?: number
  minDurationMinutes?: number
}): { startTime: string; endTime: string } | null {
  const step = params.snapStep ?? 15
  const minDur = params.minDurationMinutes ?? 30
  const ds = timeToMinutes(params.timelineStart)
  const de = timeToMinutes(params.timelineEnd)
  const span = de - ds
  if (span <= 0) return null

  const dur = Math.max(minDur, shiftDurationMinutes(params.startTime, params.endTime))
  const delta = snapMinutes(params.deltaMinutes, step)

  let sm = snapMinutes(timeToMinutes(params.startTime) + delta, step)
  let em = sm + dur

  if (em > de) {
    em = snapMinutes(de, step)
    sm = em - dur
  }
  if (sm < ds) {
    sm = snapMinutes(ds, step)
    em = sm + dur
  }
  if (em > de || sm < ds || em - sm < minDur) return null

  return { startTime: minutesToClock(sm), endTime: minutesToClock(em) }
}

/** Start oder Ende ziehen; andere Seite bleibt fixiert. */
export function calculateShiftResizeTime(params: {
  edge: 'start' | 'end'
  startTime: string
  endTime: string
  deltaMinutes: number
  timelineStart: string
  timelineEnd: string
  snapStep?: number
  minDurationMinutes?: number
}): { startTime: string; endTime: string } | null {
  const step = params.snapStep ?? 15
  const minDur = params.minDurationMinutes ?? 30
  const ds = timeToMinutes(params.timelineStart)
  const de = timeToMinutes(params.timelineEnd)
  if (de <= ds) return null

  let sm = timeToMinutes(params.startTime)
  let em = timeToMinutes(params.endTime)
  if (em <= sm) em += DAY

  const delta = snapMinutes(params.deltaMinutes, step)

  if (params.edge === 'start') {
    sm = snapMinutes(sm + delta, step)
    if (em - sm < minDur) sm = em - minDur
    if (sm < ds) sm = ds
    if (em - sm < minDur) return null
  } else {
    em = snapMinutes(em + delta, step)
    if (em - sm < minDur) em = sm + minDur
    if (em > de) em = de
    if (em - sm < minDur) return null
  }

  if (sm < ds || em > de || em - sm < minDur) return null

  return { startTime: minutesToClock(sm), endTime: minutesToClock(em) }
}
