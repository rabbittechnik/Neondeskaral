import type { TuvItemStatus, TuvReportItemApi } from '../../types/tuvReport'

const btnBase =
  'rounded-xl border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40'

export function TuvReportItemRow({
  item,
  disabled,
  onChange,
}: {
  item: TuvReportItemApi
  disabled?: boolean
  onChange: (patch: Partial<TuvReportItemApi>) => void
}) {
  const st = (item.status || '') as TuvItemStatus
  const nio = st === 'not_ok'
  return (
    <div
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/80 p-4 shadow-inner ${
        nio ? 'shadow-[0_0_24px_rgba(239,68,68,0.18)] ring-1 ring-red-500/35' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-[var(--text-faint)]">{item.category}</div>
          <div className="mt-1 font-medium text-[var(--text-main)]">{item.question}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ status: 'ok' })}
            className={`${btnBase} ${
              st === 'ok'
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-emerald-400/40 hover:text-emerald-100'
            }`}
          >
            In Ordnung
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ status: 'not_ok' })}
            className={`${btnBase} ${
              st === 'not_ok'
                ? 'border-red-400/70 bg-red-500/20 text-red-100'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-red-400/45 hover:text-red-100'
            }`}
          >
            Nicht in Ordnung
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ status: 'not_applicable' })}
            className={`${btnBase} ${
              st === 'not_applicable'
                ? 'border-slate-400/50 bg-slate-500/20 text-slate-100'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-slate-400/40'
            }`}
          >
            Nicht zutreffend
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--text-muted)]">Bemerkung {nio ? '(Pflicht)' : ''}</span>
          <textarea
            disabled={disabled}
            rows={2}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)]"
            value={item.note}
            onChange={(e) => onChange({ note: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--text-muted)]">Maßnahme {nio ? '(Pflicht)' : ''}</span>
          <textarea
            disabled={disabled}
            rows={2}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)]"
            value={item.actionRequired}
            onChange={(e) => onChange({ actionRequired: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--text-muted)]">Verantwortlich (optional)</span>
          <input
            disabled={disabled}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)]"
            value={item.responsible}
            onChange={(e) => onChange({ responsible: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--text-muted)]">Frist (optional)</span>
          <input
            type="date"
            disabled={disabled}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)]"
            value={item.dueDate}
            onChange={(e) => onChange({ dueDate: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
