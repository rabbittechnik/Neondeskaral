import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import { getReadableTextColor } from '../../utils/employeeColors'
import { darkenHex, hexToRgba, lightenHex } from './scheduleDayUtils'
import type { TimelineLayout } from './timelineLayout'
import type { WeekTimelineEditBridge } from './scheduleTimelineEditTypes'
import { buildShiftBarTooltipLines, shortenPersonNameForShiftBar } from './scheduleBlockDisplay'

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
  employeeName: string
  accentColor: string
  layout: TimelineLayout
  onSelect?: (block: ResolvedShiftBlock) => void
  dayStart: string
  dayEnd: string
  trackRef: RefObject<HTMLDivElement | null>
  shiftEdit?: WeekTimelineEditBridge
}

const textShadowStrong = '0 1px 2px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.35)'

function stampBadgeLabel(status: ResolvedShiftBlock['stampStatus']): string | null {
  switch (status) {
    case 'running':
      return 'läuft'
    case 'clocked_in':
      return 'eingestempelt'
    case 'deviation':
      return 'abweichend'
    case 'pending_approval':
      return 'Prüfung'
    default:
      return null
  }
}

export function TimelineShiftBlock({
  item,
  headerOffsetPx,
  employeeName,
  accentColor,
  layout,
  onSelect,
  dayStart,
  dayEnd,
  trackRef,
  shiftEdit,
}: Props) {
  const { block, row, leftPercent, widthPercent, seamBefore = false, seamAfter = false } = item
  const preview = shiftEdit?.previewByShiftId.get(block.id)
  const barStart = preview?.start ?? block.start
  const barEnd = preview?.end ?? block.end
  const area = layout.useWorkAreaShortCode
    ? block.workAreaCode || workAreaLabel(block.workAreaCode) || ''
    : workAreaLabel(block.workAreaCode) || block.workAreaCode || ''
  const typeDef = getShiftTypeDef(block.type)
  const h = layout.blockHeight
  const g = layout.rowGap
  const top = headerOffsetPx + row * (h + g)
  const barTextColor = getReadableTextColor(accentColor)
  const hi = lightenHex(accentColor, 0.14)
  const lo = darkenHex(accentColor, 0.22)
  const deep = darkenHex(accentColor, 0.38)
  const glow = hexToRgba(accentColor, 0.55)
  const glowSoft = hexToRgba(accentColor, 0.35)
  const borderHi = lightenHex(accentColor, 0.28)
  const veryNarrow = widthPercent < 11
  const narrow = widthPercent < 22
  const rL = seamBefore ? 'rounded-l-none' : 'rounded-l-lg'
  const rR = seamAfter ? 'rounded-r-none' : 'rounded-r-lg'
  const displayName = veryNarrow || narrow ? shortenPersonNameForShiftBar(employeeName) : employeeName
  const areaLabel = area.trim()
  const badge = stampBadgeLabel(block.stampStatus)
  const dateDe = (() => {
    const ymd = block.dateISO
    const [y, m, d] = ymd.split('-')
    return d && m && y ? `${d}.${m}.${y}` : ymd
  })()
  const stampedEndLabel =
    block.stampStatus === 'running' || !block.stampActualEnd
      ? 'läuft'
      : block.stampActualEnd
  const detailTitle = buildShiftBarTooltipLines({
    employeeName,
    start: barStart,
    end: barEnd,
    plannedStart: block.stampActualStart ? barStart : undefined,
    plannedEnd: block.stampActualStart ? barEnd : undefined,
    stampedStart: block.stampActualStart,
    stampedEnd: block.stampActualStart ? stampedEndLabel : undefined,
    stampSource: block.stampSource,
    areaLabel,
    shiftTypeLabel: typeDef.label,
    status: block.status,
    dateLabel: `Datum: ${dateDe}`,
  })

  const edit = shiftEdit?.canEdit
  const assignActive = Boolean(shiftEdit?.assignDragSourceId)
  const isDropHover = assignActive && shiftEdit?.assignDropHoverId === block.id
  const successFlash = shiftEdit?.flashShiftId === block.id
  const dimmed = assignActive && !isDropHover

  const didPointerMove = useRef(false)

  const startInteract = (
    kind: 'move' | 'resize-start' | 'resize-end',
    e: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!shiftEdit?.canEdit || assignActive) return
    e.stopPropagation()
    e.preventDefault()
    didPointerMove.current = false
    const tr = trackRef.current
    if (!tr) return
    const rect = tr.getBoundingClientRect()
    shiftEdit.onShiftInteractDown({
      kind,
      block,
      pointerId: e.pointerId,
      originClientX: e.clientX,
      trackWidthPx: rect.width,
      timelineStart: dayStart,
      timelineEnd: dayEnd,
    })
  }

  return (
    <div
      className={`absolute z-[2] min-w-[32px] sm:min-w-[40px] ${dimmed ? 'opacity-35' : ''} ${successFlash ? 'ring-2 ring-emerald-400/80 ring-offset-1 ring-offset-black/40' : ''}`}
      style={{
        top,
        height: h,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        minHeight: h,
      }}
      data-shift-assign-target={block.id}
    >
      <button
        type="button"
        title={detailTitle}
        data-shift-assign-target={block.id}
        onClick={() => {
          if (didPointerMove.current) return
          onSelect?.(block)
        }}
        onPointerDown={(e) => {
          if (!edit || assignActive) return
          if (e.button !== 0) return
          didPointerMove.current = false
          const downX = e.clientX
          const downY = e.clientY
          const pid = e.pointerId

          const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pid) return
            if (Math.abs(ev.clientX - downX) > 6 || Math.abs(ev.clientY - downY) > 6) {
              didPointerMove.current = true
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              startInteract('move', ev as unknown as React.PointerEvent<HTMLButtonElement>)
            }
          }
          const onUp = (ev: PointerEvent) => {
            if (ev.pointerId !== pid) return
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
          }
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', onUp)
        }}
        style={{
          height: h,
          lineHeight: 1.15,
          background: `linear-gradient(145deg, ${hi} 0%, ${accentColor} 42%, ${lo} 100%)`,
          boxShadow: `${seamBefore ? 'inset 1px 0 0 rgba(255,255,255,0.34),' : ''}${
            seamAfter ? 'inset -1px 0 0 rgba(255,255,255,0.38),' : ''
          } 0 0 10px ${glow}, 0 0 18px ${glowSoft}, inset 0 1px 0 ${hexToRgba(borderHi, 0.5)}, inset 0 -1px 0 ${hexToRgba(deep, 0.42)}`,
          borderColor: borderHi,
          color: barTextColor,
          textShadow: barTextColor === '#ffffff' ? textShadowStrong : 'none',
          ['--accent-glow' as string]: glow,
          ['--accent-glow-soft' as string]: glowSoft,
        }}
        className={`schedule-shift-bar-colored group absolute inset-0 z-[8] flex items-center overflow-hidden border px-2 py-[3px] text-left transition-[box-shadow,filter,transform,opacity] duration-150 hover:z-[12] hover:brightness-[1.05] hover:shadow-[0_0_20px_var(--accent-glow),0_0_34px_var(--accent-glow-soft),inset_0_1px_0_rgba(255,255,255,0.38)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 active:scale-[0.99] ${rL} ${rR} ${
          seamBefore ? 'border-l-0' : ''
        } ${seamAfter ? 'border-r-0' : ''} ${preview ? 'opacity-90' : ''} ${
          block.conflict ? 'ring-1 ring-orange-400 ring-offset-1 ring-offset-[var(--bg-card)]' : ''
        } ${
          isDropHover
            ? 'ring-2 ring-cyan-300 ring-offset-1 ring-offset-black/50 shadow-[0_0_22px_rgba(34,211,238,0.5)]'
            : ''
        }`}
      >
        {assignActive && isDropHover ? (
          <span className="schedule-drop-hint pointer-events-none absolute inset-x-0 bottom-0.5 z-[4] text-center text-[8px] font-semibold uppercase tracking-wide text-cyan-100 drop-shadow">
            Hier ablegen
          </span>
        ) : null}
        <div
          className={`flex h-full min-h-0 min-w-0 flex-1 items-center gap-1 whitespace-nowrap ${layout.shiftNameClass}`}
          style={{
            color: barTextColor,
            textShadow: barTextColor === '#ffffff' ? textShadowStrong : 'none',
            lineHeight: 1.15,
          }}
        >
          <span className="min-w-0 truncate font-semibold">{displayName}</span>
          <span className="shrink-0 text-white/70">·</span>
          <span className={`shrink-0 tabular-nums text-white/95 ${layout.shiftMetaClass}`}>
            {barStart}–{barEnd}
          </span>
          {!veryNarrow && areaLabel ? (
            <>
              <span className="shrink-0 text-white/70">·</span>
              <span className={`min-w-0 truncate text-white/95 ${layout.shiftMetaClass}`}>{areaLabel}</span>
            </>
          ) : null}
          {badge && !veryNarrow ? (
            <>
              <span className="shrink-0 text-white/70">·</span>
              <span
                className={`schedule-stamp-badge shrink-0 rounded border border-white/30 bg-black/30 px-1 py-px font-semibold uppercase tracking-wide text-white/95 ${layout.shiftMetaClass}`}
              >
                {badge}
              </span>
            </>
          ) : null}
          {layout.showShiftTypeBadge ? (
            <span
              className={`schedule-shift-bar-badge ml-auto shrink-0 rounded border border-white/25 bg-black/25 px-1 py-px font-bold uppercase tracking-wide text-white/95 ${layout.shiftBadgeClass}`}
              style={{ textShadow: '0 1px 1px rgba(0,0,0,0.65)' }}
            >
              {typeDef.label}
            </span>
          ) : null}
        </div>
      </button>

      {edit && !assignActive ? (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Startzeit ziehen"
            title="Startzeit ziehen"
            className={`absolute bottom-0 left-0 top-0 w-9 max-w-[40%] cursor-ew-resize touch-manipulation bg-transparent hover:bg-white/[0.08] active:bg-white/10 ${
              seamBefore ? 'z-[34]' : 'z-[24]'
            }`}
            onPointerDown={(e) => startInteract('resize-start', e)}
          />
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Endzeit ziehen"
            title="Endzeit ziehen"
            className={`absolute bottom-0 right-0 top-0 w-9 max-w-[40%] cursor-ew-resize touch-manipulation bg-transparent hover:bg-white/[0.08] active:bg-white/10 ${
              seamAfter ? 'z-[35]' : 'z-[24]'
            }`}
            onPointerDown={(e) => startInteract('resize-end', e)}
          />
        </>
      ) : null}
    </div>
  )
}