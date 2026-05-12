import { useMemo, useState, useEffect } from 'react'
import { Card } from '../ui/Card'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { useEmployees } from '../../context/employees-context'
import { useScheduleShifts } from '../../context/schedule-shifts-context'
import { useTimeTracking } from '../../context/time-tracking-context'
import { buildUpcomingShiftRows, formatMinutesCountdown } from '../../utils/timeTrackingUtils'

export function NextShiftWidget() {
  const { employees } = useEmployees()
  const { shifts } = useScheduleShifts()
  const { timeEntries } = useTimeTracking()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const rows = useMemo(
    () => buildUpcomingShiftRows(employees, shifts, timeEntries, new Date(), 6),
    [employees, shifts, timeEntries, tick],
  )

  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--text-main)]">Wer kommt danach?</h3>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li
            key={`${r.employeeId}-${r.startTime}`}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={r.displayName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-main)]">{r.displayName}</p>
                <p className="text-xs text-[var(--text-muted)]">{r.detail}</p>
                <p className="text-[10px] text-[var(--text-faint)]">
                  {r.presence === 'bereits_anwesend' ? 'bereits anwesend' : 'geplant'}
                </p>
              </div>
            </div>
            <Badge tone="amber">{formatMinutesCountdown(r.minutesUntil)}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  )
}
