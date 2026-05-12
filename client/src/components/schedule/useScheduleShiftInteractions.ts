import { useCallback, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ScheduleEmployeeRow } from '../../types/employee'
import type { Employee } from '../../types/employee'
import type { Absence } from '../../types/absence'
import type { ResolvedShiftBlock, ScheduleShift } from '../../data/mockSchedule'
import { workAreaLabel } from '../../data/mockSchedule'
import {
  calculateShiftDragTime,
  calculateShiftResizeTime,
  pixelsToMinutesDelta,
} from '../../utils/scheduleTimelineUtils'
import { evaluateShiftAssignConflicts } from '../../utils/scheduleAssignConflicts'
import { formatShiftTimeRangeDE, formatWeekdayDateDE } from '../../utils/dateFormat'
import { persistShiftPatch } from '../../context/schedule-shifts-context'
import type { ShiftInteractDownPayload, WeekTimelineEditBridge } from './scheduleTimelineEditTypes'

type PendingAssign = {
  shiftId: string
  block: ResolvedShiftBlock
  newEmployeeId: string
  fromName: string
  toName: string
  workAreaId: string
  hard: string[]
  soft: string[]
}

export type PendingTimeChange = {
  shiftId: string
  oldStart: string
  oldEnd: string
  newStart: string
  newEnd: string
}

type Ghost = { x: number; y: number; name: string; color: string }

function pickAssignTargetFromPoint(clientX: number, clientY: number): string | null {
  const stack = document.elementsFromPoint(clientX, clientY)
  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue
    const id = el.dataset.shiftAssignTarget
    if (id) return id
  }
  return null
}

export function useScheduleShiftInteractions(params: {
  canEdit: boolean
  shifts: ScheduleShift[]
  setShifts: React.Dispatch<React.SetStateAction<ScheduleShift[]>>
  allBlocks: ResolvedShiftBlock[]
  employees: Employee[]
  absences: Absence[]
  stationId: string | null
  currentUserId: string
}) {
  const {
    canEdit,
    shifts,
    setShifts,
    allBlocks,
    employees,
    absences,
    stationId,
    currentUserId,
  } = params

  const [dragEmployeeId, setDragEmployeeId] = useState<string | null>(null)
  const [assignDropHoverId, setAssignDropHoverId] = useState<string | null>(null)
  const [previewByShiftId, setPreviewByShiftId] = useState<Map<string, { start: string; end: string }>>(
    () => new Map(),
  )
  const [flashShiftId, setFlashShiftId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)

  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null)
  const [pendingAssignConflict, setPendingAssignConflict] = useState<PendingAssign | null>(null)
  const [pendingTime, setPendingTime] = useState<PendingTimeChange | null>(null)

  const previewLiveRef = useRef<Map<string, { start: string; end: string }>>(new Map())

  const adjustRef = useRef<
    | null
    | (ShiftInteractDownPayload & {
        originStart: string
        originEnd: string
      })
  >(null)

  const clearPreview = useCallback(() => {
    previewLiveRef.current = new Map()
    setPreviewByShiftId(new Map())
  }, [])

  const bumpFlash = useCallback((id: string) => {
    setFlashShiftId(id)
    window.setTimeout(() => setFlashShiftId(null), 1400)
  }, [])

  const onShiftInteractDown = useCallback(
    (p: ShiftInteractDownPayload) => {
      if (!canEdit) return
      adjustRef.current = { ...p, originStart: p.block.start, originEnd: p.block.end }
      previewLiveRef.current = new Map()

      const onMove = (ev: PointerEvent) => {
        if (!adjustRef.current || ev.pointerId !== adjustRef.current.pointerId) return
        const a = adjustRef.current
        const deltaPx = ev.clientX - a.originClientX
        const deltaMin = pixelsToMinutesDelta(deltaPx, a.trackWidthPx, a.timelineStart, a.timelineEnd)
        let next: { startTime: string; endTime: string } | null = null
        if (a.kind === 'move') {
          next = calculateShiftDragTime({
            startTime: a.originStart,
            endTime: a.originEnd,
            deltaMinutes: deltaMin,
            timelineStart: a.timelineStart,
            timelineEnd: a.timelineEnd,
            snapStep: 15,
            minDurationMinutes: 30,
          })
        } else if (a.kind === 'resize-start') {
          next = calculateShiftResizeTime({
            edge: 'start',
            startTime: a.originStart,
            endTime: a.originEnd,
            deltaMinutes: deltaMin,
            timelineStart: a.timelineStart,
            timelineEnd: a.timelineEnd,
            snapStep: 15,
            minDurationMinutes: 30,
          })
        } else {
          next = calculateShiftResizeTime({
            edge: 'end',
            startTime: a.originStart,
            endTime: a.originEnd,
            deltaMinutes: deltaMin,
            timelineStart: a.timelineStart,
            timelineEnd: a.timelineEnd,
            snapStep: 15,
            minDurationMinutes: 30,
          })
        }
        if (!next) return
        const m = new Map([[a.block.id, { start: next.startTime, end: next.endTime }]])
        previewLiveRef.current = m
        setPreviewByShiftId(m)
      }

      const onUp = (ev: PointerEvent) => {
        if (!adjustRef.current || ev.pointerId !== adjustRef.current.pointerId) return
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        const a = adjustRef.current
        adjustRef.current = null
        const live = previewLiveRef.current.get(a.block.id)
        previewLiveRef.current = new Map()
        clearPreview()
        const ns = live?.start ?? a.originStart
        const ne = live?.end ?? a.originEnd
        if (ns === a.originStart && ne === a.originEnd) return
        setPendingTime({
          shiftId: a.block.id,
          oldStart: a.originStart,
          oldEnd: a.originEnd,
          newStart: ns,
          newEnd: ne,
        })
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [canEdit, clearPreview],
  )

  const endEmployeeDrag = useCallback(() => {
    setDragEmployeeId(null)
    setGhost(null)
    setAssignDropHoverId(null)
  }, [])

  const onEmployeePointerDownCapture = useCallback(
    (e: ReactPointerEvent, emp: ScheduleEmployeeRow) => {
      if (!canEdit || e.button !== 0) return
      const pid = e.pointerId
      const startX = e.clientX
      const startY = e.clientY
      let started = false
      const holdTimer = window.setTimeout(() => {
        if (!started) {
          started = true
          setDragEmployeeId(emp.id)
          setGhost({ x: e.clientX, y: e.clientY, name: emp.name, color: emp.color })
        }
      }, 420)

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return
        if (!started && (Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8)) {
          window.clearTimeout(holdTimer)
          started = true
          setDragEmployeeId(emp.id)
        }
        if (started) {
          setGhost({ x: ev.clientX, y: ev.clientY, name: emp.name, color: emp.color })
          setAssignDropHoverId(pickAssignTargetFromPoint(ev.clientX, ev.clientY))
        }
      }

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return
        window.clearTimeout(holdTimer)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        const wasStarted = started
        const targetId = pickAssignTargetFromPoint(ev.clientX, ev.clientY)
        endEmployeeDrag()
        if (!wasStarted || !targetId || !stationId) return
        const block = allBlocks.find((b) => b.id === targetId)
        if (!block) return
        const row = shifts.find((s) => s.id === targetId)
        if (!row) return
        const fromId = row.employeeId
        const fromName = fromId ? employees.find((x) => x.id === fromId)?.displayName ?? '—' : 'Offen'
        const toName = emp.name
        if (fromId === emp.id) return
        const rep = evaluateShiftAssignConflicts({
          targetShift: block,
          targetWorkAreaId: row.workAreaId,
          newEmployeeId: emp.id,
          weekBlocks: allBlocks,
          employees,
          absences,
          excludeShiftId: targetId,
        })
        const pending: PendingAssign = {
          shiftId: targetId,
          block,
          newEmployeeId: emp.id,
          fromName,
          toName,
          workAreaId: row.workAreaId,
          hard: rep.hard,
          soft: rep.soft,
        }
        if (rep.hard.length) setPendingAssignConflict(pending)
        else setPendingAssign(pending)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [canEdit, allBlocks, employees, absences, shifts, stationId, endEmployeeDrag],
  )

  const confirmAssign = useCallback(
    async (p: PendingAssign) => {
      if (!stationId) return
      const saved = await persistShiftPatch(p.shiftId, {
        employeeId: p.newEmployeeId,
        updatedBy: currentUserId,
      })
      if (!saved) {
        window.alert('Änderung konnte nicht gespeichert werden.')
        return
      }
      setShifts((prev) => {
        const i = prev.findIndex((x) => x.id === saved.id)
        if (i === -1) return [...prev, saved]
        const next = [...prev]
        next[i] = saved
        return next
      })
      bumpFlash(p.shiftId)
    },
    [bumpFlash, currentUserId, setShifts, stationId],
  )

  const confirmTime = useCallback(
    async (p: PendingTimeChange) => {
      const saved = await persistShiftPatch(p.shiftId, {
        startTime: p.newStart,
        endTime: p.newEnd,
        updatedBy: currentUserId,
      })
      if (!saved) {
        window.alert('Änderung konnte nicht gespeichert werden.')
        return
      }
      setShifts((prev) => {
        const i = prev.findIndex((x) => x.id === saved.id)
        if (i === -1) return [...prev, saved]
        const next = [...prev]
        next[i] = saved
        return next
      })
      bumpFlash(p.shiftId)
    },
    [bumpFlash, currentUserId, setShifts],
  )

  const shiftEdit: WeekTimelineEditBridge | undefined = useMemo(() => {
    if (!canEdit) return undefined
    return {
      canEdit: true,
      assignDragSourceId: dragEmployeeId,
      assignDropHoverId,
      previewByShiftId,
      flashShiftId,
      onShiftInteractDown,
    }
  }, [
    canEdit,
    dragEmployeeId,
    assignDropHoverId,
    previewByShiftId,
    flashShiftId,
    onShiftInteractDown,
  ])

  const buildAssignMessage = (p: PendingAssign) => {
    const area = workAreaLabel(p.block.workAreaCode) || p.block.workAreaCode
    const lines = [
      `Möchtest du diese Schicht von ${p.fromName} auf ${p.toName} übertragen?`,
      '',
      `Datum: ${formatWeekdayDateDE(p.block.dateISO)}`,
      `Zeit: ${formatShiftTimeRangeDE(p.block.start, p.block.end)}`,
      `Arbeitsbereich: ${area}`,
    ]
    if (p.soft.length) {
      lines.push('', 'Hinweise:', ...p.soft.map((s) => `• ${s}`))
    }
    return lines.join('\n')
  }

  const buildConflictMessage = (p: PendingAssign) => {
    const lines = ['Folgende Punkte wurden erkannt:', '', ...p.hard.map((s) => `• ${s}`)]
    if (p.soft.length) lines.push('', 'Zusätzliche Hinweise:', ...p.soft.map((s) => `• ${s}`))
    return lines.join('\n')
  }

  return {
    shiftEdit,
    ghost,
    pendingAssign,
    setPendingAssign,
    pendingAssignConflict,
    setPendingAssignConflict,
    pendingTime,
    setPendingTime,
    onEmployeePointerDownCapture,
    confirmAssign,
    confirmTime,
    buildAssignMessage,
    buildConflictMessage,
  }
}
