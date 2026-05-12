import type {
  OpenShiftSlot,
  ResolvedShiftBlock,
  ScheduleConflict,
} from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import { WEEKDAY_LABELS_SHORT } from './scheduleWeekUtils'

export function openShiftSlotsFromBlocks(
  blocks: ResolvedShiftBlock[],
): OpenShiftSlot[] {
  return blocks
    .filter((b) => b.open)
    .map((b) => ({
      id: b.id,
      dayLabel: WEEKDAY_LABELS_SHORT[b.dayIndex],
      workAreaCode: b.workAreaCode,
      time:
        b.type === 'frei' || !b.start
          ? getShiftTypeDef(b.type).label
          : `${getShiftTypeDef(b.type).label} ${b.start}–${b.end}`,
    }))
}

export function openShiftWarnings(blocks: ResolvedShiftBlock[]): ScheduleConflict[] {
  return blocks
    .filter((b) => b.open)
    .map((b) => ({
      id: `open-warn-${b.id}`,
      message: 'Offene Schicht (Unbesetzt)',
      detail: `${WEEKDAY_LABELS_SHORT[b.dayIndex]} · ${workAreaLabel(b.workAreaCode) || b.workAreaCode || '—'} · ${
        b.start ? `${b.start}–${b.end}` : getShiftTypeDef(b.type).label
      }`,
    }))
}
