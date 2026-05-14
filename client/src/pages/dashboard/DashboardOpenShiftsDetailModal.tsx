import { X } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { OpenShiftWeekSummary } from '../../data/defaultShiftRequirements'
import { Button } from '../../components/ui/Button'

type Props = {
  open: boolean
  onClose: () => void
  summary: OpenShiftWeekSummary
}

function formatDayHeading(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`)
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function slotLabel(shiftType: string): string {
  return shiftType === 'early' ? 'Frühschicht fehlt' : 'Spätschicht fehlt'
}

export function DashboardOpenShiftsDetailModal({ open, onClose, summary }: Props) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  const hasAnything =
    summary.missingRequiredFlat.length > 0 || summary.openDbShifts.length > 0 || summary.totalCount > 0

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
      <div
        className="relative z-[1] flex max-h-[min(92vh,900px)] w-[min(95vw,1200px)] max-w-[1200px] flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xl"
        role="dialog"
        aria-labelledby="open-shifts-modal-title"
      >
        <div className="shrink-0 border-b border-[var(--border-subtle)] p-5 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full border border-white/15 p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 id="open-shifts-modal-title" className="pr-10 text-lg font-semibold text-[var(--text-main)]">
            Offene Schichten diese Woche
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Zählt unbesetzte Schichten in der Datenbank sowie fehlende Soll-Besetzung (Früh/Spät, ±15&nbsp;Min Toleranz).
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        {!hasAnything ? (
          <p className="text-sm text-[var(--text-faint)]">Keine offenen Schichten in dieser Woche.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {summary.missingByDay.length > 0 ? (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Fehlende Soll-Besetzung
                </h3>
                <ul className="mt-3 space-y-4">
                  {summary.missingByDay.map(({ date, items }) => (
                    <li key={date}>
                      <p className="text-sm font-medium capitalize text-[var(--text-main)]">{formatDayHeading(date)}</p>
                      <ul className="mt-2 space-y-2 border-l border-amber-500/30 pl-3">
                        {items.map((m, idx) => (
                          <li key={`${date}-${m.shiftType}-${idx}`} className="text-sm text-[var(--text-muted)]">
                            <span className="text-[var(--text-main)]">· {slotLabel(m.shiftType)}</span>
                            <br />
                            <span className="text-xs">
                              {m.partialGap
                                ? `${m.startTime} – ${m.endTime} Uhr (Lücke)`
                                : m.detailHint ?? `${m.startTime} – ${m.endTime} Uhr`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {summary.openDbShifts.length > 0 ? (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Offene Schichtdatensätze (ohne Mitarbeiter)
                </h3>
                <ul className="mt-3 space-y-2">
                  {summary.openDbShifts.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-[var(--text-main)]"
                    >
                      <span className="font-medium">
                        {s.startTime}–{s.endTime}
                      </span>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">
                        {formatDayHeading(s.date)} · {s.workAreaId}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
        </div>

        <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" disabled title="Funktion folgt">
              Fehlende Schichten als offene Schichten anlegen
            </Button>
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20"
              onClick={onClose}
            >
              Zum Schichtplan
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
