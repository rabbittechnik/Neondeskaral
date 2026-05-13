import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import type { GermanState } from '../../data/germanHolidays'
import type { ScheduleEmployeeRow } from '../../types/employee'
import type { ScheduleTimelineVariant, TimelineViewportDensity } from './timelineLayout'
import { WeeklyScheduleTimeline } from './WeeklyScheduleTimeline'

import type { WeekTimelineEditBridge } from './scheduleTimelineEditTypes'

type Props = {
  weekMonday: Date
  employees: ScheduleEmployeeRow[]
  blocks: ResolvedShiftBlock[]
  onShiftSelect?: (block: ResolvedShiftBlock) => void
  variant?: ScheduleTimelineVariant
  showTitle?: boolean
  showLegend?: boolean
  showFooterLink?: boolean
  timelineDayStart?: string
  timelineDayEnd?: string
  stationFederalState?: GermanState
  stationName?: string
  shiftEdit?: WeekTimelineEditBridge
  viewportDensity?: TimelineViewportDensity
}

export function WeeklyScheduleGrid(props: Props) {
  return <WeeklyScheduleTimeline {...props} />
}
