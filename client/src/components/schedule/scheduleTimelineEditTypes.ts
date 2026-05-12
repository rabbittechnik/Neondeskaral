import type { ResolvedShiftBlock } from '../../data/mockSchedule'

export type ShiftInteractDownPayload = {
  kind: 'move' | 'resize-start' | 'resize-end'
  block: ResolvedShiftBlock
  pointerId: number
  originClientX: number
  trackWidthPx: number
  timelineStart: string
  timelineEnd: string
}

export type WeekTimelineEditBridge = {
  canEdit: boolean
  assignDragSourceId: string | null
  assignDropHoverId: string | null
  previewByShiftId: Map<string, { start: string; end: string }>
  flashShiftId: string | null
  onShiftInteractDown: (p: ShiftInteractDownPayload) => void
}
