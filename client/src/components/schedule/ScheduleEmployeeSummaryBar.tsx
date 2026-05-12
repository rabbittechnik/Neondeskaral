import type { ScheduleEmployeeRow } from '../../types/employee'
import { Users } from 'lucide-react'
import { EmployeeSummaryCard } from './EmployeeSummaryCard'

type Props = {
  employees: ScheduleEmployeeRow[]
  /** Berechnete WoStd. aus dem aktuellen Wochenplan */
  weeklyHoursById: Map<string, number>
  /** Entspricht Filter „ein Mitarbeiter“ / Karte aktiv */
  selectedId: string | null
  onToggleEmployee: (id: string) => void
}

export function ScheduleEmployeeSummaryBar({
  employees,
  weeklyHoursById,
  selectedId,
  onToggleEmployee,
}: Props) {
  return (
    <section className="rounded-[var(--radius-md)] border border-cyan-500/15 bg-[var(--bg-card)]/75 shadow-[0_0_40px_rgba(34,211,238,0.06),var(--shadow-card)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 shrink-0 text-cyan-300/90" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Mitarbeiter
            </h2>
            <p className="truncate text-[10px] text-[var(--text-faint)]">
              W = Woche aus Plan · M = Dummy-Monatsstunden · Karte klicken zum Filtern
            </p>
          </div>
        </div>
      </div>

      <div className="p-2.5">
        <div
          className="flex gap-2 overflow-x-auto scroll-smooth pb-1 pt-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.35)_transparent] hover:[scrollbar-color:rgba(34,211,238,0.55)_transparent]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {employees.map((e) => (
            <EmployeeSummaryCard
              key={e.id}
              employee={e}
              weeklyHours={weeklyHoursById.get(e.id) ?? 0}
              selected={selectedId === e.id}
              onClick={() => onToggleEmployee(e.id)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
