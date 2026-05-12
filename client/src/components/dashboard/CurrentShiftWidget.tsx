import { useMemo, useState, useEffect } from 'react'
import { Card } from '../ui/Card'
import { Avatar } from '../ui/Avatar'
import { useEmployees } from '../../context/employees-context'
import { useScheduleShifts } from '../../context/schedule-shifts-context'
import { useTimeTracking } from '../../context/time-tracking-context'
import { buildShiftSnapshotRows } from '../../utils/timeTrackingUtils'
import { AttendanceStatusBadge } from './AttendanceStatusBadge'
import { RunningTimeBadge } from './RunningTimeBadge'

export function CurrentShiftWidget() {
  const { employees } = useEmployees()
  const { shifts } = useScheduleShifts()
  const { timeEntries } = useTimeTracking()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const rows = useMemo(
    () => buildShiftSnapshotRows(employees, shifts, timeEntries, new Date()),
    [employees, shifts, timeEntries, tick],
  )

  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--text-main)]">Wer hat jetzt Schicht?</h3>
      <p className="mt-1 text-xs text-[var(--text-faint)]">Geplant vs. Zeiterfassung (Terminal)</p>
      <ul className="mt-4 space-y-4">
        {rows.slice(0, 8).map((r) => (
          <li key={r.employeeId} className="flex gap-3">
            <Avatar name={r.displayName} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--text-main)]">{r.displayName}</span>
                <AttendanceStatusBadge status={r.status} />
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Geplant: {r.plannedLabel}</p>
              {r.actualStartLabel ? (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Anwesend seit: {r.actualStartLabel}</p>
              ) : (
                <p className="mt-0.5 text-xs text-[var(--text-faint)]">{r.statusDetail}</p>
              )}
              {r.runningDurationLabel && r.status === 'läuft' ? (
                <div className="mt-2">
                  <RunningTimeBadge label={r.runningDurationLabel} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
