import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import type { TimelineLayout } from './timelineLayout'
import type { WeekTimelineEditBridge } from './scheduleTimelineEditTypes'

const textShadowStrong = '0 1px 2px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.45)'

type Props = {
  item: {
    block: ResolvedShiftBlock
    row: number
    leftPercent: number
    widthPercent: number
  }
  headerOffsetPx: number
  layout: TimelineLayout
  onSelect?: (block: ResolvedShiftBlock) => void
  shiftEdit?: WeekTimelineEditBridge
}

export function OpenShiftBlock({ item, headerOffsetPx, layout, onSelect, shiftEdit }: Props) {
  const { block, row, leftPercent, widthPercent } = item
  const area = layout.useWorkAreaShortCode
    ? block.workAreaCode || workAreaLabel(block.workAreaCode) || ''
    : workAreaLabel(block.workAreaCode) || block.workAreaCode || ''
  const typeDef = getShiftTypeDef(block.type)
  const h = layout.blockHeight
  const g = layout.rowGap
  const top = headerOffsetPx + row * (h + g)
  const narrow = widthPercent < 16

  const assignActive = Boolean(shiftEdit?.assignDragSourceId)
  const isDropHover = assignActive && shiftEdit?.assignDropHoverId === block.id
  const dimmed = assignActive && !isDropHover

  return (
    <button
      type="button"
      data-shift-assign-target={block.id}
      title={`Offene Schicht · ${block.start}–${block.end} · ${area}`}
      onClick={() => onSelect?.(block)}
      style={{
        top,
        height: h,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        background: 'linear-gradient(145deg, #fb923c 0%, #ea580c 48%, #c2410c 100%)',
        boxShadow:
          '0 0 20px rgba(249,115,22,0.65), 0 0 36px rgba(234,88,12,0.35), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(127,29,29,0.45)',
        borderColor: '#fed7aa',
        textShadow: textShadowStrong,
      }}
      className={`group absolute z-[2] min-w-[40px] overflow-hidden rounded-xl border-2 border-orange-200/90 px-2 py-1 text-left text-white transition-[box-shadow,filter,opacity] duration-150 hover:z-[3] hover:brightness-110 hover:shadow-[0_0_32px_rgba(251,146,60,0.85)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-200 sm:min-w-[48px] sm:px-2.5 sm:py-1.5 ${
        dimmed ? 'opacity-35' : ''
      } ${isDropHover ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-black/50' : ''}`}
    >
      {assignActive && isDropHover ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-1 z-[4] text-center text-[9px] font-semibold uppercase tracking-wide text-cyan-100 drop-shadow">
          Hier ablegen
        </span>
      ) : null}
      {narrow ? (
        <div className="flex flex-col gap-0.5 leading-tight">
          <span
            className={`truncate font-bold text-white ${layout.openTitleClass}`}
            style={{ textShadow: textShadowStrong }}
          >
            Offen
          </span>
          <span className={`font-semibold tabular-nums text-white/95 ${layout.openMetaClass}`} style={{ textShadow: textShadowStrong }}>
            {block.start}–{block.end}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1 sm:gap-1.5">
            <span
              className={`min-w-0 truncate font-bold text-white ${layout.openTitleClass}`}
              style={{ textShadow: textShadowStrong }}
            >
              Offene Schicht
            </span>
            <span
              className={`shrink-0 rounded-md border border-white/30 bg-black/30 px-1.5 py-px font-bold uppercase tracking-wide text-white ${layout.shiftBadgeClass}`}
              style={{ textShadow: '0 1px 1px rgba(0,0,0,0.75)' }}
            >
              Unbesetzt
            </span>
          </div>
          <p
            className={`mt-0.5 truncate font-semibold tabular-nums text-white/95 ${layout.openMetaClass}`}
            style={{ textShadow: textShadowStrong }}
          >
            {block.start}–{block.end}
            {area ? <span className="text-white/85"> · </span> : null}
            {area ? <span className="font-semibold text-white">{area}</span> : null}
          </p>
          <p
            className={`mt-0.5 truncate font-bold uppercase tracking-wide text-white/90 ${layout.shiftBadgeClass}`}
            style={{ textShadow: textShadowStrong }}
          >
            {typeDef.label}
          </p>
        </>
      )}
    </button>
  )
}
