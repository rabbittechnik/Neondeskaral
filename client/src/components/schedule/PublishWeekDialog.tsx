import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiGet, apiSend } from '../../services/api'
import { Button } from '../ui/Button'
import { WeekPublicationBadge } from './WeekPublicationBadge'

export type WeekPublicationApi = {
  weekStart: string
  weekEnd: string
  calendarWeek: number
  year: number
  status: 'draft' | 'published'
  publishedAt: string | null
  publishedByDisplayName: string | null
  hasUnpublishedChanges: boolean
}

export type WeekPublishSummary = {
  shiftCount: number
  openShiftCount: number
  employeesWithShifts: number
  conflictCount: number
}

type Props = {
  open: boolean
  onClose: () => void
  stationId: string
  weekMondayIso: string
  weekRangeLabel: string
  calendarWeek: number
  canPublish: boolean
  onChanged: () => void
}

export function PublishWeekDialog({
  open,
  onClose,
  stationId,
  weekMondayIso,
  weekRangeLabel,
  calendarWeek,
  canPublish,
  onChanged,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [publication, setPublication] = useState<WeekPublicationApi | null>(null)
  const [summary, setSummary] = useState<WeekPublishSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !weekMondayIso) return
    setLoading(true)
    setError(null)
    const res = await apiGet<{ publication: WeekPublicationApi; summary: WeekPublishSummary }>(
      '/shifts/week-publication',
      { stationId, weekMonday: weekMondayIso },
    )
    setLoading(false)
    if (!res.ok || !res.data) {
      setError(res.ok === false ? res.error : 'Wochenstatus konnte nicht geladen werden.')
      return
    }
    setPublication(res.data.publication)
    setSummary(res.data.summary)
  }, [stationId, weekMondayIso])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  const runAction = async (action: 'publish' | 'republish' | 'unpublish') => {
    if (!canPublish) return
    setBusy(true)
    setError(null)
    const path = action === 'unpublish' ? '/shifts/unpublish-week' : '/shifts/publish-week'
    const body =
      action === 'publish' || action === 'republish'
        ? { stationId, weekMonday: weekMondayIso, republish: action === 'republish' }
        : { stationId, weekMonday: weekMondayIso }
    const res = await apiSend<{ publication: WeekPublicationApi; summary?: WeekPublishSummary }>(
      'POST',
      path,
      body,
    )
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Aktion fehlgeschlagen.')
      return
    }
    if (res.data?.publication) setPublication(res.data.publication)
    if (res.data?.summary) setSummary(res.data.summary)
    else await load()
    onChanged()
  }

  if (!open) return null

  const isPublished = publication?.status === 'published'
  const hasChanges = publication?.hasUnpublishedChanges ?? false

  return (
    <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) onClose()
          }}
        >
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" aria-hidden />
        <div
          role="dialog"
          aria-modal
          aria-labelledby="publish-week-title"
          className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-md)] border border-cyan-400/25 bg-[var(--bg-card)] shadow-[var(--shadow-card)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
            <div>
              <h2 id="publish-week-title" className="text-lg font-semibold text-[var(--text-main)]">
                Plan veröffentlichen · KW {calendarWeek}
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{weekRangeLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] hover:bg-white/5 disabled:opacity-50"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {error ? (
              <p className="rounded-[var(--radius-sm)] border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">Status</p>
              <div className="mt-2">
                {publication ? (
                  <WeekPublicationBadge
                    status={publication.status}
                    hasUnpublishedChanges={publication.hasUnpublishedChanges}
                  />
                ) : (
                  <WeekPublicationBadge status="draft" hasUnpublishedChanges={false} loading={loading} />
                )}
              </div>
              {publication?.publishedAt ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Zuletzt veröffentlicht: {new Date(publication.publishedAt).toLocaleString('de-DE')}
                  {publication.publishedByDisplayName ? ` · ${publication.publishedByDisplayName}` : ''}
                </p>
              ) : null}
            </div>

            {summary ? (
              <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-3 text-sm">
                <p className="font-medium text-[var(--text-main)]">Zusammenfassung</p>
                <ul className="mt-2 space-y-1 text-[var(--text-muted)]">
                  <li>{summary.shiftCount} Schicht(en) in dieser Woche</li>
                  <li>{summary.openShiftCount} offene Schicht(en)</li>
                  <li>{summary.employeesWithShifts} Mitarbeiter mit Schichten</li>
                  {summary.conflictCount > 0 ? (
                    <li className="text-amber-200/95">{summary.conflictCount} Konflikt-Hinweis(e)</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {!canPublish ? (
              <p className="text-sm text-amber-200/90">
                Du hast keine Berechtigung zum Veröffentlichen des Dienstplans.
              </p>
            ) : null}

            {isPublished && hasChanges ? (
              <p className="text-sm text-amber-100/90">
                Es gibt Änderungen seit der letzten Veröffentlichung. Erneut veröffentlichen, damit die
                Mitarbeiter-App den aktuellen Stand zeigt.
              </p>
            ) : null}

            {!isPublished ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nach der Veröffentlichung sehen Mitarbeiter in der App die Schichten dieser Kalenderwoche.
                Einzelne Schichten bleiben intern als Entwurf markiert; sichtbar ist die Woche als Ganzes.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
            <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
              Schließen
            </Button>
            {canPublish && isPublished ? (
              <Button
                variant="outline"
                type="button"
                disabled={busy || loading}
                onClick={() => void runAction('unpublish')}
              >
                Veröffentlichung zurücknehmen
              </Button>
            ) : null}
            {canPublish && isPublished && hasChanges ? (
              <Button
                variant="primary"
                type="button"
                disabled={busy || loading}
                onClick={() => void runAction('republish')}
              >
                {busy ? 'Bitte warten…' : 'Erneut veröffentlichen'}
              </Button>
            ) : null}
            {canPublish && !isPublished ? (
              <Button
                variant="primary"
                type="button"
                disabled={busy || loading}
                onClick={() => void runAction('publish')}
              >
                {busy ? 'Bitte warten…' : 'Woche veröffentlichen'}
              </Button>
            ) : null}
            {canPublish && isPublished && !hasChanges ? (
              <Button variant="outline" type="button" disabled>
                Bereits veröffentlicht
              </Button>
            ) : null}
          </div>
        </div>
      </div>
  )
}
