import type { Employee, ResolvedShiftBlock } from '../../data/mockSchedule'
import { formatDE, weekDayDates, WEEKDAY_LABELS_SHORT } from './scheduleWeekUtils'
import { ShiftCard } from './ShiftCard'
import { EmployeeRow } from './EmployeeRow'

type Props = {
  weekMonday: Date
  employees: Employee[]
  blocks: ResolvedShiftBlock[]
  hoursByEmployee: Map<string, number>
}

function groupByEmployeeDay(blocks: ResolvedShiftBlock[]) {
  const map = new Map<string, Map<number, ResolvedShiftBlock[]>>()
  for (const b of blocks) {
    if (!map.has(b.employeeId)) map.set(b.employeeId, new Map())
    const inner = map.get(b.employeeId)!
    if (!inner.has(b.dayIndex)) inner.set(b.dayIndex, [])
    inner.get(b.dayIndex)!.push(b)
  }
  return map
}

export function WeeklyScheduleGrid({
  weekMonday,
  employees,
  blocks,
  hoursByEmployee,
}: Props) {
  const days = weekDayDates(weekMonday)
  const grouped = groupByEmployeeDay(blocks)

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
      <div
        className="min-w-[1040px] grid gap-px bg-[var(--border-subtle)]"
        style={{
          gridTemplateColumns: `220px repeat(7, minmax(0, 1fr))`,
        }}
      >
        <div className="sticky left-0 z-20 bg-[var(--bg-sidebar)] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Mitarbeiter
        </div>
        {days.map((d, i) => (
          <div
            key={toISODateLocal(d)}
            className="bg-[var(--bg-elevated)] px-2 py-3 text-center"
          >
            <div className="text-xs font-semibold text-[var(--text-main)]">
              {WEEKDAY_LABELS_SHORT[i]}
            </div>
            <div className="text-[10px] text-[var(--text-faint)]">{formatDE(d)}</div>
          </div>
        ))}

        {employees.map((emp) => {
          const rowMap = grouped.get(emp.id)
          const h = hoursByEmployee.get(emp.id) ?? 0
          return (
            <EmployeeRow key={emp.id} employee={emp} weeklyHours={h}>
              {days.map((d, di) => {
                const cellBlocks = rowMap?.get(di as 0 | 1 | 2 | 3 | 4 | 5 | 6) ?? []
                return (
                  <div
                    key={`${emp.id}-${toISODateLocal(d)}`}
                    className="min-h-[88px] border-b border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5 align-top"
                  >
                    <div className="flex flex-col gap-1">
                      {cellBlocks.length === 0 ? (
                        <div className="flex h-full min-h-[72px] items-center justify-center rounded-[8px] border border-dashed border-white/10 text-[10px] text-[var(--text-faint)]">
                          —
                        </div>
                      ) : (
                        cellBlocks.map((b, idx) => (
                          <ShiftCard key={`${b.dateISO}-${b.start}-${b.type}-${idx}`} block={b} />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </EmployeeRow>
          )
        })}
      </div>
    </div>
  )
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
