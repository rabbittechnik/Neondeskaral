import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import type { ScheduleEmployeeRow } from '../../types/employee'
import { formatDayMonthDot, WEEKDAY_LABELS_LONG } from './scheduleWeekUtils'
import { sortBlocksForDay, DEFAULT_EMPLOYEE_SHIFT_ACCENT } from './scheduleDayUtils'
import { DayShiftCard } from './DayShiftCard'
import { OpenShiftCard } from './OpenShiftCard'

type Props = {
  dayDate: Date
  dayIndex: number
  isWeekend: boolean
  isToday: boolean
  blocks: ResolvedShiftBlock[]
  employeeById: Map<string, ScheduleEmployeeRow>
  onShiftSelect?: (block: ResolvedShiftBlock) => void
}

export function DayScheduleRow({
  dayDate,
  dayIndex,
  isWeekend,
  isToday,
  blocks,
  employeeById,
  onShiftSelect,
}: Props) {
  const sorted = sortBlocksForDay(blocks)
  const weekday = WEEKDAY_LABELS_LONG[dayIndex] ?? ''

  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--border-subtle)] ${
        isWeekend
          ? 'bg-violet-950/20 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.12)]'
          : 'bg-[var(--bg-card)]'
      }`}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex shrink-0 flex-col gap-1 sm:w-40">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">
              {weekday} {formatDayMonthDot(dayDate)}
            </h3>
            {isToday ? (
              <span className="rounded-full border border-cyan-400/45 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                Heute
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {sorted.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 bg-black/15 px-3 py-4 text-center text-xs text-[var(--text-faint)]">
              Keine geplanten Schichten
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sorted.map((b) =>
                b.open ? (
                  <OpenShiftCard key={b.id} block={b} onSelect={onShiftSelect} />
                ) : (
                  <DayShiftCard
                    key={b.id}
                    block={b}
                    employeeName={
                      b.employeeId
                        ? (employeeById.get(b.employeeId)?.name ?? 'Mitarbeiter')
                        : 'Mitarbeiter'
                    }
                    employeeRole={b.employeeId ? employeeById.get(b.employeeId)?.role : undefined}
                    accentColor={(() => {
                      const row = b.employeeId ? employeeById.get(b.employeeId) : undefined
                      return (b.color?.trim() ? b.color : null) ?? row?.color ?? DEFAULT_EMPLOYEE_SHIFT_ACCENT
                    })()}
                    onSelect={onShiftSelect}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
