import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import type { TimelineLayout } from './timelineLayout'

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
}

export function OpenShiftBlock({ item, headerOffsetPx, layout, onSelect }: Props) {
  const { block, row, leftPercent, widthPercent } = item
  const area = layout.useWorkAreaShortCode
    ? block.workAreaCode || workAreaLabel(block.workAreaCode) || ''
    : workAreaLabel(block.workAreaCode) || block.workAreaCode || ''
  const typeDef = getShiftTypeDef(block.type)
  const h = layout.blockHeight
  const g = layout.rowGap
  const top = headerOffsetPx + row * (h + g)

  return (
    <button
      type="button"
      title={`Offene Schicht · ${block.start}–${block.end} · ${area}`}
      onClick={() => onSelect?.(block)}
      style={{
        top,
        height: h,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      }}
      className="absolute z-[2] min-w-[36px] overflow-hidden rounded-lg border border-red-400/45 bg-gradient-to-b from-red-500/25 to-orange-500/15 px-1.5 py-0.5 text-left shadow-[0_0_14px_rgba(248,113,113,0.25)] transition hover:z-[3] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-400/55 sm:min-w-[44px] sm:px-2 sm:py-1"
    >
      <div className="flex items-start justify-between gap-0.5 sm:gap-1">
        <span className={`min-w-0 truncate font-semibold leading-tight text-orange-50 ${layout.openTitleClass}`}>
          Offene Schicht
        </span>
        <span
          className={`shrink-0 rounded border border-orange-300/40 bg-black/30 font-semibold uppercase tracking-wide text-orange-100 ${layout.shiftBadgeClass}`}
        >
          Unbesetzt
        </span>
      </div>
      <p className={`mt-0.5 truncate tabular-nums text-orange-100/90 ${layout.openMetaClass}`}>
        {block.start}–{block.end}
        {area ? <span className="text-orange-200/70"> · </span> : null}
        {area ? <span>{area}</span> : null}
      </p>
      <p className="mt-0.5 truncate text-[7px] font-medium uppercase tracking-wide text-[var(--text-faint)] sm:text-[8px]">
        {typeDef.label}
      </p>
    </button>
  )
}
