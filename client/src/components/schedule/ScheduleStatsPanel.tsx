import { CalendarX2, Clock, UserX } from 'lucide-react'
import type {
  OpenShiftSlot,
  ResolvedShiftBlock,
  ScheduleConflict,
  WeekAbsence,
} from '../../data/mockSchedule'
import { computeWeeklyHoursByEmployee, totalPlannedHours } from '../../data/mockSchedule'
import { Card } from '../ui/Card'
import { ScheduleConflictCard } from './ScheduleConflictCard'

type Props = {
  blocks: ResolvedShiftBlock[]
  openShifts: OpenShiftSlot[]
  absences: WeekAbsence[]
  /** Mock + dynamische Hinweise (z. B. offene Schichten) */
  conflicts: ScheduleConflict[]
  /** Kurzname in Stundenliste (erster Vorname) */
  employeeHourLabels: { id: string; label: string }[]
}

export function ScheduleStatsPanel({
  blocks,
  openShifts,
  absences,
  conflicts,
  employeeHourLabels,
}: Props) {
  const hoursMap = computeWeeklyHoursByEmployee(blocks)
  const total = totalPlannedHours(blocks)
  const avg =
    employeeHourLabels.length > 0
      ? Math.round((total / employeeHourLabels.length) * 10) / 10
      : 0

  return (
    <div className="flex flex-col gap-4">
      <Card padding="md" className="border-cyan-500/20">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
          <CalendarX2 className="h-4 w-4 text-cyan-300" aria-hidden />
          Offene Schichten diese Woche
        </h3>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-200">
          {openShifts.length}
        </p>
        <ul className="mt-3 space-y-2 text-xs text-[var(--text-muted)]">
          {openShifts.map((o) => (
            <li
              key={o.id}
              className="flex justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 last:border-0 last:pb-0"
            >
              <span>
                {o.dayLabel} · {o.workAreaCode}
              </span>
              <span className="text-[var(--text-faint)]">{o.time}</span>
            </li>
          ))}
        </ul>
      </Card>

      <ScheduleConflictCard conflicts={conflicts} />

      <Card padding="md" className="border-pink-500/20">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
          <UserX className="h-4 w-4 text-pink-300" aria-hidden />
          Abwesenheiten diese Woche
        </h3>
        <ul className="mt-3 space-y-2">
          {absences.map((a) => (
            <li
              key={a.id}
              className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-3 py-2 text-xs"
            >
              <p className="font-medium text-[var(--text-main)]">{a.employeeName}</p>
              <p className="text-[var(--text-muted)]">
                {a.type} · {a.range}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="md" className="border-lime-500/20">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
          <Clock className="h-4 w-4 text-lime-300" aria-hidden />
          Gesamtstunden geplant
        </h3>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-lime-200">{total} h</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Summe aller Schichten · Ø {avg} h / Mitarbeiter
        </p>
        <div className="mt-3 max-h-32 space-y-1 overflow-y-auto text-[10px] text-[var(--text-faint)]">
          {employeeHourLabels.map((e) => (
            <div key={e.id} className="flex justify-between tabular-nums">
              <span className="truncate pr-2">{e.label}</span>
              <span>{(hoursMap.get(e.id) ?? 0).toFixed(1)} h</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
