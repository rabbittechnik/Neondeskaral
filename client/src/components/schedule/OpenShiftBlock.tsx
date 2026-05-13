import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import type { TimelineLayout } from './timelineLayout'
import type { WeekTimelineEditBridge } from './scheduleTimelineEditTypes'

const textShadowStrong = '0 1px 2px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.4)'

type Props = {
  item: {
    block: ResolvedShiftBlock
    row: number
    leftPercent: number
    widthPercent: number
    seamBefore?: boolean
    seamAfter?: boolean
  }
  headerOffsetPx: number
  layout: TimelineLayout
  onSelect?: (block: ResolvedShiftBlock) => void
  shiftEdit?: WeekTimelineEditBridge
}

export function OpenShiftBlock({ item, headerOffsetPx, layout, onSelect, shiftEdit }: Props) {
  const { block, row, leftPercent, widthPercent, seamBefore = false, seamAfter = false } = item
  const isReqGap = Boolean(block.requirementGap)
  const area = layout.useWorkAreaShortCode
    ? block.workAreaCode || workAreaLabel(block.workAreaCode) || ''
    : workAreaLabel(block.workAreaCode) || block.workAreaCode || ''
  const typeDef = getShiftTypeDef(block.type)
  const h = layout.blockHeight
  const g = layout.rowGap
  const top = headerOffsetPx + row * (h + g)
  const narrow = widthPercent < 18
  const rL = seamBefore ? 'rounded-l-none' : 'rounded-l-lg'
  const rR = seamAfter ? 'rounded-r-none' : 'rounded-r-lg'

  const assignActive = Boolean(shiftEdit?.assignDragSourceId)
  const isDropHover = assignActive && shiftEdit?.assignDropHoverId === block.id
  const dimmed = !isReqGap && assignActive && !isDropHover

  const lineText = isReqGap
    ? narrow
      ? `⚠ ${typeDef.label} · ${block.start}–${block.end}`
      : `⚠ Unbesetzt · ${block.start}–${block.end} · ${typeDef.label}`
    : narrow
      ? `Offen · ${block.start}–${block.end}`
      : `Offen · ${block.start}–${block.end}${area ? ` · ${area}` : ''}`

  const titleBase = isReqGap
    ? [`Soll unbesetzt · ${typeDef.label}`, `${block.start}–${block.end} Uhr`, area ? `Arbeitsbereich: ${area}` : null]
        .filter(Boolean)
        .join('\n')
    : [`Offene Schicht`, `${block.start}–${block.end} Uhr`, area ? `Arbeitsbereich: ${area}` : null, `Typ: ${typeDef.label}`]
        .filter(Boolean)
        .join('\n')

  const baseGlow = isReqGap
    ? '0 0 12px rgba(248,113,113,0.5), 0 0 22px rgba(220,38,38,0.32)'
    : '0 0 12px rgba(249,115,22,0.55), 0 0 22px rgba(234,88,12,0.3)'

  return (
    <button
      type="button"
      disabled={isReqGap}
      {...(isReqGap || !shiftEdit ? {} : { 'data-shift-assign-target': block.id })}
      title={titleBase}
      onClick={() => (isReqGap ? undefined : onSelect?.(block))}
      style={{
        top,
        height: h,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        background: isReqGap
          ? 'linear-gradient(145deg, #f87171 0%, #dc2626 48%, #991b1b 100%)'
          : 'linear-gradient(145deg, #fb923c 0%, #ea580c 48%, #c2410c 100%)',
        boxShadow: `${seamBefore ? 'inset 1px 0 0 rgba(255,255,255,0.32),' : ''}${
          seamAfter ? 'inset -1px 0 0 rgba(255,255,255,0.36),' : ''
        } ${baseGlow}, inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(127,29,29,0.45)`,
        borderColor: isReqGap ? '#fecaca' : '#fed7aa',
        textShadow: textShadowStrong,
      }}
      className={`group absolute z-[2] min-w-[32px] overflow-hidden border px-2 py-0.5 text-left text-white transition-[box-shadow,filter,opacity] duration-150 sm:min-w-[40px] ${rL} ${rR} ${
        isReqGap
          ? 'cursor-default border-red-200/90 hover:brightness-[1.05] hover:shadow-[0_0_20px_rgba(248,113,113,0.6),0_0_34px_rgba(220,38,38,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200 disabled:cursor-default disabled:opacity-100'
          : 'border-orange-200/85 hover:z-[12] hover:brightness-[1.05] hover:shadow-[0_0_20px_rgba(251,146,60,0.65),0_0_34px_rgba(234,88,12,0.42)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-200'
      } ${
        seamBefore ? 'border-l-0' : ''
      } ${seamAfter ? 'border-r-0' : ''} ${
        dimmed ? 'opacity-35' : ''
      } ${isDropHover ? 'ring-2 ring-cyan-300 ring-offset-1 ring-offset-black/50' : ''}`}
    >
      {assignActive && isDropHover ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0.5 z-[4] text-center text-[8px] font-semibold uppercase tracking-wide text-cyan-100 drop-shadow">
          Hier ablegen
        </span>
      ) : null}
      <p
        className={`flex min-w-0 items-center gap-1 truncate whitespace-nowrap font-semibold ${layout.openTitleClass}`}
        style={{ textShadow: textShadowStrong }}
      >
        <span className="min-w-0 truncate">{lineText}</span>
      </p>
    </button>
  )
}
