export type ScheduleTimelineVariant = 'full' | 'compact'

export type TimelineLayout = {
  tickStepMinutes: number
  timelineHeaderClass: string
  tickLabelClass: string
  dayOuterPadding: string
  dayInnerGap: string
  dayLabelClass: string
  summaryClass: string
  leftColClass: string
  scrollMinWidthClass: string
  blockHeight: number
  rowGap: number
  trackPadTop: number
  /** Zeilen 0 .. maxVisibleShiftRowIndex sind sichtbar */
  maxVisibleShiftRowIndex: number
  shiftNameClass: string
  shiftMetaClass: string
  shiftBadgeClass: string
  openTitleClass: string
  openMetaClass: string
  /** Kompakt: Kürzel (z. B. K) statt vollem Namen */
  useWorkAreaShortCode: boolean
}

export function getTimelineLayout(variant: ScheduleTimelineVariant): TimelineLayout {
  if (variant === 'compact') {
    return {
      tickStepMinutes: 360,
      timelineHeaderClass: 'h-5',
      tickLabelClass: 'text-[9px]',
      dayOuterPadding: 'p-2',
      dayInnerGap: 'gap-2',
      dayLabelClass: 'text-xs font-semibold',
      summaryClass: 'text-[10px]',
      leftColClass: 'lg:w-36',
      scrollMinWidthClass: 'min-w-[560px]',
      blockHeight: 38,
      rowGap: 4,
      trackPadTop: 6,
      maxVisibleShiftRowIndex: 3,
      shiftNameClass: 'text-[11px] font-bold leading-tight',
      shiftMetaClass: 'text-[10px] tabular-nums',
      shiftBadgeClass: 'text-[7px] px-1 py-px',
      openTitleClass: 'text-[11px]',
      openMetaClass: 'text-[10px]',
      useWorkAreaShortCode: true,
    }
  }
  return {
    tickStepMinutes: 180,
    timelineHeaderClass: 'h-7',
    tickLabelClass: 'text-[10px]',
    dayOuterPadding: 'p-3',
    dayInnerGap: 'gap-3',
    dayLabelClass: 'text-sm font-semibold',
    summaryClass: 'text-[11px]',
    leftColClass: 'lg:w-44',
    scrollMinWidthClass: 'min-w-[720px] lg:min-w-[560px]',
    blockHeight: 54,
    rowGap: 6,
    trackPadTop: 8,
    maxVisibleShiftRowIndex: 99,
    shiftNameClass: 'text-[12px] font-bold leading-tight sm:text-[13px]',
    shiftMetaClass: 'text-[11px] tabular-nums sm:text-[12px]',
    shiftBadgeClass: 'text-[8px] px-1.5 py-0',
    openTitleClass: 'text-[12px] sm:text-[13px]',
    openMetaClass: 'text-[11px] sm:text-[12px]',
    useWorkAreaShortCode: false,
  }
}
