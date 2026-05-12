import type { TuvReportStatus } from '../../types/tuvReport'

const STATUS_OPTIONS: { value: 'all' | TuvReportStatus; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'draft', label: 'Offen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'printed', label: 'Gedruckt' },
]

export function TuvReportsToolbar({
  year,
  onYear,
  status,
  onStatus,
  stationId,
  onStation,
  stations,
  showStationFilter,
}: {
  year: number
  onYear: (y: number) => void
  status: 'all' | TuvReportStatus
  onStatus: (s: 'all' | TuvReportStatus) => void
  stationId: string
  onStation: (id: string) => void
  stations: { id: string; name: string }[]
  showStationFilter: boolean
}) {
  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 3 + i)
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 p-4">
      {showStationFilter ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--text-muted)]">Station</span>
          <select
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)]"
            value={stationId}
            onChange={(e) => onStation(e.target.value)}
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--text-muted)]">Jahr</span>
        <select
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)]"
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
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--text-muted)]">Status</span>
        <select
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)]"
          value={status}
          onChange={(e) => onStatus(e.target.value as 'all' | TuvReportStatus)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
