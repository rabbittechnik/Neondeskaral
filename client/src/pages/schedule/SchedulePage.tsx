import { useMemo, useState } from 'react'
import {
  computeWeeklyHoursByEmployee,
  employees as allEmployees,
  mockConflicts,
  mockOpenShifts,
  mockWeekAbsences,
  resolveBlocksForWeek,
  STATION_NAME,
} from '../../data/mockSchedule'
import { ScheduleStatsPanel } from '../../components/schedule/ScheduleStatsPanel'
import { ScheduleToolbar } from '../../components/schedule/ScheduleToolbar'
import type { ScheduleViewMode } from '../../components/schedule/ScheduleViewTabs'
import { ScheduleViewTabs } from '../../components/schedule/ScheduleViewTabs'
import { ScheduleViewPlaceholder } from '../../components/schedule/ScheduleViewPlaceholder'
import { ShiftLegend } from '../../components/schedule/ShiftLegend'
import {
  addDays,
  addWeeks,
  formatDE,
  getISOWeek,
  startOfWeekMonday,
  WEEKDAY_LABELS_SHORT,
} from '../../components/schedule/scheduleWeekUtils'
import { WeeklyScheduleGrid } from '../../components/schedule/WeeklyScheduleGrid'

export function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [workAreaFilter, setWorkAreaFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [view, setView] = useState<ScheduleViewMode>('calendar')

  const weekMonday = useMemo(() => {
    const base = startOfWeekMonday(new Date())
    return addWeeks(base, weekOffset)
  }, [weekOffset])

  const weekSunday = useMemo(() => addDays(weekMonday, 6), [weekMonday])
  const isoWeek = useMemo(() => getISOWeek(weekMonday), [weekMonday])

  const allBlocks = useMemo(() => resolveBlocksForWeek(weekMonday), [weekMonday])

  const filteredBlocks = useMemo(() => {
    if (workAreaFilter === 'all') return allBlocks
    return allBlocks.filter(
      (b) => b.type === 'frei' || b.workAreaCode === workAreaFilter,
    )
  }, [allBlocks, workAreaFilter])

  const visibleEmployees = useMemo(() => {
    let list = allEmployees
    if (employeeFilter !== 'all') {
      list = list.filter((e) => e.id === employeeFilter)
    }
    if (workAreaFilter !== 'all') {
      const ids = new Set(
        allBlocks
          .filter((b) => b.type === 'frei' || b.workAreaCode === workAreaFilter)
          .map((b) => b.employeeId),
      )
      list = list.filter((e) => ids.has(e.id))
    }
    return list
  }, [employeeFilter, workAreaFilter, allBlocks])

  const hoursByEmployee = useMemo(
    () => computeWeeklyHoursByEmployee(allBlocks),
    [allBlocks],
  )

  const openShiftsThisWeek = useMemo(() => {
    const dayIndices = [4, 5, 6] as const
    return mockOpenShifts.map((o, i) => {
      const idx = dayIndices[i] ?? 4
      const d = addDays(weekMonday, idx)
      const short = d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
      })
      return {
        ...o,
        dayLabel: `${WEEKDAY_LABELS_SHORT[idx]}, ${short}`,
      }
    })
  }, [weekMonday])

  const stub = () => {
    alert('Funktion folgt mit Backend (Phase 2+).')
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
        onNewShift={stub}
        onPublish={stub}
        onPrint={stub}
        onMore={stub}
      />

      {view === 'calendar' ? (
        <>
          <ShiftLegend />
          <div className="grid gap-6 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-9">
              <WeeklyScheduleGrid
                weekMonday={weekMonday}
                employees={visibleEmployees}
                blocks={filteredBlocks}
                hoursByEmployee={hoursByEmployee}
              />
            </div>
            <div className="space-y-4 xl:col-span-3">
              <ScheduleStatsPanel
                blocks={allBlocks}
                openShifts={openShiftsThisWeek}
                absences={mockWeekAbsences}
                conflicts={mockConflicts}
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
