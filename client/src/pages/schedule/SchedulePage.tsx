import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeWeeklyHoursByEmployee,
  resolveShiftsForWeekGrid,
  STATION_NAME,
  toISODate,
  toScheduleEmployeeRow,
  type ResolvedShiftBlock,
  type ScheduleConflict,
  type ScheduleShift,
  type WeekAbsence,
} from '../../data/mockSchedule'
import { ScheduleStatsPanel } from '../../components/schedule/ScheduleStatsPanel'
import { ScheduleToolbar } from '../../components/schedule/ScheduleToolbar'
import type { ScheduleViewMode } from '../../components/schedule/ScheduleViewTabs'
import { ScheduleViewTabs } from '../../components/schedule/ScheduleViewTabs'
import { ScheduleViewPlaceholder } from '../../components/schedule/ScheduleViewPlaceholder'
import {
  addDays,
  addWeeks,
  formatDE,
  getISOWeek,
  startOfWeekMonday,
} from '../../components/schedule/scheduleWeekUtils'
import { ScheduleEmployeeSummaryBar } from '../../components/schedule/ScheduleEmployeeSummaryBar'
import { WeeklyScheduleGrid } from '../../components/schedule/WeeklyScheduleGrid'
import { ShiftModal } from '../../components/schedule/shift/ShiftModal'
import {
  openShiftSlotsFromBlocks,
  openShiftWarnings,
} from '../../components/schedule/schedulePanelUtils'
import { useEmployees } from '../../context/employees-context'
import { persistShiftDelete, persistShiftUpsert, useScheduleShifts } from '../../context/schedule-shifts-context'
import { useStation } from '../../context/station-context'
import { ScheduleAssistantModal } from '../../components/schedule/assistant/ScheduleAssistantModal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useScheduleShiftInteractions } from '../../components/schedule/useScheduleShiftInteractions'
import { useAbsences } from '../../context/absences-context'
import { useAuth } from '../../context/auth-context'
import { formatShiftTimeRangeDE } from '../../utils/dateFormat'
import { apiGet } from '../../services/api'

export function SchedulePage() {
  const { federalState, stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const { absences } = useAbsences()
  const { employees } = useEmployees()
  const { shifts, setShifts, ensureWeekSeeded, loading: shiftsLoading, error: shiftsError, refetchRange } =
    useScheduleShifts()

  const [weekOffset, setWeekOffset] = useState(0)
  const [workAreaFilter, setWorkAreaFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [view, setView] = useState<ScheduleViewMode>('calendar')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [modalShift, setModalShift] = useState<ScheduleShift | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)

  const weekMonday = useMemo(() => {
    const base = startOfWeekMonday(new Date())
    return addWeeks(base, weekOffset)
  }, [weekOffset])

  const weekSunday = useMemo(() => addDays(weekMonday, 6), [weekMonday])
  const isoWeek = useMemo(() => getISOWeek(weekMonday), [weekMonday])
  const weekStartIso = useMemo(() => toISODate(weekMonday), [weekMonday])
  const weekEndIso = useMemo(() => toISODate(weekSunday), [weekSunday])

  const scheduleRows = useMemo(
    () => employees.map(toScheduleEmployeeRow),
    [employees],
  )

  const shiftEmployeeOptions = useMemo(
    () =>
      employees.map((e) => ({
        id: e.id,
        displayName: e.displayName,
        role: e.role,
      })),
    [employees],
  )

  const getEmployeeDisplayName = useCallback(
    (id: string) => employees.find((e) => e.id === id)?.displayName ?? 'Mitarbeiter',
    [employees],
  )

  const handleAssistantApplied = useCallback(async () => {
    await refetchRange(weekStartIso, weekEndIso)
  }, [refetchRange, weekStartIso, weekEndIso])

  const employeeHourLabels = useMemo(
    () =>
      employees.map((e) => ({
        id: e.id,
        label: e.displayName.split(/\s+/)[0] ?? e.displayName,
      })),
    [employees],
  )

  useEffect(() => {
    ensureWeekSeeded(weekMonday)
  }, [weekMonday, ensureWeekSeeded])

  const allBlocks = useMemo(
    () => resolveShiftsForWeekGrid(shifts, weekMonday),
    [shifts, weekMonday],
  )

  /** Wochenraster: nur echte Dienste + offene Schichten (kein „Frei“). */
  const gridBlocks = useMemo(() => {
    let list = allBlocks.filter(
      (b) => b.type !== 'frei' && (b.open || Boolean(b.employeeId)),
    )
    if (workAreaFilter !== 'all') {
      list = list.filter((b) => b.open || b.workAreaCode === workAreaFilter)
    }
    if (employeeFilter !== 'all') {
      list = list.filter((b) => b.open || b.employeeId === employeeFilter)
    }
    return list
  }, [allBlocks, workAreaFilter, employeeFilter])

  const hoursByEmployee = useMemo(
    () => computeWeeklyHoursByEmployee(allBlocks),
    [allBlocks],
  )

  const openShiftsThisWeek = useMemo(
    () => openShiftSlotsFromBlocks(allBlocks),
    [allBlocks],
  )

  const [scheduleConflicts, setScheduleConflicts] = useState<ScheduleConflict[]>([])
  const [conflictsError, setConflictsError] = useState<string | null>(null)

  const panelConflicts = useMemo(
    () => [...openShiftWarnings(allBlocks), ...scheduleConflicts],
    [allBlocks, scheduleConflicts],
  )

  useEffect(() => {
    if (!stationId) {
      setScheduleConflicts([])
      setConflictsError(null)
      return
    }
    let cancelled = false
    void (async () => {
      const res = await apiGet<ScheduleShift[]>('/shifts/conflicts', {
        stationId,
        from: weekStartIso,
        to: weekEndIso,
      })
      if (cancelled) return
      if (!res.ok) {
        setScheduleConflicts([])
        setConflictsError(res.error)
        return
      }
      setConflictsError(null)
      const list = Array.isArray(res.data) ? res.data : []
      setScheduleConflicts(
        list.map((s) => ({
          id: `conf-${s.id}`,
          message: 'Schichtkonflikt',
          detail: `${getEmployeeDisplayName(s.employeeId ?? '')} · ${s.date} · ${s.workAreaId} · ${s.startTime}–${s.endTime}`,
        })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [stationId, weekStartIso, weekEndIso, getEmployeeDisplayName])

  const weekAbsencesPanel = useMemo((): WeekAbsence[] => {
    const typeLabel: Record<string, string> = {
      urlaub: 'Urlaub',
      krankheit: 'Krank',
      berufsschule: 'Berufsschule',
      frei: 'Frei',
      sonderurlaub: 'Sonderurlaub',
      unbezahlt: 'Unbezahlt',
      kind_krank: 'Kind krank',
      sonstiges: 'Sonstiges',
    }
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-')
      return d && m && y ? `${d}.${m}.${y}` : iso
    }
    const out: WeekAbsence[] = []
    for (const a of absences) {
      if (a.status === 'storniert') continue
      if (a.endDate < weekStartIso || a.startDate > weekEndIso) continue
      const emp = employees.find((e) => e.id === a.employeeId)
      const tl = typeLabel[a.type] ?? a.type
      const range =
        a.startDate === a.endDate ? fmt(a.startDate) : `${fmt(a.startDate)} – ${fmt(a.endDate)}`
      out.push({
        id: a.id,
        employeeName: emp?.displayName ?? 'Mitarbeiter',
        type: tl,
        range,
      })
    }
    return out
  }, [absences, employees, weekStartIso, weekEndIso])

  const openCreate = () => {
    setModalMode('create')
    setModalShift(null)
    setModalOpen(true)
  }

  const openEdit = (block: ResolvedShiftBlock) => {
    const s = shifts.find((x) => x.id === block.id)
    if (!s) return
    setModalMode('edit')
    setModalShift(s)
    setModalOpen(true)
  }

  const handleUpsert = async (s: ScheduleShift) => {
    if (!stationId) return
    const saved = await persistShiftUpsert(s, stationId)
    if (!saved) {
      window.alert('Schicht konnte nicht gespeichert werden. Bitte API/Server prüfen.')
      return
    }
    setShifts((prev) => {
      const i = prev.findIndex((x) => x.id === saved.id)
      if (i === -1) return [...prev, saved]
      const next = [...prev]
      next[i] = saved
      return next
    })
  }

  const handleDelete = async (id: string) => {
    const ok = await persistShiftDelete(id)
    if (!ok) {
      window.alert('Schicht konnte nicht gelöscht werden.')
      return
    }
    setShifts((prev) => prev.filter((x) => x.id !== id))
  }

  const stub = () => {
    alert('Funktion folgt mit Backend (später).')
  }

  const toggleEmployeeFilter = (id: string) => {
    setEmployeeFilter((prev) => (prev === id ? 'all' : id))
  }

  const canEditPlan = hasPermission('schedule.edit')
  const currentUserId = user?.id ?? ''

  const shiftInteractions = useScheduleShiftInteractions({
    canEdit: canEditPlan,
    shifts,
    setShifts,
    allBlocks,
    employees,
    absences,
    stationId,
    currentUserId,
  })

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">
            Schichtplan
          </h1>
          <p className="max-w-2xl text-sm text-[var(--text-muted)]">
            Wochenübersicht und Dienstplanung für die aktuelle Station
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-faint)]">
            <span>
              Station:{' '}
              <span className="font-medium text-cyan-200/90">{STATION_NAME}</span>
            </span>
            {shiftsLoading ? <span>Schichten werden geladen…</span> : null}
            {shiftsError ? (
              <span className="text-amber-300/90" title={shiftsError}>
                Schichten: {shiftsError}
              </span>
            ) : null}
            {conflictsError ? (
              <span className="text-amber-300/90" title={conflictsError}>
                Konflikte: {conflictsError}
              </span>
            ) : null}
            <span>
              Kalenderwoche:{' '}
              <span className="font-medium text-[var(--text-main)]">KW {isoWeek}</span>
            </span>
            <span>
              Zeitraum:{' '}
              <span className="font-medium text-[var(--text-main)]">
                {formatDE(weekMonday)} – {formatDE(weekSunday)}
              </span>
            </span>
          </div>
        </div>
        <ScheduleViewTabs active={view} onChange={setView} />
      </header>

      <ScheduleToolbar
        workAreaFilter={workAreaFilter}
        onWorkAreaFilter={setWorkAreaFilter}
        employeeFilter={employeeFilter}
        onEmployeeFilter={setEmployeeFilter}
        onToday={() => setWeekOffset(0)}
        onPrevWeek={() => setWeekOffset((w) => w - 1)}
        onNextWeek={() => setWeekOffset((w) => w + 1)}
        onNewShift={openCreate}
        onPublish={stub}
        onPrint={stub}
        onMore={stub}
        scheduleEmployees={scheduleRows}
        onOpenAssistant={() => setAssistantOpen(true)}
      />

      <ScheduleAssistantModal
        open={assistantOpen}
        initialWeekStartIso={weekStartIso}
        onClose={() => setAssistantOpen(false)}
        onApplied={handleAssistantApplied}
      />

      <ShiftModal
        open={modalOpen}
        mode={modalMode}
        shift={modalShift}
        weekMonday={weekMonday}
        allShifts={shifts}
        onClose={() => setModalOpen(false)}
        onUpsert={handleUpsert}
        onDelete={handleDelete}
        getEmployeeDisplayName={getEmployeeDisplayName}
        employeeSelectOptions={shiftEmployeeOptions}
      />

      <ConfirmDialog
        open={Boolean(shiftInteractions.pendingAssign)}
        title="Schicht neu zuweisen?"
        message={
          shiftInteractions.pendingAssign ? shiftInteractions.buildAssignMessage(shiftInteractions.pendingAssign) : ''
        }
        confirmLabel="Schicht übertragen"
        onCancel={() => shiftInteractions.setPendingAssign(null)}
        onConfirm={() => {
          const p = shiftInteractions.pendingAssign
          if (p) void shiftInteractions.confirmAssign(p)
          shiftInteractions.setPendingAssign(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(shiftInteractions.pendingAssignConflict)}
        title="Achtung: Konflikt erkannt"
        variant="danger"
        message={
          shiftInteractions.pendingAssignConflict
            ? shiftInteractions.buildConflictMessage(shiftInteractions.pendingAssignConflict)
            : ''
        }
        confirmLabel="Trotzdem übertragen"
        cancelLabel="Abbrechen"
        onCancel={() => shiftInteractions.setPendingAssignConflict(null)}
        onConfirm={() => {
          const p = shiftInteractions.pendingAssignConflict
          if (p) void shiftInteractions.confirmAssign(p)
          shiftInteractions.setPendingAssignConflict(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(shiftInteractions.pendingTime)}
        title="Schichtzeit ändern?"
        message={
          shiftInteractions.pendingTime
            ? [
                `Alt: ${formatShiftTimeRangeDE(shiftInteractions.pendingTime.oldStart, shiftInteractions.pendingTime.oldEnd)}`,
                `Neu: ${formatShiftTimeRangeDE(shiftInteractions.pendingTime.newStart, shiftInteractions.pendingTime.newEnd)}`,
              ].join('\n')
            : ''
        }
        confirmLabel="Speichern"
        onCancel={() => shiftInteractions.setPendingTime(null)}
        onConfirm={() => {
          const p = shiftInteractions.pendingTime
          if (p) void shiftInteractions.confirmTime(p)
          shiftInteractions.setPendingTime(null)
        }}
      />

      {shiftInteractions.ghost ? (
        <div
          className="pointer-events-none fixed z-[200] max-w-[220px] rounded-xl border border-cyan-400/50 bg-slate-950/95 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_32px_rgba(34,211,238,0.45)]"
          style={{
            left: shiftInteractions.ghost.x,
            top: shiftInteractions.ghost.y,
            transform: 'translate(-50%, -120%)',
            borderColor: `${shiftInteractions.ghost.color}99`,
            boxShadow: `0 0 36px ${shiftInteractions.ghost.color}66`,
          }}
        >
          {shiftInteractions.ghost.name}
        </div>
      ) : null}

      {view === 'calendar' ? (
        <>
          <ScheduleEmployeeSummaryBar
            employees={scheduleRows}
            weeklyHoursById={hoursByEmployee}
            selectedId={employeeFilter === 'all' ? null : employeeFilter}
            onToggleEmployee={toggleEmployeeFilter}
            assignDragEnabled={canEditPlan}
            onEmployeePointerDownCapture={shiftInteractions.onEmployeePointerDownCapture}
          />
          <div className="grid gap-6 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-9">
              <WeeklyScheduleGrid
                variant="full"
                stationFederalState={federalState}
                weekMonday={weekMonday}
                employees={scheduleRows}
                blocks={gridBlocks}
                onShiftSelect={openEdit}
                shiftEdit={shiftInteractions.shiftEdit}
              />
            </div>
            <div className="space-y-4 xl:col-span-3">
              <ScheduleStatsPanel
                blocks={allBlocks}
                openShifts={openShiftsThisWeek}
                absences={weekAbsencesPanel}
                conflicts={panelConflicts}
                conflictsLoadError={conflictsError}
                employeeHourLabels={employeeHourLabels}
              />
            </div>
          </div>
        </>
      ) : null}

      {view === 'employee' ? (
        <ScheduleViewPlaceholder
          title="Mitarbeiteransicht"
          description="Hier entsteht die zeilenbasierte Mitarbeiteransicht mit Zeitachse. In dieser Phase ist nur die Kalenderansicht befüllt."
        />
      ) : null}

      {view === 'print' ? (
        <ScheduleViewPlaceholder
          title="Druckansicht"
          description="Optimierte Drucklayout-Ansicht (PDF / Druck) wird später ergänzt. Nutzen Sie vorerst die Kalenderansicht."
        />
      ) : null}
    </div>
  )
}
