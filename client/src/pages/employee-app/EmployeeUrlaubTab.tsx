import { useMemo, useState } from 'react'
import { Palmtree } from 'lucide-react'
import type { AbsenceType } from '../../types/absence'
import { ABSENCE_TYPE_LABELS, ABSENCE_STATUS_LABELS } from '../../components/absences/absenceLabels'
import { Button } from '../../components/ui/Button'
import { employeeAccessPostJson } from '../../services/api'
import { countAbsenceDays } from '../../utils/absenceQueries'
import { formatDateDE } from '../../utils/dateFormat'
import type { Absence } from '../../types/absence'

export type EmployeeAbsenceRow = {
  id: string
  type: string
  startDate: string
  endDate: string
  halfDay?: boolean
  status: string
  comment?: string
  requestedAt?: string
  approvedAt?: string
  rejectedReason?: string
}

const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: 'vacation', label: 'Urlaub' },
  { value: 'day_off', label: 'Frei' },
  { value: 'sick', label: 'Krank' },
  { value: 'special_leave', label: 'Sonderurlaub' },
  { value: 'child_sick', label: 'Kind krank' },
  { value: 'unpaid', label: 'Unbezahlt' },
  { value: 'other', label: 'Sonstiges' },
]

function typeLabelDe(t: string): string {
  return ABSENCE_TYPE_LABELS[t as AbsenceType] ?? t
}

function statusPresentation(status: string): { label: string; className: string } {
  const label = ABSENCE_STATUS_LABELS[status as keyof typeof ABSENCE_STATUS_LABELS] ?? status
  if (status === 'beantragt')
    return { label, className: 'border-amber-400/40 bg-amber-500/15 text-amber-100' }
  if (status === 'genehmigt')
    return { label, className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' }
  if (status === 'abgelehnt')
    return { label, className: 'border-rose-400/45 bg-rose-500/15 text-rose-100' }
  if (status === 'storniert')
    return { label, className: 'border-white/15 bg-white/5 text-slate-400' }
  return { label, className: 'border-white/10 bg-white/5 text-slate-300' }
}

type Props = {
  accessToken: string
  absences: EmployeeAbsenceRow[]
  onReload: () => Promise<void>
}

export function EmployeeUrlaubTab({ accessToken, absences, onReload }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [type, setType] = useState('vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [halfDay, setHalfDay] = useState(false)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const sorted = useMemo(() => {
    return [...absences].sort((a, b) => String(b.requestedAt ?? '').localeCompare(String(a.requestedAt ?? '')))
  }, [absences])

  const roughDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0
    return countAbsenceDays(startDate, endDate, halfDay)
  }, [startDate, endDate, halfDay])

  const resetForm = () => {
    setType('vacation')
    setStartDate('')
    setEndDate('')
    setHalfDay(false)
    setComment('')
    setErr(null)
  }

  const submit = async () => {
    setBusy(true)
    setErr(null)
    const res = await employeeAccessPostJson<Absence>(accessToken, 'absences', {
      type,
      startDate,
      endDate,
      halfDay,
      comment: comment.trim() || undefined,
    })
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      setConfirmOpen(false)
      return
    }
    setConfirmOpen(false)
    setFormOpen(false)
    resetForm()
    setOkMsg('Dein Antrag wurde gesendet und wartet auf Prüfung.')
    await onReload()
  }

  return (
    <section className="mt-5 space-y-5">
      {okMsg ? (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {okMsg}
          <button type="button" className="ml-3 underline" onClick={() => setOkMsg(null)}>
            OK
          </button>
        </div>
      ) : null}
      {err ? (
        <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{err}</div>
      ) : null}

      <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-cyan-200">Neuer Antrag</h2>
        <p className="mt-1 text-xs text-slate-500">Urlaub oder andere Abwesenheit beantragen.</p>
        <Button
          type="button"
          variant="primary"
          className="mt-4 min-h-[52px] w-full py-3 text-base font-semibold sm:w-auto"
          onClick={() => {
            resetForm()
            setFormOpen(true)
          }}
        >
          Urlaubsantrag stellen
        </Button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-cyan-200">Meine Anträge</h2>
        {sorted.length === 0 ? (
          <p className="mt-2 text-slate-400">Noch keine Anträge.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sorted.map((a) => {
              const st = statusPresentation(a.status)
              return (
                <li key={a.id} className={`rounded-xl border px-4 py-3 text-sm ${st.className}`}>
                  <div className="flex items-start gap-2">
                    <Palmtree className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">
                        {formatDateDE(a.startDate)} – {formatDateDE(a.endDate)}
                      </p>
                      <p className="mt-1 text-xs text-slate-200/90">
                        {typeLabelDe(a.type)} · {st.label}
                      </p>
                      {a.comment ? <p className="mt-2 text-xs text-slate-300">„{a.comment}“</p> : null}
                      {a.requestedAt ? (
                        <p className="mt-2 text-[11px] text-slate-400">
                          Beantragt: {formatDateDE(a.requestedAt.slice(0, 10))}
                          {a.requestedAt.length > 10 ? ` · ${a.requestedAt.slice(11, 16)}` : ''}
                        </p>
                      ) : null}
                      {a.status === 'abgelehnt' && a.rejectedReason ? (
                        <p className="mt-2 text-xs text-rose-200/95">Abgelehnt: {a.rejectedReason}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[118] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-cyan-500/30 bg-slate-950 p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="text-lg font-semibold text-white">Urlaubsantrag</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Typ</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base text-white"
                >
                  {REQUEST_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Startdatum</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Enddatum</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base text-white"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={halfDay}
                  onChange={(e) => setHalfDay(e.target.checked)}
                  className="h-5 w-5 rounded border-white/20 bg-black/40"
                />
                Halbtägig
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Grund / Kommentar optional</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Grund / Kommentar optional"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-base text-white placeholder:text-slate-600"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-[48px] flex-1" onClick={() => setFormOpen(false)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                className="min-h-[48px] flex-1"
                disabled={busy || !startDate || !endDate || endDate < startDate}
                onClick={() => setConfirmOpen(true)}
              >
                Antrag absenden
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/35 bg-slate-900 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Urlaubsantrag absenden?</h2>
            <p className="mt-2 text-sm text-slate-300">Möchtest du diesen Antrag wirklich absenden?</p>
            <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-sm text-slate-100">
              <p>
                <span className="text-slate-500">Zeitraum:</span>{' '}
                {startDate && endDate ? (
                  <>
                    {formatDateDE(startDate)} – {formatDateDE(endDate)}
                  </>
                ) : (
                  '—'
                )}
              </p>
              <p>
                <span className="text-slate-500">Typ:</span> {REQUEST_TYPES.find((x) => x.value === type)?.label}
              </p>
              <p>
                <span className="text-slate-500">Ca. Tage:</span> {roughDays || '—'}
                {halfDay && startDate === endDate ? ' (halber Tag)' : ''}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" className="flex-1" disabled={busy} onClick={() => void submit()}>
                Antrag absenden
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
