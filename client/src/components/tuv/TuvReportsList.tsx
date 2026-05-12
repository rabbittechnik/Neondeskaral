import type { TuvReportApi } from '../../types/tuvReport'
import { TuvReportStatusBadge } from './TuvReportStatusBadge'
import { monthYearLabelDe } from './tuvReportUtils'

export function TuvReportsList({
  rows,
  stationNames,
  onOpen,
  onEdit,
  onPrint,
  onDelete,
  canDelete,
}: {
  rows: TuvReportApi[]
  stationNames: Record<string, string>
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onPrint: (id: string) => void
  onDelete?: (id: string) => void
  canDelete?: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-1)]/50 px-6 py-12 text-center text-sm text-[var(--text-muted)]">
        Keine TÜV-Berichte für die gewählten Filter.
      </div>
    )
  }
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/60 md:block">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-wide text-[var(--text-faint)]">
          <tr>
            <th className="px-4 py-3">Monat / Jahr</th>
            <th className="px-4 py-3">Station</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Erstellt von</th>
            <th className="px-4 py-3">Erstellt am</th>
            <th className="px-4 py-3">Abgeschlossen am</th>
            <th className="px-4 py-3">Bestätigt von</th>
            <th className="px-4 py-3 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--border-subtle)]/60 last:border-0">
              <td className="px-4 py-3 font-medium text-[var(--text-main)]">
                {monthYearLabelDe(r.month, r.year)}
              </td>
              <td className="px-4 py-3 text-[var(--text-muted)]">{stationNames[r.stationId] ?? r.stationId}</td>
              <td className="px-4 py-3">
                <TuvReportStatusBadge status={r.status} />
              </td>
              <td className="px-4 py-3 text-[var(--text-muted)]">{r.createdByName}</td>
              <td className="px-4 py-3 text-[var(--text-muted)]">
                {r.createdAt ? new Date(r.createdAt).toLocaleString('de-DE') : '—'}
              </td>
              <td className="px-4 py-3 text-[var(--text-muted)]">
                {r.completedAt ? new Date(r.completedAt).toLocaleString('de-DE') : '—'}
              </td>
              <td className="px-4 py-3 text-[var(--text-muted)]">
                {r.confirmedByName ? (
                  <>
                    {r.confirmedByName}
                    <div className="text-xs text-[var(--text-faint)]">
                      {r.confirmedAt ? new Date(r.confirmedAt).toLocaleString('de-DE') : ''}
                    </div>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs hover:bg-white/5"
                  >
                    Öffnen
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(r.id)}
                    className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs hover:bg-white/5"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrint(r.id)}
                    className="rounded-lg border border-cyan-400/35 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10"
                  >
                    Drucken
                  </button>
                  {canDelete && onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      className="rounded-lg border border-red-400/40 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10"
                    >
                      Löschen
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
