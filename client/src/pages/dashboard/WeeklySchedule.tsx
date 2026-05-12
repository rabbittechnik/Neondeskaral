import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { WeeklyScheduleTimeline } from '../../components/schedule/WeeklyScheduleTimeline'
import { ScheduleEmployeeSummaryBar } from '../../components/schedule/ScheduleEmployeeSummaryBar'
import { startOfWeekMonday } from '../../components/schedule/scheduleWeekUtils'
import {
  computeWeeklyHoursByEmployee,
  resolveShiftsForWeekGrid,
  toScheduleEmployeeRow,
} from '../../data/mockSchedule'
import { useStation } from '../../context/station-context'
import { useEmployees } from '../../context/employees-context'
import { useScheduleShifts } from '../../context/schedule-shifts-context'

export function WeeklySchedule() {
  const { selectedStation, federalState } = useStation()
  const { employees } = useEmployees()
  const { shifts, ensureWeekSeeded } = useScheduleShifts()
  const [employeeFilter, setEmployeeFilter] = useState<string>('all')

  const weekMonday = useMemo(() => startOfWeekMonday(new Date()), [])

  useEffect(() => {
    ensureWeekSeeded(weekMonday)
  }, [weekMonday, ensureWeekSeeded])

  const scheduleRows = useMemo(
    () => employees.map(toScheduleEmployeeRow),
    [employees],
  )

  const allBlocks = useMemo(
    () => resolveShiftsForWeekGrid(shifts, weekMonday),
    [shifts, weekMonday],
  )

  const hoursByEmployee = useMemo(() => computeWeeklyHoursByEmployee(allBlocks), [allBlocks])

  const gridBlocks = useMemo(() => {
    let list = allBlocks.filter((b) => b.type !== 'frei' && (b.open || Boolean(b.employeeId)))
    if (employeeFilter !== 'all') {
      list = list.filter((b) => b.open || b.employeeId === employeeFilter)
    }
    return list
  }, [allBlocks, employeeFilter])

  const toggleEmployeeFilter = (id: string) => {
    setEmployeeFilter((prev) => (prev === id ? 'all' : id))
  }

  return (
    <Card
      className="border-cyan-500/25 shadow-[0_0_28px_rgba(34,211,238,0.12)]"
      padding="md"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
            Schichtplan – Diese Woche
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            Aktuelle Wochenplanung für {selectedStation?.name ?? '—'}
          </p>
        </div>
        <Link
          to="/schedule"
          className="shrink-0 rounded-[var(--radius-sm)] border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-center text-sm font-medium text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-500/15"
        >
          Schichtplan bearbeiten
        </Link>
      </div>

      <p className="mb-2 text-[11px] text-[var(--text-faint)]">
        Hinweis: Auf dem Dashboard ist der Plan nur zur Ansicht. Zum Zuweisen und Verschieben von Schichten bitte den Schichtplan öffnen.
      </p>

      <ScheduleEmployeeSummaryBar
        employees={scheduleRows}
        weeklyHoursById={hoursByEmployee}
        selectedId={employeeFilter === 'all' ? null : employeeFilter}
        onToggleEmployee={toggleEmployeeFilter}
        dashboardCompact
      />

      <WeeklyScheduleTimeline
        weekMonday={weekMonday}
        employees={scheduleRows}
        blocks={gridBlocks}
        variant="compact"
        stationFederalState={federalState}
        showTitle={false}
        showLegend={false}
        showFooterLink
      />
    </Card>
  )
}
