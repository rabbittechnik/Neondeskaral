export type ScheduleTimelineVariant = 'full' | 'compact'

/** Automatisch aus Viewport (<1400 / <1200), steuert Abstände und Zeilenhöhen. */
export type TimelineViewportDensity = 'comfort' | 'compact' | 'cramped'

export type TimelineLayout = {
  tickStepMinutes: number
  timelineHeaderClass: string
  tickLabelClass: string
  dayOuterPadding: string
  dayInnerGap: string
  dayLabelClass: string
  summaryClass: string
  leftColClass: string
  /** Timeline skaliert mit dem Container — keine feste Mindestpixelbreite. */
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

const FLUID_TRACK = 'min-w-0 w-full max-w-full'

function mergeDensity(
  base: TimelineLayout,
  variant: ScheduleTimelineVariant,
  density: TimelineViewportDensity,
): TimelineLayout {
  if (density === 'comfort') {
    return { ...base, scrollMinWidthClass: FLUID_TRACK }
  }

  if (variant === 'compact') {
    if (density === 'compact') {
      return {
        ...base,
        scrollMinWidthClass: FLUID_TRACK,
        dayOuterPadding: 'p-1.5 sm:p-2',
        dayInnerGap: 'gap-1.5 sm:gap-2',
        leftColClass: 'lg:w-32',
        blockHeight: 34,
        rowGap: 3,
        trackPadTop: 5,
        tickStepMinutes: 420,
        timelineHeaderClass: 'h-[18px] sm:h-5',
        tickLabelClass: 'text-[8px] sm:text-[9px]',
        shiftNameClass: 'text-[10px] font-bold leading-tight sm:text-[11px]',
        shiftMetaClass: 'text-[9px] tabular-nums sm:text-[10px]',
        shiftBadgeClass: 'text-[6px] px-0.5 py-px sm:text-[7px]',
        openTitleClass: 'text-[10px] sm:text-[11px]',
        openMetaClass: 'text-[9px] sm:text-[10px]',
      }
    }
    return {
      ...base,
      scrollMinWidthClass: FLUID_TRACK,
      dayOuterPadding: 'p-1.5',
      dayInnerGap: 'gap-1.5',
      leftColClass: 'lg:w-[7.25rem]',
      blockHeight: 30,
      rowGap: 2,
      trackPadTop: 4,
      tickStepMinutes: 420,
      timelineHeaderClass: 'h-[18px]',
      tickLabelClass: 'text-[8px]',
      summaryClass: 'text-[9px]',
      dayLabelClass: 'text-[11px] font-semibold sm:text-xs',
      shiftNameClass: 'text-[10px] font-bold leading-tight',
      shiftMetaClass: 'text-[9px] tabular-nums',
      shiftBadgeClass: 'text-[6px] px-0.5 py-px',
      openTitleClass: 'text-[10px]',
      openMetaClass: 'text-[9px]',
    }
  }

  // variant === 'full'
  if (density === 'compact') {
    return {
      ...base,
      scrollMinWidthClass: FLUID_TRACK,
      dayOuterPadding: 'p-2 sm:p-2.5',
      dayInnerGap: 'gap-2 sm:gap-2.5',
      leftColClass: 'lg:w-40',
      blockHeight: 48,
      rowGap: 5,
      trackPadTop: 7,
      tickStepMinutes: 240,
      timelineHeaderClass: 'h-6',
      tickLabelClass: 'text-[9px] sm:text-[10px]',
      shiftNameClass: 'text-[11px] font-bold leading-tight sm:text-[12px]',
      shiftMetaClass: 'text-[10px] tabular-nums sm:text-[11px]',
      shiftBadgeClass: 'text-[7px] px-1 py-px sm:text-[8px]',
      openTitleClass: 'text-[11px] sm:text-[12px]',
      openMetaClass: 'text-[10px] sm:text-[11px]',
    }
  }

  return {
    ...base,
    scrollMinWidthClass: FLUID_TRACK,
    dayOuterPadding: 'p-2',
    dayInnerGap: 'gap-2',
    leftColClass: 'lg:w-36',
    blockHeight: 42,
    rowGap: 4,
    trackPadTop: 6,
    tickStepMinutes: 360,
    timelineHeaderClass: 'h-6',
    tickLabelClass: 'text-[9px]',
    dayLabelClass: 'text-xs font-semibold sm:text-sm',
    summaryClass: 'text-[10px]',
    shiftNameClass: 'text-[11px] font-bold leading-tight',
    shiftMetaClass: 'text-[10px] tabular-nums sm:text-[11px]',
    shiftBadgeClass: 'text-[7px] px-1 py-px',
    openTitleClass: 'text-[11px]',
    openMetaClass: 'text-[10px]',
  }
}

export function getTimelineLayout(
  variant: ScheduleTimelineVariant,
  density: TimelineViewportDensity = 'comfort',
): TimelineLayout {
  const base: TimelineLayout =
    variant === 'compact'
      ? {
          tickStepMinutes: 360,
          timelineHeaderClass: 'h-5',
          tickLabelClass: 'text-[9px]',
          dayOuterPadding: 'p-2',
          dayInnerGap: 'gap-2',
          dayLabelClass: 'text-xs font-semibold',
          summaryClass: 'text-[10px]',
          leftColClass: 'lg:w-36',
          scrollMinWidthClass: FLUID_TRACK,
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
      : {
          tickStepMinutes: 180,
          timelineHeaderClass: 'h-7',
          tickLabelClass: 'text-[10px]',
          dayOuterPadding: 'p-3',
          dayInnerGap: 'gap-3',
          dayLabelClass: 'text-sm font-semibold',
          summaryClass: 'text-[11px]',
          leftColClass: 'lg:w-44',
          scrollMinWidthClass: FLUID_TRACK,
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

  return mergeDensity(base, variant, density)
}
