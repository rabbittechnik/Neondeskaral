import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { WeeklyScheduleTimeline } from '../../components/schedule/WeeklyScheduleTimeline'
import { startOfWeekMonday } from '../../components/schedule/scheduleWeekUtils'
import {
  resolveShiftsForWeekGrid,
  STATION_NAME,
  toScheduleEmployeeRow,
} from '../../data/mockSchedule'
import { STATION_FEDERAL_STATE } from '../../data/station'
import { useEmployees } from '../../context/employees-context'
import { useScheduleShifts } from '../../context/schedule-shifts-context'

export function WeeklySchedule() {
  const { employees } = useEmployees()
  const { shifts, ensureWeekSeeded } = useScheduleShifts()

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

  const gridBlocks = useMemo(
    () => allBlocks.filter((b) => b.type !== 'frei' && (b.open || Boolean(b.employeeId))),
    [allBlocks],
  )

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
            Aktuelle Wochenplanung für {STATION_NAME}
          </p>
        </div>
        <Link
          to="/schedule"
          className="shrink-0 rounded-[var(--radius-sm)] border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-center text-sm font-medium text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-500/15"
        >
          Vollständiger Plan
        </Link>
      </div>

      <WeeklyScheduleTimeline
        weekMonday={weekMonday}
        employees={scheduleRows}
        blocks={gridBlocks}
        variant="compact"
        stationFederalState={STATION_FEDERAL_STATE}
        showTitle={false}
        showLegend={false}
        showFooterLink
      />
    </Card>
  )
}
