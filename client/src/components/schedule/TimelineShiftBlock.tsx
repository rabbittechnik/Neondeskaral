import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import { hexToRgba } from './scheduleDayUtils'
import type { TimelineLayout } from './timelineLayout'

type Props = {
  item: {
    block: ResolvedShiftBlock
    row: number
    leftPercent: number
    widthPercent: number
  }
  headerOffsetPx: number
  employeeName: string
  accentColor: string
  layout: TimelineLayout
  onSelect?: (block: ResolvedShiftBlock) => void
}

export function TimelineShiftBlock({
  item,
  headerOffsetPx,
  employeeName,
  accentColor,
  layout,
  onSelect,
}: Props) {
  const { block, row, leftPercent, widthPercent } = item
  const area = layout.useWorkAreaShortCode
    ? block.workAreaCode || workAreaLabel(block.workAreaCode) || ''
    : workAreaLabel(block.workAreaCode) || block.workAreaCode || ''
  const typeDef = getShiftTypeDef(block.type)
  const glow = hexToRgba(accentColor, 0.28)
  const edge = hexToRgba(accentColor, 0.5)
  const wash = hexToRgba(accentColor, 0.1)
  const h = layout.blockHeight
  const g = layout.rowGap
  const top = headerOffsetPx + row * (h + g)

  return (
    <button
      type="button"
      title={`${employeeName} · ${block.start}–${block.end} · ${area}`}
      onClick={() => onSelect?.(block)}
      style={{
        top,
        height: h,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        borderColor: edge,
        boxShadow: `0 0 14px ${glow}, inset 0 1px 0 ${hexToRgba(accentColor, 0.06)}`,
        background: `linear-gradient(180deg, ${wash} 0%, rgba(15,23,42,0.45) 100%)`,
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: accentColor,
      }}
      className={`absolute z-[2] min-w-[36px] overflow-hidden rounded-lg border px-1.5 py-0.5 text-left transition hover:z-[3] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400/50 sm:min-w-[44px] sm:px-2 sm:py-1 ${
        block.conflict ? 'ring-2 ring-orange-400/70 ring-offset-1 ring-offset-[var(--bg-card)]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-0.5 sm:gap-1">
        <span className={`min-w-0 truncate text-[var(--text-main)] ${layout.shiftNameClass}`}>
          {employeeName}
        </span>
        <span
          className={`shrink-0 rounded border border-white/10 bg-black/35 font-semibold uppercase tracking-wide text-[var(--text-muted)] ${layout.shiftBadgeClass}`}
        >
          {typeDef.label}
        </span>
      </div>
      <p className={`mt-0.5 truncate text-[var(--text-muted)] ${layout.shiftMetaClass}`}>
        {block.start}–{block.end}
        {area ? <span className="text-[var(--text-faint)]"> · </span> : null}
        {area ? <span className="text-cyan-100/80">{area}</span> : null}
      </p>
    </button>
  )
}
