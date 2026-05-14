import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ScheduleEmployeeRow } from '../../types/employee'
import type { EmployeePlannedHoursBreakdown } from '../../utils/employeePlannedHours'
import { Users } from 'lucide-react'
import type { TimelineViewportDensity } from './timelineLayout'
import { EmployeeSummaryCard } from './EmployeeSummaryCard'

type Props = {
  employees: ScheduleEmployeeRow[]
  /** Berechnete WoStd. aus dem aktuellen Wochenplan */
  weeklyHoursById: Map<string, number>
  /** Geplante Monatsstunden (Kalendermonat); fehlt die Map → Fallback Profilfeld `monthlyHours` */
  monthlyPlannedHoursById?: Map<string, number>
  /** Optional: gleiche Berechnung wie Zahlen, für Tooltip-Aufschlüsselung */
  weeklyHoursBreakdownById?: Map<string, EmployeePlannedHoursBreakdown>
  monthlyHoursBreakdownById?: Map<string, EmployeePlannedHoursBreakdown>
  /** Entspricht Filter „ein Mitarbeiter“ / Karte aktiv */
  selectedId: string | null
  onToggleEmployee: (id: string) => void
  /** Schmalere Karten (Dashboard) */
  dashboardCompact?: boolean
  /** Automatische Verdichtung unter 1400px / 1200px */
  viewportDensity?: TimelineViewportDensity
  /** Mitarbeiter per Pointer ziehen (nur Schichtplan-Seite + Recht) */
  assignDragEnabled?: boolean
  onEmployeePointerDownCapture?: (e: ReactPointerEvent, employee: ScheduleEmployeeRow) => void
}

export function ScheduleEmployeeSummaryBar({
  employees,
  weeklyHoursById,
  monthlyPlannedHoursById,
  weeklyHoursBreakdownById,
  monthlyHoursBreakdownById,
  selectedId,
  onToggleEmployee,
  dashboardCompact,
  viewportDensity = 'comfort',
  assignDragEnabled,
  onEmployeePointerDownCapture,
}: Props) {
  const n = employees.length
  const layoutTight = n >= 9 || viewportDensity !== 'comfort'
  const manyRows = n > 14

  return (
    <section className="min-w-0 max-w-full rounded-[var(--radius-md)] border border-cyan-500/15 bg-[var(--bg-card)]/75 shadow-[0_0_40px_rgba(34,211,238,0.06),var(--shadow-card)] backdrop-blur-md">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-cyan-300/90" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Mitarbeiter
            </h2>
            <p className="truncate text-[10px] text-[var(--text-faint)]">
              W / M = Schichtplan + genehmigter bezahlter Urlaub (8 Std./Tag, Urlaub ersetzt Schicht am selben Tag) ·
              Karte klicken zum Filtern
              {assignDragEnabled ? ' · Zum Zuweisen Mitarbeiter ziehen' : null}
            </p>
          </div>
        </div>
      </div>

      <div
        className={`min-w-0 p-2 sm:p-2.5 ${manyRows ? 'max-h-[min(38rem,52vh)] overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:thin]' : 'overflow-x-hidden'}`}
      >
        {employees.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
            Keine Mitarbeiter für diese Station angelegt.
          </p>
        ) : (
          <div
            className="grid min-w-0 gap-1.5 sm:gap-2"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 108px), 1fr))',
            }}
          >
            {employees.map((e) => (
              <EmployeeSummaryCard
                key={e.id}
                employee={e}
                weeklyHours={weeklyHoursById.get(e.id) ?? 0}
                monthPlannedHours={
                  monthlyPlannedHoursById !== undefined
                    ? (monthlyPlannedHoursById.get(e.id) ?? 0)
                    : undefined
                }
                weekHoursBreakdown={weeklyHoursBreakdownById?.get(e.id)}
                monthHoursBreakdown={monthlyHoursBreakdownById?.get(e.id)}
                selected={selectedId === e.id}
                compact={Boolean(dashboardCompact)}
                fluid
                viewportDensity={viewportDensity}
                layoutTight={layoutTight}
                onPointerDownCapture={
                  assignDragEnabled && onEmployeePointerDownCapture
                    ? (ev) => onEmployeePointerDownCapture(ev, e)
                    : undefined
                }
                onClick={() => onToggleEmployee(e.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
