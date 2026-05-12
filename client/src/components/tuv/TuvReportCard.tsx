import type { TuvReportApi } from '../../types/tuvReport'
import { TuvReportStatusBadge } from './TuvReportStatusBadge'
import { monthYearLabelDe } from './tuvReportUtils'

export function TuvReportCard({
  report,
  stationName,
  onOpen,
}: {
  report: TuvReportApi
  stationName: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/80 p-4 text-left shadow-[inset_0_0_20px_rgba(34,211,238,0.04)] transition hover:border-cyan-400/35"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-semibold text-[var(--text-main)]">
            {monthYearLabelDe(report.month, report.year)}
          </div>
          <div className="mt-1 text-sm text-[var(--text-muted)]">{stationName}</div>
        </div>
        <TuvReportStatusBadge status={report.status} />
      </div>
      <div className="mt-3 text-xs text-[var(--text-faint)]">
        Erstellt von {report.createdByName} · {report.createdAt ? new Date(report.createdAt).toLocaleString('de-DE') : '—'}
      </div>
    </button>
  )
}
