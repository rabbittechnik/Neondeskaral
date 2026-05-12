import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import type { GermanState } from '../../data/germanHolidays'
import type { ScheduleEmployeeRow } from '../../types/employee'
import type { ScheduleTimelineVariant } from './timelineLayout'
import { WeeklyScheduleTimeline } from './WeeklyScheduleTimeline'

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
}

export function WeeklyScheduleGrid(props: Props) {
  return <WeeklyScheduleTimeline {...props} />
}
