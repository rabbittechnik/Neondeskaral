import { useMemo, useState } from 'react'
import { AlertTriangle, Check, FileText, X } from 'lucide-react'
import type { Absence } from '../../types/absence'
import type { Employee } from '../../types/employee'
import { useAbsences } from '../../context/absences-context'
import { checkAbsenceConflicts } from '../../utils/absenceConflicts'
import { formatDateDE } from '../../utils/dateFormat'
import { useScheduleShifts } from '../../context/schedule-shifts-context'
import { countAbsenceDays } from '../../utils/absenceQueries'
import { ABSENCE_TYPE_LABELS } from './absenceLabels'
import { AbsenceTypeBadge } from './AbsenceTypeBadge'
import { AbsenceStatusBadge } from './AbsenceStatusBadge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type Props = {
  employees: Employee[]
  onDetails: (a: Absence) => void
  federalState: import('../../data/germanHolidays').GermanState
}

type VacationDebtDetails = {
  message?: string
  annualVacationDays?: number
  alreadyTakenDays?: number
  requestedDays?: number
  remainingAfterApproval?: number
  hint?: string
}

export function AbsenceRequestsView({ employees, onDetails, federalState }: Props) {
  const { absences, approveAbsence, rejectAbsence, vacationBlocks } = useAbsences()
  const { shifts } = useScheduleShifts()
  const [rejecting, setRejecting] = useState<Absence | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approving, setApproving] = useState<Absence | null>(null)
  const [approveBusy, setApproveBusy] = useState(false)
  const [approveVacationDebt, setApproveVacationDebt] = useState<VacationDebtDetails | null>(null)

  const pending = useMemo(
    () => absences.filter((a) => a.status === 'beantragt'),
    [absences],
  )

  const warningsFor = (a: Absence) =>
    checkAbsenceConflicts(
      { employeeId: a.employeeId, startDate: a.startDate, endDate: a.endDate, type: a.type },
      {
        absences,
        vacationBlocks,
        shifts,
        employees,
        federalState,
        excludeAbsenceId: a.id,
      },
    )

  const fmt = (n: number | undefined) =>
    n === undefined || Number.isNaN(n) ? '—' : `${n.toFixed(1).replace('.', ',')} Tage`

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-[var(--text-faint)]">
          Keine offenen Anträge.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pending.map((a) => {
            const emp = employees.find((e) => e.id === a.employeeId)
            const days = countAbsenceDays(a.startDate, a.endDate, a.halfDay)
            const ws = warningsFor(a)
            const isUnpaid = a.type === 'unpaid_vacation'
            return (
              <Card key={a.id} padding="md" className="border-cyan-500/15">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-main)]">
                      {emp?.displayName ?? a.employeeId}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <AbsenceTypeBadge type={a.type} />
                      {a.type === 'paid_vacation' ? (
                        <span className="rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-cyan-100">
                          Bezahlt
                        </span>
                      ) : null}
                      {isUnpaid ? (
                        <span className="rounded-md border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
                          Unbezahlt
                        </span>
                      ) : null}
                      <AbsenceStatusBadge status={a.status} />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {formatDateDE(a.startDate)} – {formatDateDE(a.endDate)} · {days} Tag(e)
                </p>
                {a.type === 'paid_vacation' ? (
                  <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                    Bezahlte Stunden: {Number(a.paidHoursPerDay ?? 0).toFixed(2).replace('.', ',')} h/Tag · gesamt{' '}
                    {Number(a.paidHoursTotal ?? 0).toFixed(2).replace('.', ',')} h
                  </p>
                ) : null}
                {a.comment ? (
                  <p className="mt-2 text-xs text-[var(--text-faint)]">„{a.comment}“</p>
                ) : null}
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                  Beantragt:{' '}
                  {a.requestedAt.length >= 10
                    ? `${formatDateDE(a.requestedAt.slice(0, 10))}${a.requestedAt.length > 10 ? ` · ${a.requestedAt.slice(11, 16)}` : ''}`
                    : a.requestedAt}
                </p>
                {ws.length > 0 ? (
                  <div className="mt-3 flex gap-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-2 text-[11px] text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <ul className="list-inside list-disc space-y-0.5">
                      {ws.map((w) => (
                        <li key={w.id}>{w.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    type="button"
                    onClick={() => {
                      setApproveVacationDebt(null)
                      setApproving(a)
                    }}
                    leftIcon={<Check className="h-4 w-4" />}
                  >
                    Genehmigen
                  </Button>
                  <Button variant="ghost" type="button" className="text-red-300" onClick={() => { setRejecting(a); setRejectReason('') }} leftIcon={<X className="h-4 w-4" />}>
                    Ablehnen
                  </Button>
                  <Button variant="outline" type="button" onClick={() => onDetails(a)} leftIcon={<FileText className="h-4 w-4" />}>
                    Details
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {rejecting ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={() => setRejecting(null)} />
          <div className="relative z-10 w-full max-w-md rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
            <h3 className="text-lg font-semibold text-[var(--text-main)]">Antrag ablehnen</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              <span className="text-red-400">*</span> Grund der Ablehnung (Pflichtfeld)
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setRejecting(null)}>
                Abbrechen
              </Button>
              <Button
                variant="danger"
                type="button"
                disabled={!rejectReason.trim()}
                onClick={() => {
                  void rejectAbsence(rejecting.id, rejectReason.trim())
                  setRejecting(null)
                }}
              >
                Ablehnen
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {approving ? (
        <div className="fixed inset-0 z-[86] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={() => !approveBusy && setApproving(null)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
            <h3 className="text-lg font-semibold text-[var(--text-main)]">Antrag genehmigen?</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Der Antrag wird als genehmigte Abwesenheit in den Schichtplan übernommen.
            </p>
            <div className="mt-3 space-y-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-[var(--text-muted)]">
              <p>
                <span className="text-[var(--text-faint)]">Typ:</span> {ABSENCE_TYPE_LABELS[approving.type] ?? approving.type}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Zeitraum:</span>{' '}
                {formatDateDE(approving.startDate)} – {formatDateDE(approving.endDate)}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Tage:</span>{' '}
                {countAbsenceDays(approving.startDate, approving.endDate, approving.halfDay)}
              </p>
              {approving.type === 'paid_vacation' ? (
                <>
                  <p>
                    <span className="text-[var(--text-faint)]">Bezahlt:</span> ja · Urlaub wird vom Anspruch abgezogen
                  </p>
                  <p>
                    <span className="text-[var(--text-faint)]">Stunden/Tag:</span>{' '}
                    {Number(approving.paidHoursPerDay ?? 0).toFixed(2).replace('.', ',')} ·{' '}
                    <span className="text-[var(--text-faint)]">gesamt:</span>{' '}
                    {Number(approving.paidHoursTotal ?? 0).toFixed(2).replace('.', ',')}
                  </p>
                </>
              ) : approving.type === 'unpaid_vacation' ? (
                <p>
                  <span className="text-[var(--text-faint)]">Bezahlt:</span> nein · Resturlaub bleibt unverändert
                </p>
              ) : null}
            </div>

            {approveVacationDebt ? (
              <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
                <p className="font-medium">{approveVacationDebt.message ?? 'Nicht genügend Resturlaub.'}</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-rose-100/95">
                  <li>Jahresurlaub: {fmt(approveVacationDebt.annualVacationDays)}</li>
                  <li>Bereits genommen (bezahlt): {fmt(approveVacationDebt.alreadyTakenDays)}</li>
                  <li>Aktuell beantragt: {fmt(approveVacationDebt.requestedDays)}</li>
                  <li>
                    Rest nach Genehmigung:{' '}
                    <span
                      className={
                        (approveVacationDebt.remainingAfterApproval ?? 0) < 0 ? 'font-semibold text-rose-200' : ''
                      }
                    >
                      {fmt(approveVacationDebt.remainingAfterApproval)}
                    </span>
                  </li>
                </ul>
                {approveVacationDebt.hint ? (
                  <p className="mt-2 text-[11px] text-rose-100/85">{approveVacationDebt.hint}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" type="button" disabled={approveBusy} onClick={() => { setApproving(null); setApproveVacationDebt(null) }}>
                Abbrechen
              </Button>
              {!approveVacationDebt ? (
                <Button
                  variant="primary"
                  type="button"
                  disabled={approveBusy}
                  onClick={() => {
                    void (async () => {
                      setApproveBusy(true)
                      const res = await approveAbsence(approving.id, {})
                      setApproveBusy(false)
                      if (res.ok) {
                        setApproving(null)
                        setApproveVacationDebt(null)
                        return
                      }
                      if (res.code === 'VACATION_ACK_REQUIRED' && res.details) {
                        setApproveVacationDebt(res.details as VacationDebtDetails)
                        return
                      }
                    })()
                  }}
                >
                  Genehmigen
                </Button>
              ) : (
                <Button
                  variant="danger"
                  type="button"
                  disabled={approveBusy}
                  onClick={() => {
                    void (async () => {
                      setApproveBusy(true)
                      const res = await approveAbsence(approving.id, { acknowledgeVacationDebt: true })
                      setApproveBusy(false)
                      if (res.ok) {
                        setApproving(null)
                        setApproveVacationDebt(null)
                      }
                    })()
                  }}
                >
                  Trotzdem genehmigen
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
