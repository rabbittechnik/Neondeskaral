import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import { darkenHex, hexToRgba, lightenHex } from './scheduleDayUtils'
import type { TimelineLayout } from './timelineLayout'
import type { WeekTimelineEditBridge } from './scheduleTimelineEditTypes'

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
  dayStart: string
  dayEnd: string
  trackRef: RefObject<HTMLDivElement | null>
  shiftEdit?: WeekTimelineEditBridge
}

const textShadowStrong = '0 1px 2px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.35)'

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
  const { block, row, leftPercent, widthPercent } = item
  const preview = shiftEdit?.previewByShiftId.get(block.id)
  const displayStart = preview?.start ?? block.start
  const displayEnd = preview?.end ?? block.end
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
      className={`absolute z-[2] min-w-[40px] sm:min-w-[48px] ${dimmed ? 'opacity-35' : ''} ${successFlash ? 'ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-black/40' : ''}`}
      style={{
        top,
        height: h,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      }}
      data-shift-assign-target={block.id}
    >
      {edit && !assignActive ? (
        <>
          <div
            role="presentation"
            className="absolute bottom-0 left-0 top-0 z-[5] w-6 cursor-ew-resize touch-manipulation"
            style={{ boxShadow: isDropHover ? undefined : 'inset 0 0 0 1px rgba(34,211,238,0.25)' }}
            title="Startzeit ziehen"
            onPointerDown={(e) => startInteract('resize-start', e)}
          />
          <div
            role="presentation"
            className="absolute bottom-0 right-0 top-0 z-[5] w-6 cursor-ew-resize touch-manipulation"
            title="Endzeit ziehen"
            onPointerDown={(e) => startInteract('resize-end', e)}
          />
        </>
      ) : null}

      <button
        type="button"
        title={`${employeeName} · ${displayStart}–${displayEnd} · ${area}`}
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
          background: `linear-gradient(145deg, ${hi} 0%, ${accentColor} 42%, ${lo} 100%)`,
          boxShadow: `0 0 18px ${glow}, 0 0 32px ${glowSoft}, inset 0 1px 0 ${hexToRgba(borderHi, 0.55)}, inset 0 -1px 0 ${hexToRgba(deep, 0.45)}`,
          borderColor: borderHi,
          textShadow: textShadowStrong,
          ['--accent-glow' as string]: glow,
        }}
        className={`group absolute inset-x-0 overflow-hidden rounded-xl border px-2 py-1 text-left text-white transition-[box-shadow,filter,transform,opacity] duration-150 hover:z-[3] hover:brightness-[1.06] hover:shadow-[0_0_28px_var(--accent-glow),0_0_44px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 active:scale-[0.99] sm:px-2.5 sm:py-1.5 ${
          edit ? 'left-6 right-6' : 'inset-x-0'
        } ${preview ? 'opacity-90' : ''} ${
          block.conflict ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-[var(--bg-card)]' : ''
        } ${
          isDropHover
            ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-black/50 shadow-[0_0_32px_rgba(34,211,238,0.55)]'
            : ''
        }`}
      >
        {assignActive && isDropHover ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-1 z-[4] text-center text-[9px] font-semibold uppercase tracking-wide text-cyan-100 drop-shadow">
            Hier ablegen
          </span>
        ) : null}
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
              {displayStart}–{displayEnd}
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
              {displayStart}–{displayEnd}
              {area ? <span className="font-medium text-white/80"> · </span> : null}
              {area ? <span className="font-semibold text-white">{area}</span> : null}
            </p>
          </>
        )}
      </button>
    </div>
  )
}
