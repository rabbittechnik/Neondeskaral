import type { Employee } from '../types/employee'
import type { ScheduleConflict } from '../data/mockSchedule'

export function formatHoursLimitDe(h: number): string {
  return h.toFixed(2).replace('.', ',')
}

export function isMonthHourLimitExceeded(planned: number, maxHours: number | null | undefined): boolean {
  const cap = maxHours != null ? Number(maxHours) : NaN
  if (!Number.isFinite(cap) || cap <= 0) return false
  return planned > cap + 1e-6
}

export function buildMonthHourLimitConflicts(
  employees: Employee[],
  monthlyPlannedHoursById: Map<string, number>,
): ScheduleConflict[] {
  const out: ScheduleConflict[] = []
  for (const emp of employees) {
    const max = emp.maxHoursPerMonth
    if (max == null || max <= 0) continue
    const planned = monthlyPlannedHoursById.get(emp.id) ?? 0
    if (!isMonthHourLimitExceeded(planned, max)) continue
    out.push({
      id: `month-limit-${emp.id}`,
      message: 'Monatslimit überschritten',
      detail: `${emp.displayName} überschreitet Monatslimit: ${formatHoursLimitDe(planned)} / ${formatHoursLimitDe(max)} Std.`,
    })
  }
  return out
}
