export function TuvReportMonthPicker({
  month,
  year,
  onMonth,
  onYear,
  disabled,
}: {
  month: number
  year: number
  onMonth: (m: number) => void
  onYear: (y: number) => void
  disabled?: boolean
}) {
  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 3 + i)
  return (
    <div className="flex flex-wrap gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--text-muted)]">Monat</span>
        <select
          disabled={disabled}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-[var(--text-primary)]"
          value={month}
          onChange={(e) => onMonth(Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m.toString().padStart(2, '0')}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--text-muted)]">Jahr</span>
        <select
          disabled={disabled}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-[var(--text-primary)]"
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
