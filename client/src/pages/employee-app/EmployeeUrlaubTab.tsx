import { useEffect, useMemo, useState } from 'react'
import { Palmtree } from 'lucide-react'
import { ABSENCE_TYPE_LABELS, ABSENCE_STATUS_LABELS } from '../../components/absences/absenceLabels'
import { Button } from '../../components/ui/Button'
import { employeeAccessGetQuery, employeeAccessPostJson } from '../../services/api'
import { countAbsenceDays } from '../../utils/absenceQueries'
import { formatDateDE, formatDateTimeDE } from '../../utils/dateFormat'
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
  paid?: boolean
  paidHoursPerDay?: number
  paidHoursTotal?: number
  absenceDays?: number
  certificateSource?: string
}

const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: 'paid_vacation', label: 'Bezahlter Urlaub' },
  { value: 'unpaid_vacation', label: 'Unbezahlter Urlaub' },
  { value: 'day_off', label: 'Frei' },
  { value: 'special_leave', label: 'Sonderurlaub' },
  { value: 'other', label: 'Sonstiges' },
]

function employeeVisibleAbsenceComment(c?: string): string | undefined {
  const raw = String(c ?? '').trim()
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  if (lower.includes('stationguide_import')) return undefined
  if (lower.includes('grauem balken')) return undefined
  if (lower.includes('stationguide') && (lower.includes('übernommen') || lower.includes('uebernommen'))) return undefined
  if (/\[stationguide[\w_-]*\]/i.test(raw)) return undefined
  return raw
}

function formatRequestedAtDe(iso: string): string {
  const s = String(iso).trim()
  if (!s) return '—'
  const datePart = s.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return s
  const hm = /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/.exec(s)
  if (hm) return `${formatDateDE(hm[1])} · ${hm[2]}`
  return formatDateDE(datePart)
}

function typeLabelDe(t: string): string {
  const map = ABSENCE_TYPE_LABELS as Record<string, string>
  return map[t] ?? t
}

function statusPresentation(status: string): { label: string; className: string } {
  const label = ABSENCE_STATUS_LABELS[status as keyof typeof ABSENCE_STATUS_LABELS] ?? status
  if (status === 'beantragt')
    return { label, className: 'border-amber-400/40 bg-amber-500/15 text-amber-100' }
  if (status === 'genehmigt' || status === 'erfasst')
    return { label, className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' }
  if (status === 'abgelehnt')
    return { label, className: 'border-rose-400/45 bg-rose-500/15 text-rose-100' }
  if (status === 'storniert')
    return { label, className: 'border-white/15 bg-white/5 text-slate-400' }
  return { label, className: 'border-white/10 bg-white/5 text-slate-300' }
}

type VacationSnap = {
  year: number
  annualVacationDays: number
  approvedPaidVacationDays: number
  pendingPaidVacationDays: number
  remainingPaidVacationDays: number
}

type VacationBalanceApi = VacationSnap & {
  appliesHolidayExclusion?: boolean
  preview?: {
    calendarDays: number
    workingDays: number
    holidaysExcluded: number
    holidayDetails?: { date: string; name: string }[]
    vacationDaysToDeduct: number
    paidHoursPerDay: number
    paidHours: number
    warnings: string[]
    exceedsVacation?: boolean
    remainingAfterRequest?: number
    remainingVacationDays?: number
  }
}

type Props = {
  accessToken: string
  absences: EmployeeAbsenceRow[]
  vacationSnapshot?: VacationSnap
  annualVacationDays?: number | null
  onReload: () => Promise<void>
}

function isVacationListType(t: string): boolean {
  return t !== 'sick' && t !== 'child_sick'
}

export function EmployeeUrlaubTab({ accessToken, absences, vacationSnapshot, annualVacationDays, onReload }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [type, setType] = useState('paid_vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [halfDay, setHalfDay] = useState(false)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [vacationAckRequired, setVacationAckRequired] = useState<Record<string, unknown> | null>(null)
  const [liveBalance, setLiveBalance] = useState<VacationBalanceApi | null>(null)

  const sorted = useMemo(() => {
    return [...absences]
      .filter((a) => isVacationListType(a.type))
      .sort((a, b) => String(b.requestedAt ?? '').localeCompare(String(a.requestedAt ?? '')))
  }, [absences])

  useEffect(() => {
    if (!formOpen || !startDate || !endDate || endDate < startDate) {
      setLiveBalance(null)
      return
    }
    let cancelled = false
    const tmr = window.setTimeout(() => {
      void (async () => {
        const res = await employeeAccessGetQuery<VacationBalanceApi>(accessToken, 'vacation-balance', {
          previewStart: startDate,
          previewEnd: endDate,
          previewHalfDay: halfDay ? 'true' : 'false',
          previewType: type,
        })
        if (cancelled) return
        if (res.ok && res.data) setLiveBalance(res.data)
        else setLiveBalance(null)
      })()
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(tmr)
    }
  }, [formOpen, startDate, endDate, halfDay, type, accessToken])

  const snap = vacationSnapshot
  const preview = liveBalance?.preview

  const vacationShortagePaid =
    type === 'paid_vacation' &&
    (preview?.exceedsVacation === true ||
      (preview?.remainingAfterRequest != null && preview.remainingAfterRequest < -0.0001))

  const resetForm = () => {
    setType('paid_vacation')
    setStartDate('')
    setEndDate('')
    setHalfDay(false)
    setComment('')
    setErr(null)
    setVacationAckRequired(null)
    setLiveBalance(null)
  }

  const submit = async (withAck: boolean) => {
    setBusy(true)
    setErr(null)
    const body: Record<string, unknown> = {
      type,
      startDate,
      endDate,
      halfDay,
      comment: comment.trim() || undefined,
    }
    if (type === 'paid_vacation' && withAck) body.acknowledgeVacationDebt = true
    const res = await employeeAccessPostJson<Absence>(accessToken, 'absences', body)
    setBusy(false)
    if (!res.ok) {
      const ext = res as { httpStatus?: number; code?: string; details?: Record<string, unknown>; error?: string }
      if (ext.httpStatus === 409 && ext.code === 'VACATION_ACK_REQUIRED') {
        setVacationAckRequired(ext.details ?? {})
        setConfirmOpen(true)
        return
      }
      setErr(typeof ext.error === 'string' ? ext.error : 'Antrag konnte nicht gesendet werden.')
      setConfirmOpen(false)
      return
    }
    setConfirmOpen(false)
    setFormOpen(false)
    resetForm()
    setOkMsg('Dein Antrag wurde gesendet und wartet auf Prüfung.')
    await onReload()
  }

  const confirmIntroText = () => {
    if (vacationAckRequired) {
      return String(
        vacationAckRequired.message ??
          'Der Antrag würde dein Urlaubskonto ins Minus bringen. Der fehlende Urlaub kann ggf. vom Folgejahr abgezogen werden.',
      )
    }
    if (type !== 'paid_vacation') {
      return 'Möchtest du diesen Antrag wirklich absenden?'
    }
    const d0 = preview?.vacationDaysToDeduct ?? countAbsenceDays(startDate, endDate, halfDay)
    const hol = preview?.holidaysExcluded ?? 0
    if (hol > 0) {
      return `Du beantragst bezahlten Urlaub vom ${formatDateDE(startDate)} bis ${formatDateDE(endDate)}. Im Zeitraum liegt ${hol} Feiertag${hol === 1 ? '' : 'e'}. Dieser wird nicht vom Urlaubskontingent abgezogen. Es werden voraussichtlich ${d0.toFixed(1).replace('.', ',')} Urlaubstage abgezogen.`
    }
    return `Du beantragst bezahlten Urlaub vom ${formatDateDE(startDate)} bis ${formatDateDE(endDate)}. Es werden voraussichtlich ${d0.toFixed(1).replace('.', ',')} Urlaubstage abgezogen.`
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
        <h2 className="text-sm font-semibold text-cyan-200">Dein Urlaubskonto</h2>
        {snap ? (
          <dl className="mt-3 space-y-1 text-xs text-slate-300">
            <div className="flex justify-between gap-2">
              <dt>Jahresurlaub</dt>
              <dd className="font-medium text-cyan-100">{snap.annualVacationDays.toFixed(1).replace('.', ',')} Tage</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Genommen / genehmigt</dt>
              <dd>{snap.approvedPaidVacationDays.toFixed(1).replace('.', ',')} Tage</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Offen beantragt</dt>
              <dd>{snap.pendingPaidVacationDays.toFixed(1).replace('.', ',')} Tage</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-white/10 pt-2">
              <dt className="font-semibold text-slate-200">Verfügbar</dt>
              <dd
                className={
                  snap.remainingPaidVacationDays < 0 ? 'font-semibold text-rose-300' : 'font-semibold text-cyan-100'
                }
              >
                {snap.remainingPaidVacationDays.toFixed(1).replace('.', ',')} Tage
              </dd>
            </div>
          </dl>
        ) : annualVacationDays != null && Number.isFinite(Number(annualVacationDays)) ? (
          <p className="mt-2 text-xs text-slate-400">Jahresurlaub laut Profil: {Number(annualVacationDays).toFixed(1).replace('.', ',')} Tage</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Urlaubskonto wird geladen, sobald dein Profil vollständig ist.</p>
        )}

        <h2 className="mt-6 text-sm font-semibold text-cyan-200">Neuer Urlaubsantrag</h2>
        <p className="mt-1 text-xs text-slate-500">Nur Urlaub und Abwesenheit — Krankmeldungen unter „Krank“.</p>
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
        <h2 className="text-sm font-semibold text-cyan-200">Meine Urlaubs- & Abwesenheitsanträge</h2>
        {sorted.length === 0 ? (
          <p className="mt-2 text-slate-400">Noch keine Anträge.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sorted.map((a) => {
              const st = statusPresentation(a.status)
              const visComment = employeeVisibleAbsenceComment(a.comment)
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
                      {a.type === 'unpaid_vacation' ? (
                        <p className="mt-1 text-[11px] text-slate-400">Unbezahlt · zählt nicht gegen Urlaubsanspruch</p>
                      ) : null}
                      {visComment ? <p className="mt-2 text-xs text-slate-300">„{visComment}“</p> : null}
                      {a.requestedAt ? (
                        <p className="mt-2 text-[11px] text-slate-400">Beantragt: {formatRequestedAtDe(a.requestedAt)}</p>
                      ) : null}
                      {(a.status === 'genehmigt' || a.status === 'erfasst') && a.approvedAt ? (
                        <p className="mt-1 text-[11px] text-slate-400">Genehmigt: {formatDateTimeDE(a.approvedAt)}</p>
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
              {type === 'unpaid_vacation' ? (
                <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/40 px-3 py-2 text-xs text-cyan-100/95">
                  Unbezahlter Urlaub wird nicht von deinem Urlaubsanspruch abgezogen.
                </div>
              ) : null}
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

              {startDate && endDate && endDate >= startDate && preview ? (
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-xs text-slate-200">
                  <p className="font-medium text-cyan-100/95">Vorschau (vom System berechnet)</p>
                  <p className="mt-2">
                    Zeitraum: {formatDateDE(startDate)} – {formatDateDE(endDate)}
                  </p>
                  <p className="mt-1">Kalendertage: {preview.calendarDays.toFixed(1).replace('.', ',')}</p>
                  {type === 'paid_vacation' ? (
                    <>
                      <p className="mt-1">
                        Abziehbare Urlaubstage: {preview.vacationDaysToDeduct.toFixed(1).replace('.', ',')}
                      </p>
                      <p className="mt-1">Feiertage im Zeitraum (ohne Abzug): {preview.holidaysExcluded}</p>
                      {snap ? (
                        <p className="mt-1">
                          Verfügbarer Urlaub: {snap.remainingPaidVacationDays.toFixed(1).replace('.', ',')} Tage · Rest nach
                          Antrag:{' '}
                          {(preview.remainingAfterRequest ?? snap.remainingPaidVacationDays).toFixed(1).replace('.', ',')}{' '}
                          Tage
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 text-slate-400">Für diesen Typ werden keine Urlaubstage automatisch abgezogen.</p>
                  )}
                  {preview.warnings?.length ? (
                    <ul className="mt-2 list-inside list-disc space-y-0.5 text-amber-100/95">
                      {preview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {type === 'paid_vacation' && vacationShortagePaid ? (
                <div className="rounded-lg border border-amber-500/45 bg-amber-950/50 px-3 py-3 text-xs text-amber-100">
                  <p className="font-semibold text-amber-50">
                    Du hast für diesen Zeitraum nicht genügend Urlaubstage verfügbar. Bitte sprich mit Chef, Stationsleitung
                    oder Teamleitung.
                  </p>
                  <p className="mt-2 text-amber-100/85">
                    Der Antrag würde dein Urlaubskonto ins Minus bringen. Der fehlende Urlaub kann ggf. vom Folgejahr abgezogen
                    werden. Du kannst ihn trotzdem einreichen und musst dann die Bestätigung im nächsten Schritt annehmen.
                  </p>
                </div>
              ) : null}
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
                onClick={() => {
                  setVacationAckRequired(null)
                  setConfirmOpen(true)
                }}
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
            <h2 className="text-lg font-semibold text-white">
              {vacationAckRequired ? 'Mit Bestätigung absenden?' : 'Urlaubsantrag absenden?'}
            </h2>
            <p className="mt-2 text-sm text-slate-200/95">{confirmIntroText()}</p>
            <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-sm text-slate-100">
              <p>
                <span className="text-slate-500">Typ:</span> {REQUEST_TYPES.find((x) => x.value === type)?.label}
              </p>
              {type === 'paid_vacation' && preview ? (
                <>
                  <p>
                    <span className="text-slate-500">Kalendertage:</span> {preview.calendarDays.toFixed(1).replace('.', ',')}
                  </p>
                  <p>
                    <span className="text-slate-500">Abziehbare Urlaubstage:</span>{' '}
                    {preview.vacationDaysToDeduct.toFixed(1).replace('.', ',')}
                  </p>
                  {preview.holidaysExcluded > 0 ? (
                    <p className="text-amber-100/95">
                      Im Zeitraum liegt {preview.holidaysExcluded} Feiertag{preview.holidaysExcluded === 1 ? '' : 'e'}. Dieser
                      wird nicht vom Urlaubskontingent abgezogen.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Die endgültige Berechnung erfolgt bei der Genehmigung durch Chef oder Stationsleitung.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
                Abbrechen
              </Button>
              {vacationAckRequired ? (
                <Button type="button" variant="primary" className="flex-1" disabled={busy} onClick={() => void submit(true)}>
                  Antrag trotzdem absenden
                </Button>
              ) : (
                <Button type="button" variant="primary" className="flex-1" disabled={busy} onClick={() => void submit(false)}>
                  Antrag absenden
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
