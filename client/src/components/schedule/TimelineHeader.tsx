import {
  buildTimelineTicks,
  minutesToClock,
  timeToMinutes,
} from '../../utils/scheduleTimeline'
import type { ScheduleTimelineVariant } from './timelineLayout'
import { getTimelineLayout } from './timelineLayout'

type Props = {
  dayStart: string
  dayEnd: string
  variant?: ScheduleTimelineVariant
}

export function TimelineHeader({ dayStart, dayEnd, variant = 'full' }: Props) {
  const layout = getTimelineLayout(variant)
  const ticks = buildTimelineTicks(dayStart, dayEnd, layout.tickStepMinutes)
  const ds = timeToMinutes(dayStart)
  const de = timeToMinutes(dayEnd)
  const span = Math.max(1, de - ds)

  return (
    <div
      className={`relative select-none border-b border-white/10 ${layout.timelineHeaderClass}`}
    >
      {ticks.map((m) => {
        const left = ((m - ds) / span) * 100
        return (
          <div
            key={m}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
          >
            <span
              className={`whitespace-nowrap font-medium tabular-nums text-[var(--text-muted)] ${layout.tickLabelClass}`}
            >
              {minutesToClock(m)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
