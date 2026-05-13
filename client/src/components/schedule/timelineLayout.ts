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
  /** Schichttyp-Badge im Balken (z. B. „Früh“); Standard aus für kompakte Darstellung */
  showShiftTypeBadge: boolean
}

const FLUID_TRACK = 'min-w-0 w-full max-w-full'

function mergeDensity(
  base: TimelineLayout,
  variant: ScheduleTimelineVariant,
  density: TimelineViewportDensity,
): TimelineLayout {
  if (density === 'comfort') {
    if (variant === 'full') {
      return {
        ...base,
        scrollMinWidthClass: FLUID_TRACK,
        blockHeight: Math.min(32, base.blockHeight + 2),
        rowGap: Math.min(5, base.rowGap + 1),
        trackPadTop: base.trackPadTop + 1,
        dayOuterPadding: 'p-2 sm:p-2.5',
        dayInnerGap: 'gap-2 sm:gap-2.5',
      }
    }
    return {
      ...base,
      scrollMinWidthClass: FLUID_TRACK,
      blockHeight: Math.min(30, base.blockHeight + 2),
      rowGap: base.rowGap + 1,
      trackPadTop: base.trackPadTop + 1,
    }
  }

  if (variant === 'compact') {
    if (density === 'compact') {
      return {
        ...base,
        scrollMinWidthClass: FLUID_TRACK,
        dayOuterPadding: 'p-1.5 sm:p-2',
        dayInnerGap: 'gap-1.5 sm:gap-2',
        leftColClass: 'lg:w-[8.5rem]',
        blockHeight: 26,
        rowGap: 4,
        trackPadTop: 4,
        tickStepMinutes: 420,
        timelineHeaderClass: 'h-4 sm:h-[18px]',
        tickLabelClass: 'text-[8px] sm:text-[9px]',
        shiftNameClass: 'text-[11px] font-semibold leading-none sm:text-[11px]',
        shiftMetaClass: 'text-[10px] tabular-nums sm:text-[10px]',
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
      leftColClass: 'lg:w-32',
      blockHeight: 24,
      rowGap: 3,
      trackPadTop: 3,
      tickStepMinutes: 420,
      timelineHeaderClass: 'h-4',
      tickLabelClass: 'text-[8px]',
      summaryClass: 'text-[9px]',
      dayLabelClass: 'text-[11px] font-semibold sm:text-xs',
      shiftNameClass: 'text-[10px] font-semibold leading-none',
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
      dayOuterPadding: 'p-2 sm:p-2',
      dayInnerGap: 'gap-2',
      leftColClass: 'lg:w-36',
      blockHeight: 26,
      rowGap: 4,
      trackPadTop: 4,
      tickStepMinutes: 180,
      timelineHeaderClass: 'h-[18px]',
      tickLabelClass: 'text-[9px] sm:text-[9px]',
      shiftNameClass: 'text-[11px] font-semibold leading-none sm:text-[12px]',
      shiftMetaClass: 'text-[10px] tabular-nums sm:text-[10px]',
      shiftBadgeClass: 'text-[6px] px-0.5 py-px sm:text-[7px]',
      openTitleClass: 'text-[11px] sm:text-[11px]',
      openMetaClass: 'text-[10px] sm:text-[10px]',
    }
  }

  return {
    ...base,
    scrollMinWidthClass: FLUID_TRACK,
    dayOuterPadding: 'p-2',
    dayInnerGap: 'gap-2',
    leftColClass: 'lg:w-36',
    blockHeight: 24,
    rowGap: 3,
    trackPadTop: 4,
    tickStepMinutes: 180,
    timelineHeaderClass: 'h-4',
    tickLabelClass: 'text-[8px] sm:text-[9px]',
    dayLabelClass: 'text-xs font-semibold sm:text-xs',
    summaryClass: 'text-[9px]',
    shiftNameClass: 'text-[11px] font-semibold leading-none',
    shiftMetaClass: 'text-[10px] tabular-nums',
    shiftBadgeClass: 'text-[6px] px-0.5 py-px',
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
          timelineHeaderClass: 'h-[18px]',
          tickLabelClass: 'text-[9px]',
          dayOuterPadding: 'p-2',
          dayInnerGap: 'gap-2',
          dayLabelClass: 'text-xs font-semibold',
          summaryClass: 'text-[10px]',
          leftColClass: 'lg:w-36',
          scrollMinWidthClass: FLUID_TRACK,
          blockHeight: 28,
          rowGap: 4,
          trackPadTop: 4,
          maxVisibleShiftRowIndex: 6,
          shiftNameClass: 'text-[11px] font-semibold leading-none',
          shiftMetaClass: 'text-[10px] tabular-nums',
          shiftBadgeClass: 'text-[6px] px-0.5 py-px',
          openTitleClass: 'text-[11px]',
          openMetaClass: 'text-[10px]',
          useWorkAreaShortCode: true,
          showShiftTypeBadge: false,
        }
      : {
          tickStepMinutes: 180,
          timelineHeaderClass: 'h-[18px]',
          tickLabelClass: 'text-[9px]',
          dayOuterPadding: 'p-2',
          dayInnerGap: 'gap-2',
          dayLabelClass: 'text-xs font-semibold',
          summaryClass: 'text-[10px]',
          leftColClass: 'lg:w-40',
          scrollMinWidthClass: FLUID_TRACK,
          blockHeight: 28,
          rowGap: 4,
          trackPadTop: 5,
          maxVisibleShiftRowIndex: 99,
          shiftNameClass: 'text-[12px] font-semibold leading-none sm:text-[12px]',
          shiftMetaClass: 'text-[10px] tabular-nums sm:text-[11px]',
          shiftBadgeClass: 'text-[6px] px-0.5 py-px',
          openTitleClass: 'text-[11px] sm:text-[12px]',
          openMetaClass: 'text-[10px] sm:text-[11px]',
          useWorkAreaShortCode: false,
          showShiftTypeBadge: false,
        }

  return mergeDensity(base, variant, density)
}
