import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import { darkenHex, hexToRgba, lightenHex } from './scheduleDayUtils'
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

const textShadowStrong = '0 1px 2px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.35)'

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
  const h = layout.blockHeight
  const g = layout.rowGap
  const top = headerOffsetPx + row * (h + g)

  const hi = lightenHex(accentColor, 0.14)
  const lo = darkenHex(accentColor, 0.22)
  const deep = darkenHex(accentColor, 0.38)
  const glow = hexToRgba(accentColor, 0.55)
  const glowSoft = hexToRgba(accentColor, 0.35)
  const borderHi = lightenHex(accentColor, 0.28)

  const narrow = widthPercent < 16

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
        background: `linear-gradient(145deg, ${hi} 0%, ${accentColor} 42%, ${lo} 100%)`,
        boxShadow: `0 0 18px ${glow}, 0 0 32px ${glowSoft}, inset 0 1px 0 ${hexToRgba(borderHi, 0.55)}, inset 0 -1px 0 ${hexToRgba(deep, 0.45)}`,
        borderColor: borderHi,
        textShadow: textShadowStrong,
        ['--accent-glow' as string]: glow,
      }}
      className={`group absolute z-[2] min-w-[40px] overflow-hidden rounded-xl border px-2 py-1 text-left text-white transition-[box-shadow,filter,transform] duration-150 hover:z-[3] hover:brightness-[1.06] hover:shadow-[0_0_28px_var(--accent-glow),0_0_44px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 active:scale-[0.99] sm:min-w-[48px] sm:px-2.5 sm:py-1.5 ${
        block.conflict
          ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-[var(--bg-card)]'
          : ''
      }`}
    >
      {narrow ? (
        <div className="flex min-h-0 flex-col justify-center gap-0.5 leading-tight">
          <span
            className={`min-w-0 truncate font-bold tracking-tight text-white ${layout.shiftNameClass}`}
            style={{ textShadow: textShadowStrong }}
          >
            {employeeName}
          </span>
          <span
            className={`tabular-nums font-semibold text-white/95 ${layout.shiftMetaClass}`}
            style={{ textShadow: textShadowStrong }}
          >
            {block.start}–{block.end}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1 sm:gap-1.5">
            <span
              className={`min-w-0 truncate font-bold tracking-tight text-white ${layout.shiftNameClass}`}
              style={{ textShadow: textShadowStrong }}
            >
              {employeeName}
            </span>
            <span
              className={`shrink-0 rounded-md border border-white/25 bg-black/25 px-1.5 py-px font-bold uppercase tracking-wide text-white/95 backdrop-blur-[2px] ${layout.shiftBadgeClass}`}
              style={{ textShadow: '0 1px 1px rgba(0,0,0,0.7)' }}
            >
              {typeDef.label}
            </span>
          </div>
          <p
            className={`mt-0.5 truncate font-semibold tabular-nums text-white/95 ${layout.shiftMetaClass}`}
            style={{ textShadow: textShadowStrong }}
          >
            {block.start}–{block.end}
            {area ? <span className="font-medium text-white/80"> · </span> : null}
            {area ? <span className="font-semibold text-white">{area}</span> : null}
          </p>
        </>
      )}
    </button>
  )
}
