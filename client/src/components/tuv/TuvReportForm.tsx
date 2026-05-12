import type { TuvReportDetail } from '../../types/tuvReport'
import { TuvReportItemRow } from './TuvReportItemRow'
import { TuvReportSignaturePad } from './TuvReportSignaturePad'
import { TuvReportConfirmationBox } from './TuvReportConfirmationBox'
import { monthYearLabelDe } from './tuvReportUtils'

export function TuvReportForm({
  detail,
  stationName,
  readOnly,
  manageUnlock,
  onChangeReport,
  onChangeItem,
  signatureDraft,
  onSignatureDraft,
  onConfirmClick,
  confirmBusy,
  canSign,
}: {
  detail: TuvReportDetail
  stationName: string
  readOnly?: boolean
  manageUnlock?: boolean
  onChangeReport: (patch: Partial<TuvReportDetail['report']>) => void
  onChangeItem: (id: string, patch: Partial<TuvReportDetail['items'][0]>) => void
  signatureDraft: string
  onSignatureDraft: (v: string) => void
  onConfirmClick: () => void | Promise<void>
  confirmBusy?: boolean
  canSign?: boolean
}) {
  const { report, items } = detail
  const answered = items.filter((i) => Boolean(i.status && i.status.trim())).length
  const locked = readOnly || report.status === 'completed' || report.status === 'printed'
  const effectiveReadOnly = locked && !manageUnlock
  const alreadyConfirmed = Boolean(report.confirmedAt?.trim() || report.signatureDataUrl?.trim())

  return (
    <div className="space-y-8 tuv-no-print">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 p-5 shadow-[inset_0_0_40px_rgba(34,211,238,0.04)]">
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Bereich 1 · Allgemeine Daten</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-[var(--text-faint)]">Station</div>
            <div className="text-sm font-medium text-[var(--text-main)]">{stationName}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-faint)]">Monat / Jahr</div>
            <div className="text-sm font-medium text-[var(--text-main)]">{monthYearLabelDe(report.month, report.year)}</div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Datum der Kontrolle</span>
            <input
              type="date"
              disabled={effectiveReadOnly}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
              value={report.reportDate?.slice(0, 10) ?? ''}
              onChange={(e) => onChangeReport({ reportDate: e.target.value })}
            />
          </label>
          <div>
            <div className="text-xs text-[var(--text-faint)]">Durchgeführt von</div>
            <div className="text-sm text-[var(--text-main)]">{report.createdByName}</div>
          </div>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-[var(--text-muted)]">Rolle</span>
            <input
              disabled={effectiveReadOnly}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
              value={report.inspectorRole}
              onChange={(e) => onChangeReport({ inspectorRole: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-[var(--text-muted)]">Wetter / besondere Umstände (optional)</span>
            <input
              disabled={effectiveReadOnly}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
              value={report.weatherNote}
              onChange={(e) => onChangeReport({ weatherNote: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-[var(--text-muted)]">Allgemeine Bemerkung</span>
            <textarea
              disabled={effectiveReadOnly}
              rows={3}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
              value={report.generalNote}
              onChange={(e) => onChangeReport({ generalNote: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">Bereich 2 · Kontrollpunkte</h2>
          <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100">
            {answered} von {items.length} Punkten geprüft
          </div>
        </div>
        <div className="space-y-3">
          {items.map((it) => (
            <TuvReportItemRow
              key={it.id}
              item={it}
              disabled={effectiveReadOnly}
              onChange={(patch) => onChangeItem(it.id, patch)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 p-5">
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Unterschrift / Bestätigung</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Entweder Unterschrift setzen oder den Bestätigungsbutton nutzen (vor Abschluss des Berichts).
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="text-sm font-medium text-[var(--text-main)]">Variante A · Unterschrift</div>
            <TuvReportSignaturePad
              value={signatureDraft || report.signatureDataUrl}
              onChange={onSignatureDraft}
              disabled={effectiveReadOnly || !canSign}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--text-main)]">Variante B · Bestätigung</div>
            <div className="mt-2">
              <TuvReportConfirmationBox
                alreadyConfirmed={alreadyConfirmed}
                disabled={effectiveReadOnly || !canSign}
                busy={confirmBusy}
                onConfirm={onConfirmClick}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
