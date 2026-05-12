import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'
import { STATION } from '../../data/station'
import { canApproveTimeEntries } from '../../utils/timeApproval'
import { Button } from '../../components/ui/Button'
import type { TimeEntry } from '../../types/timeTracking'
import { calculateWorkedMinutes, formatWorkedDuration } from '../../utils/timeTrackingUtils'

type PendingRow = TimeEntry & { employeeDisplayName: string }

type DetailPayload = {
  timeEntry: TimeEntry
  employeeName: string
  checklist: Record<string, unknown> | null
  plannedShift: { id: string; date: string; startTime: string; endTime: string } | null
}

function sourceLabel(source: string): string {
  if (source === 'tablet' || source === 'cash_register_card_terminal') return 'Tablet-Terminal'
  if (source === 'employee_mobile_app') return 'Mitarbeiter-App'
  if (source === 'manual') return 'Manuell'
  return source
}

function approvalBadge(s: string | undefined) {
  if (s === 'approved') return { text: 'Freigegeben', cls: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100' }
  if (s === 'rejected') return { text: 'Abgelehnt', cls: 'border-rose-400/50 bg-rose-500/15 text-rose-100' }
  if (s === 'correction_required') return { text: 'Korrektur nötig', cls: 'border-violet-400/45 bg-violet-500/12 text-violet-100' }
  return { text: 'Wartet auf Freigabe', cls: 'border-amber-400/45 bg-amber-500/12 text-amber-100' }
}

export function TimeApprovalsPage() {
  const { user } = useAuth()
  const allowed = canApproveTimeEntries(user?.id)
  const [items, setItems] = useState<PendingRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [corrOpen, setCorrOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [corrNote, setCorrNote] = useState('')
  const [confirmApprove, setConfirmApprove] = useState(false)

  const load = useCallback(async () => {
    if (!allowed) return
    setLoading(true)
    setErr(null)
    const res = await apiGet<{ items: PendingRow[]; count: number }>('/time-entries/pending-approval', {
      stationId: STATION.id,
    })
    if (!res.ok) {
      setErr(res.error)
      setItems([])
      setCount(0)
    } else {
      setItems(res.data.items ?? [])
      setCount(res.data.count ?? 0)
    }
    setLoading(false)
  }, [allowed])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (id: string) => {
    setBusy(true)
    const res = await apiGet<DetailPayload>(`/time-entries/${encodeURIComponent(id)}/detail`)
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setDetail(res.data)
  }

  const approve = async () => {
    if (!detail) return
    setBusy(true)
    const res = await apiSend<TimeEntry>('POST', `/time-entries/${encodeURIComponent(detail.timeEntry.id)}/approve`, {})
    setBusy(false)
    setConfirmApprove(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setDetail(null)
    await load()
  }

  const reject = async () => {
    if (!detail || !rejectReason.trim()) return
    setBusy(true)
    const res = await apiSend<TimeEntry>('POST', `/time-entries/${encodeURIComponent(detail.timeEntry.id)}/reject`, {
      rejectionReason: rejectReason.trim(),
    })
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setRejectOpen(false)
    setRejectReason('')
    setDetail(null)
    await load()
  }

  const requestCorr = async () => {
    if (!detail || !corrNote.trim()) return
    setBusy(true)
    const res = await apiSend<TimeEntry>(
      'POST',
      `/time-entries/${encodeURIComponent(detail.timeEntry.id)}/request-correction`,
      { correctionNote: corrNote.trim() },
    )
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setCorrOpen(false)
    setCorrNote('')
    setDetail(null)
    await load()
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Zeitfreigaben</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Diese Seite ist nur für Teamleitung freigegeben (Max Vins / Mathias Raselowski).
        </p>
        <Link to="/dashboard" className="text-sm text-cyan-300 hover:underline">
          Zurück zum Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Zeitfreigaben</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Prüfe und bestätige gestempelte Arbeitszeiten, bevor sie für die Abrechnung übernommen werden.
        </p>
      </header>

      {err ? (
        <div className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">{err}</div>
      ) : null}

      <section className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)]/80 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
          <ClipboardCheck className="h-5 w-5 text-cyan-300" aria-hidden />
          <span className="font-medium text-[var(--text-main)]">Offene Zeitfreigaben</span>
          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-100">
            {count}
          </span>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Lade…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Keine offenen Freigaben.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Mitarbeiter</th>
                  <th className="px-3 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Start – Ende</th>
                  <th className="px-3 py-2 font-medium">Dauer</th>
                  <th className="px-3 py-2 font-medium">Quelle</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const mins = calculateWorkedMinutes(row.startAt, row.endAt, new Date())
                  const ab = approvalBadge(row.approvalStatus)
                  return (
                    <tr key={row.id} className="border-b border-[var(--border-subtle)] hover:bg-white/[0.02]">
                      <td className="px-3 py-2 font-medium text-[var(--text-main)]">{row.employeeDisplayName}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{row.startAt.slice(0, 10)}</td>
                      <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">
                        {new Date(row.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {row.endAt
                          ? new Date(row.endAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-cyan-200/85">{formatWorkedDuration(mins)}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{sourceLabel(row.source)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ab.cls}`}>
                          {ab.text}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" variant="outline" className="text-xs" onClick={() => void openDetail(row.id)}>
                          Prüfen
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border border-cyan-500/25 bg-[var(--bg-elevated)] p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Zeitbuchung prüfen</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{detail.employeeName}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Datum</dt>
                <dd className="text-[var(--text-main)]">{detail.timeEntry.startAt.slice(0, 10)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Geplant</dt>
                <dd className="text-[var(--text-main)]">
                  {detail.plannedShift
                    ? `${detail.plannedShift.startTime} – ${detail.plannedShift.endTime}`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Gestempelt</dt>
                <dd className="text-[var(--text-main)] tabular-nums">
                  {new Date(detail.timeEntry.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {detail.timeEntry.endAt
                    ? new Date(detail.timeEntry.endAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Quelle</dt>
                <dd className="text-[var(--text-main)]">{sourceLabel(detail.timeEntry.source)}</dd>
              </div>
            </dl>

            {detail.checklist ? (
              <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-xs text-[var(--text-muted)]">
                <p className="font-semibold text-[var(--text-main)]">Abschluss-Checkliste</p>
                <ul className="mt-2 list-inside list-disc space-y-0.5">
                  <li>Kühlschrank: {detail.checklist.fridgeFronted ? 'Ja' : 'Nein'}</li>
                  <li>Getränke: {detail.checklist.drinksFilled ? 'Ja' : 'Nein'}</li>
                  <li>Zigaretten: {detail.checklist.cigarettesFilled ? 'Ja' : 'Nein'}</li>
                  <li>Regale: {detail.checklist.shelvesFilled ? 'Ja' : 'Nein'}</li>
                  <li>Mülleimer: {detail.checklist.trashEmptied ? 'Ja' : 'Nein'}</li>
                  <li>Kasse sauber: {detail.checklist.counterClean ? 'Ja' : 'Nein'}</li>
                  <li>Backshop: {detail.checklist.coffeeAreaClean ? 'Ja' : 'Nein'}</li>
                  <li>Außen: {detail.checklist.outsideChecked ? 'Ja' : 'Nein'}</li>
                  <li>Vorkommnisse notiert: {detail.checklist.incidentsNoted ? 'Ja' : 'Nein'}</li>
                  <li>Übergabe: {detail.checklist.handoverPossible ? 'Ja' : 'Nein'}</li>
                  <li>Zuschließbar: {detail.checklist.closingReady ? 'Ja' : 'Nein'}</li>
                </ul>
                {String(detail.checklist.incidentNote ?? '').trim() ? (
                  <p className="mt-2 text-[var(--text-faint)]">
                    Bemerkung: {String(detail.checklist.incidentNote)}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setDetail(null)} disabled={busy}>
                Schließen
              </Button>
              <Button type="button" variant="outline" onClick={() => setCorrOpen(true)} disabled={busy}>
                Korrektur nötig
              </Button>
              <Button type="button" variant="outline" className="border-rose-400/40 text-rose-200" onClick={() => setRejectOpen(true)} disabled={busy}>
                Ablehnen
              </Button>
              <Button type="button" variant="primary" onClick={() => setConfirmApprove(true)} disabled={busy}>
                Bestätigen
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmApprove && detail ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-xl border border-emerald-400/35 bg-[var(--bg-card)] p-5">
            <p className="font-semibold text-[var(--text-main)]">Arbeitszeit bestätigen?</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Diese Arbeitszeit wird nach der Bestätigung für die Abrechnung übernommen.
            </p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setConfirmApprove(false)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" className="flex-1" disabled={busy} onClick={() => void approve()}>
                Ja, bestätigen
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectOpen && detail ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-xl border border-rose-400/35 bg-[var(--bg-card)] p-5">
            <p className="font-semibold text-[var(--text-main)]">Arbeitszeit ablehnen</p>
            <label className="mt-3 block text-xs text-[var(--text-muted)]">Grund der Ablehnung (Pflicht)</label>
            <textarea
              className="mt-1 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-2 text-sm"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setRejectOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" className="flex-1" disabled={busy || !rejectReason.trim()} onClick={() => void reject()}>
                Ablehnen
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {corrOpen && detail ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-xl border border-violet-400/35 bg-[var(--bg-card)] p-5">
            <p className="font-semibold text-[var(--text-main)]">Korrektur erforderlich</p>
            <label className="mt-3 block text-xs text-[var(--text-muted)]">Was muss korrigiert werden? (Pflicht)</label>
            <textarea
              className="mt-1 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-2 text-sm"
              rows={3}
              value={corrNote}
              onChange={(e) => setCorrNote(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setCorrOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" className="flex-1" disabled={busy || !corrNote.trim()} onClick={() => void requestCorr()}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
