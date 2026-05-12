import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeWeeklyHoursByEmployee,
  mockConflicts,
  mockWeekAbsences,
  resolveShiftsForWeekGrid,
  STATION_NAME,
  toISODate,
  toScheduleEmployeeRow,
  type ResolvedShiftBlock,
  type ScheduleShift,
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
import { STATION_FEDERAL_STATE } from '../../data/station'
import { ScheduleAssistantModal } from '../../components/schedule/assistant/ScheduleAssistantModal'

export function SchedulePage() {
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

  const panelConflicts = useMemo(
    () => [...openShiftWarnings(allBlocks), ...mockConflicts],
    [allBlocks],
  )

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
    const saved = await persistShiftUpsert(s)
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

      {view === 'calendar' ? (
        <>
          <ScheduleEmployeeSummaryBar
            employees={scheduleRows}
            weeklyHoursById={hoursByEmployee}
            selectedId={employeeFilter === 'all' ? null : employeeFilter}
            onToggleEmployee={toggleEmployeeFilter}
          />
          <div className="grid gap-6 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-9">
              <WeeklyScheduleGrid
                variant="full"
                stationFederalState={STATION_FEDERAL_STATE}
                weekMonday={weekMonday}
                employees={scheduleRows}
                blocks={gridBlocks}
                onShiftSelect={openEdit}
              />
            </div>
            <div className="space-y-4 xl:col-span-3">
              <ScheduleStatsPanel
                blocks={allBlocks}
                openShifts={openShiftsThisWeek}
                absences={mockWeekAbsences}
                conflicts={panelConflicts}
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
